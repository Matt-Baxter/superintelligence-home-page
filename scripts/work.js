#!/usr/bin/env node
// Work board for agents and people at the terminal (REQ-068..REQ-071, proposed). Same logic as /m/work.
//   npm run work -- sync [--fetch]         files each open remote branch changes (out/work/branches.json) + claims cache
//   npm run work -- next [--json]          open tasks you may take, ranked, with the points behind each score
//   npm run work -- claim <task> [--files a,b/] [--minutes 120] [--intent "..."] [--force]
//   npm run work -- release <task>
//   npm run work -- check <task> [--files a,b]   would a claim collide? (exit 1 if it would be refused)
//   npm run work -- who <file>             who holds a file, and which open branches change it
//   npm run work -- board                  every collision now
//   npm run work -- advise [--target speckit|openspec|data-model|bindings|validation|learning|agents] [--json]
//   npm run work -- brief                  the markdown brief an agent reads before starting
// Who you are: SI_ACTOR=agent:<name> or person:<username>; default agent:<current branch>. An agent working for a
// person names them with SI_ASKED_BY=person:<username> (needed to take a [rules] task).
// The database is the app's (DATABASE_URL for the shared Neon one; local SQLite otherwise), so claims made here and
// on the web page are the same claims.
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");
const W = require("../modules/work/module").lib, { I, O, P, C, A } = W;
const args = process.argv.slice(2), cmd = args[0] || "next", pos = args.filter((a, k) => k > 0 && !a.startsWith("--") && !(args[k - 1] || "").startsWith("--")), flag = (n) => { const k = args.indexOf(`--${n}`); return k < 0 ? null : args[k + 1] && !args[k + 1].startsWith("--") ? args[k + 1] : true; };
const git = (...a) => { try { return execFileSync("git", a, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return ""; } };
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const actor = process.env.SI_ACTOR || `agent:${branch || "local"}`, kind = actor.startsWith("person:") ? "person" : "agent", askedBy = process.env.SI_ASKED_BY || null;
const json = !!flag("json"), out = (x, text) => console.log(json ? JSON.stringify(x, null, 1) : text);

function branches(fetch) {
  if (fetch) git("fetch", "--quiet", "origin");
  const base = git("rev-parse", "--verify", "--quiet", "origin/main") ? "origin/main" : "main", list = [];
  for (const b of git("for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").split("\n").filter((b) => b && !/\/(HEAD|main|master)$/.test(b) && b !== "origin")) {
    const files = git("diff", "--name-only", `${base}...${b}`).split("\n").filter(Boolean);
    if (files.length) list.push({ name: b.replace(/^origin\//, ""), files: files.slice(0, 400), changed: files.length });
  }
  const data = { about: "Files each open remote branch changes against main, for collision checks. Written by `npm run work -- sync`; generated.", at: new Date().toISOString(), base, branches: list };
  const dir = process.env.WORK_OUT || path.join(root, "out", "work"); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "branches.json"), JSON.stringify(data, null, 1));
  return data;
}

(async () => {
  const db = require("../lib/db"); db.extend({ sql: C.SQL }); await db.ready();
  const items = I.collect(), claims = await C.live(db), br = C.readBranches(), reqs = Object.fromEntries(require("../modules/project/specs").collect().reqs.map((r) => [r.id, r]));
  const lazyAdvice = () => A.advise(A.gather({ items }));
  try {
    if (cmd === "sync") { const b = branches(!!flag("fetch")); await C.writeCache(db); out(b, `work: ${b.branches.length} open branch(es) against ${b.base}; ${claims.length} live claim(s) cached for the guard hook.`); }
    else if (cmd === "next") { const r = P.next(items, { actor, kind, askedBy, claims, branches: br.branches, reqs, advice: lazyAdvice(), limit: Number(flag("limit")) || 8 });
      out(r, r.next.map((n, k) => `${k + 1}. ${n.key} [${n.who}] ${n.reqs.join(" ")} score ${n.score}\n   ${n.text}\n   ${n.reasons.map((x) => `${x.pts > 0 ? "+" : ""}${x.pts} ${x.why}`).join("; ")}${n.files.length ? `\n   files: ${n.files.join(", ")}` : ""}`).join("\n") || `Nothing open that ${actor} may take (${r.skipped.length} waiting or held).`); }
    else if (cmd === "claim") { if (!pos[0]) throw new Error("claim needs a task key, e.g. spec:006/T673"); const files = flag("files") && flag("files") !== true ? String(flag("files")).split(",").map((s) => s.trim()).filter(Boolean) : [];
      const r = await C.claim(db, { task: pos[0], files, actor, kind, askedBy, branch, intent: flag("intent") === true ? "" : flag("intent") || "", minutes: Number(flag("minutes")) || undefined, force: !!flag("force") && kind === "person" }, { items, branches: br });
      out(r, `Claimed ${r.task} as ${actor} until ${r.expires_at}${r.renewed ? " (renewed)" : ""}.${r.warnings.map((w) => `\n  note: ${w.why}`).join("")}`); }
    else if (cmd === "release") { const r = await C.release(db, { task: pos[0], actor }); out(r, `Released ${r.released} claim(s) on ${pos[0]}.`); }
    else if (cmd === "check") { const files = flag("files") && flag("files") !== true ? String(flag("files")).split(",") : []; const r = O.check({ task: pos[0], files, actor, kind, askedBy }, { claims, branches: br.branches, items, myBranch: branch });
      out(r, `${r.ok ? "OK to claim" : "Would be refused"}: ${pos[0]}${[...r.hard.map((h) => `\n  ✗ ${h.why}`), ...r.warn.map((w) => `\n  ! ${w.why}`)].join("")}`); if (!r.ok) process.exitCode = 1; }
    else if (cmd === "who") { const f = pos[0]; const hold = claims.filter((c) => c.files.some((x) => O.pathsOverlap(x, f))), bs = br.branches.filter((b) => b.files.some((x) => O.pathsOverlap(x, f)));
      out({ claims: hold, branches: bs.map((b) => b.name) }, [...hold.map((c) => `held by ${c.actor} for ${c.task} until ${c.expires_at}`), ...bs.map((b) => `changed on branch ${b.name}`)].join("\n") || `Nobody holds ${f}.`); }
    else if (cmd === "board") { const r = O.board({ claims, branches: br.branches, items }); out(r, r.map((x) => `[${x.severity}] ${x.why}`).join("\n") || "No collisions."); }
    else if (cmd === "advise") { const r = lazyAdvice().filter((a) => !flag("target") || a.target === flag("target")); out(r, r.map((a) => `[${a.severity}] ${a.target} · ${a.subject}${a.shared ? " (shared: both partners)" : ""}\n  ${a.why}\n  → ${a.file || ""}\n${a.draft.split("\n").map((l) => `    ${l}`).join("\n")}`).join("\n") + `\n${r.length} suggestion(s).`); }
    else if (cmd === "brief") { const adv = lazyAdvice(); console.log(W.brief({ actor, kind, claims, conflicts: O.board({ claims, branches: br.branches, items }), next: P.next(items, { actor, kind, askedBy, claims, branches: br.branches, reqs, advice: adv, limit: 5 }).next, advice: adv.filter((a) => a.severity !== "idea"), rules: W.hardRules() })); }
    else throw new Error(`unknown command ${cmd}; see the top of scripts/work.js`);
  } catch (e) { console.error(`work: ${e.message}`); process.exitCode = e.status === 409 ? 2 : 1; }
  if (db.end) await db.end();
})();
