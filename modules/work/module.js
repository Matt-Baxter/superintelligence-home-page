// Work: planning and coordination for people and agents (REQ-068..REQ-071, proposed, spec 009;
// openspec/changes/add-coordination-and-advisor; extended version only).
//   items.js    every task from Spec Kit and OpenSpec, with files, dependencies and who may take it
//   overlap.js  collisions: same task, same files, open branches, shared documents, overlapping tasks
//   planner.js  what to do next, ranked with the reasons; initiatives by requirement
//   claims.js   leases (claim, renew, release) refused on collision; presence; advice marks
//   advisor.js  highlights and drafted additions for specs, OpenSpec, data model, bindings and validation
// Agents use the same logic through scripts/work.js and the agent kit's MCP tools and guard hook.
const I = require("./items"), O = require("./overlap"), P = require("./planner"), C = require("./claims"), A = require("./advisor");

let memo = null; // the repo scan takes ~100 ms; keep it a minute
function facts(deps) {
  if (memo && Date.now() - memo.at < 60e3) return memo.f;
  const items = I.collect(), views = deps && deps.kernel ? [...deps.kernel.store.views.values()].filter((v) => v.spec) : [];
  const f = A.gather({ items, views }); memo = { at: Date.now(), f }; return f;
}
const reqMap = (f) => Object.fromEntries(f.reqs.map((r) => [r.id, r]));
const actorOf = (c, i = {}) => (i.actor && /^agent:[\w./-]{1,60}$/.test(i.actor) ? { actor: i.actor, kind: "agent", askedBy: `person:${c.user.username}` } : { actor: `person:${c.user.username}`, kind: "person", askedBy: null });
const FILES = { type: "array", about: "Paths or folders (trailing /) the work will touch; at most 50" };
const cleanFiles = (c, a) => { a = a || []; if (a.length > 50 || a.some((x) => typeof x !== "string" || x.length > 200 || /\.\.|^\//.test(x))) c.bad("files must be up to 50 relative paths inside the repo."); return a; };

async function advice(c, deps, p = {}) {
  const f = facts(deps), m = await C.marks(c.db), all = A.advise(f, { dismissed: new Set([...m].filter(([, v]) => v.state === "dismissed").map(([k]) => k)) });
  return all.map((a) => ({ ...a, mark: m.get(a.id) || null })).filter((a) => (p.includeDismissed || !a.dismissed) && (!p.target || a.target === p.target) && (!p.severity || a.severity === p.severity));
}

function brief({ actor, kind, claims, conflicts, next, advice: adv, rules }) {
  const L = [`# Work brief for ${actor}`, "", `Generated ${C.iso(Date.now())}. Claim before you start; release when you push. A claim that collides is refused with the reason.`, ""];
  L.push("## Hard rules", "", ...rules.map((r) => `- ${r}`), "");
  L.push("## Who holds what", "", ...(claims.length ? claims.map((c) => `- ${c.soft ? "(viewing) " : ""}${c.actor}: ${c.task}${c.files.length ? ` — ${c.files.slice(0, 5).join(", ")}` : ""} (until ${c.expires_at})`) : ["- Nobody holds anything."]), "");
  L.push("## Next for you", "", ...(next.length ? next.map((n, k) => `${k + 1}. **${n.key}** [${n.who}] ${n.reqs.join(" ")} — ${n.text}\n   score ${n.score}: ${n.reasons.map((r) => `${r.pts > 0 ? "+" : ""}${r.pts} ${r.why}`).join("; ")}${n.files.length ? `\n   files: ${n.files.join(", ")}` : ""}\n   claim: \`npm run work -- claim ${n.key}${n.files.length ? ` --files ${n.files.join(",")}` : ""}\``) : ["Nothing open that you may take."]), "");
  L.push("## Collisions", "", ...(conflicts.length ? conflicts.slice(0, 12).map((x) => `- [${x.severity}] ${x.why}`) : ["- None."]), "");
  L.push("## Suggestions (errors and warnings first)", "", ...(adv.length ? adv.slice(0, 12).map((a) => `- [${a.severity}] ${a.target} · ${a.subject}: ${a.why}${a.shared ? " (shared document: needs both partners)" : ""}`) : ["- None."]), "");
  return L.join("\n");
}
function hardRules() {
  try { const t = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "..", "CLAUDE.md"), "utf8"); return [...t.matchAll(/^- \*\*([^*]+)\*\*/gm)].map((m) => m[1].replace(/\.$/, "")); } catch { return []; }
}

module.exports = {
  id: "work",
  version: "0.1.0",
  description: "Planning and coordination for people and agents: tasks from Spec Kit and OpenSpec, claims with leases, collision checks, ranked next steps and an advisor for specs, data model and bindings.",
  requires: ["data", "project"],
  setup(ctx) {
    ctx.point("db.schema").addSql(C.SQL);
    ctx.point("ui.nav").add({ href: "/m/work", label: "Work board", admin: true, order: 88 });
    const S = ctx.point("data.sources"), Ac = ctx.point("data.actions");
    S.add("work.items", { about: "Every task from Spec Kit and OpenSpec with its files, dependencies and who may take it: { open?, who?, req? }.",
      params: { open: { type: "boolean" }, who: { type: "string", enum: ["agent", "rules", "people"] }, req: { type: "string", max: 12 } }, access: "admin",
      run: (p) => I.collect().filter((i) => (!p.open || !i.done) && (!p.who || i.who === p.who) && (!p.req || i.reqs.includes(p.req))) });
    S.add("work.next", { about: "The open tasks you may take, ranked, each with the points behind its score. kind=agent ranks for an agent working for you.",
      params: { kind: { type: "string", enum: ["person", "agent"], default: "person" }, actor: { type: "string", max: 70 }, limit: { type: "integer", min: 1, max: 50, default: 10 } }, access: "admin",
      run: async (p, c) => { const f = facts(c.deps), who = p.kind === "agent" ? { actor: p.actor || "agent:helper", kind: "agent", askedBy: `person:${c.user.username}` } : actorOf(c);
        return P.next(f.items, { ...who, claims: await C.live(c.db), branches: C.readBranches().branches, reqs: reqMap(f), advice: await advice(c, c.deps), limit: p.limit }); } });
    S.add("work.initiatives", { about: "Open work grouped by requirement, ranked by how much it unblocks and how much is ready.", params: {}, access: "admin", run: (p, c) => P.initiatives(facts(c.deps).items, { reqs: reqMap(facts(c.deps)) }) });
    S.add("work.claims", { about: "Live claims (leases) by people and agents, and presence on open pages.", params: { task: { type: "string", max: 160 } }, access: "admin",
      run: async (p, c) => (await C.live(c.db)).filter((x) => !p.task || x.task === p.task) });
    S.add("work.conflicts", { about: "Every collision now: claims on the same task or files, claims against open branches, and open tasks that will touch the same files.", params: {}, access: "admin",
      run: async (p, c) => O.board({ claims: await C.live(c.db), branches: C.readBranches().branches, items: facts(c.deps).items }) });
    S.add("work.check", { about: "Would this claim collide? Same answer a claim would give, without claiming: { task, files? }.",
      params: { task: { type: "string", required: true, max: 160 }, files: { type: "string", max: 2000, about: "comma-separated" }, actor: { type: "string", max: 70 } }, access: "admin",
      run: async (p, c) => { const who = actorOf(c, p); return O.check({ task: p.task, files: (p.files || "").split(",").map((s) => s.trim()).filter(Boolean), ...who }, { claims: await C.live(c.db), branches: C.readBranches().branches, items: facts(c.deps).items }); } });
    S.add("work.advice", { about: "Highlights and drafted additions for Spec Kit, OpenSpec, the data model, bindings and validation: { target?, severity?, includeDismissed? }.",
      params: { target: { type: "string", enum: ["speckit", "openspec", "data-model", "bindings", "validation", "learning", "agents"] }, severity: { type: "string", enum: ["error", "warn", "idea"] }, includeDismissed: { type: "boolean" } }, access: "admin",
      run: (p, c) => advice(c, c.deps, p) });
    S.add("work.brief", { about: "A markdown brief for an AI agent (or a person) starting work: hard rules, who holds what, the next tasks with reasons, collisions and suggestions.",
      params: { actor: { type: "string", max: 70 }, kind: { type: "string", enum: ["person", "agent"], default: "agent" } }, access: "admin",
      run: async (p, c) => { const f = facts(c.deps), who = p.kind === "agent" ? { actor: p.actor || "agent:helper", kind: "agent", askedBy: `person:${c.user.username}` } : actorOf(c), claims = await C.live(c.db), branches = C.readBranches().branches, adv = await advice(c, c.deps);
        return { markdown: brief({ ...who, claims, conflicts: O.board({ claims, branches, items: f.items }), next: P.next(f.items, { ...who, claims, branches, reqs: reqMap(f), advice: adv, limit: 5 }).next, advice: adv.filter((a) => a.severity !== "idea"), rules: hardRules() }) }; } });

    Ac.add("work.claim", { about: "Claim a task (and the files it will touch) for a while. Refused with the reasons if it collides, unless a person forces it. actor agent:<name> claims for an agent you asked.",
      input: { task: { type: "string", required: true, max: 160 }, files: FILES, intent: { type: "string", max: 300 }, minutes: { type: "integer", min: 1, max: 4320 }, soft: { type: "boolean" }, force: { type: "boolean" }, branch: { type: "string", max: 120 }, actor: { type: "string", max: 70 } }, access: "admin", refresh: ["work.claims", "work.conflicts", "work.next"],
      run: async (i, c) => { const who = actorOf(c, i); return C.claim(c.db, { ...i, files: cleanFiles(c, i.files), ...who, userId: c.user.id, force: i.force && who.kind === "person" }, { items: facts(c.deps).items, branches: C.readBranches() }); } });
    Ac.add("work.release", { about: "Release a claim (yours, or any as an admin): { id } or { task }.", input: { id: { type: "integer", min: 1 }, task: { type: "string", max: 160 }, actor: { type: "string", max: 70 } }, access: "admin", refresh: ["work.claims", "work.conflicts", "work.next"],
      run: (i, c) => { if (!i.id && !i.task) c.bad("Give the claim's id or its task."); return C.release(c.db, { id: i.id, task: i.task, actor: actorOf(c, i).actor, admin: !!c.user.admin }); } });
    Ac.add("work.advice-mark", { about: "Mark a suggestion accepted (you'll make the change), dismissed (not worth it, with why) or open again.",
      input: { finding: { type: "string", required: true, max: 20 }, state: { type: "string", required: true, enum: ["accepted", "dismissed", "open"] }, note: { type: "string", max: 300 } }, access: "admin", refresh: ["work.advice"],
      run: (i, c) => C.mark(c.db, { ...i, actor: `person:${c.user.username}` }) });
  },
  // for scripts/work.js and tests
  lib: { I, O, P, C, A, brief, hardRules },
};
