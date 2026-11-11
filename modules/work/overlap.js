// Collisions between people and agents (REQ-069, proposed). Pure functions over:
//   claims   [{ id, task, actor, kind: person|agent, files: [], soft?, expires_at, asked_by? }]  (live leases)
//   branches [{ name, files: [] }]   files each open remote branch changes against main (scripts/work.js sync)
//   items    work items (items.js)
// Paths overlap when they are equal, one is a folder holding the other, or a glob's fixed prefix holds the other.
const SHARED = ["specs/001-superintelligence-homepage/spec.md", ".specify/memory/constitution.md", "CONTRACT.md", "WORKING_AGREEMENT.md"];
const norm = (p) => String(p || "").replace(/^\.\//, "").replace(/\/+$/, (m) => (m ? "/" : ""));
const stem = (p) => { const n = norm(p), i = n.search(/[*{]/); return i < 0 ? n : n.slice(0, i); };
const isDir = (p) => /\/$/.test(norm(p)) || /[*{]/.test(p);
function pathsOverlap(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false; if (x === y) return true;
  const sx = stem(x), sy = stem(y);
  return (isDir(x) && y.startsWith(sx)) || (isDir(y) && x.startsWith(sy)) || (isDir(x) && isDir(y) && (sx.startsWith(sy) || sy.startsWith(sx)));
}
const shared = (files) => (files || []).filter((f) => SHARED.some((s) => pathsOverlap(s, f)));
const overlapOf = (A, B) => { const out = []; for (const a of A || []) for (const b of B || []) if (pathsOverlap(a, b)) out.push(norm(a).length >= norm(b).length ? norm(a) : norm(b)); return [...new Set(out)]; };

// Who may take a task: [people] only a person; [rules] an agent only when a person asked (asked_by); [agent] anyone.
function eligible(item, kind, askedBy) {
  if (!item) return { ok: true };
  if (item.who === "people" && kind !== "person") return { ok: false, why: `${item.key} is tagged [people]: only John or Matt decide it.` };
  if (item.who === "rules" && kind === "agent" && !askedBy) return { ok: false, why: `${item.key} is tagged [rules]: an agent takes it only when a person asks (give asked_by).` };
  return { ok: true };
}

// What stands in the way of one actor claiming a task and files. Hard conflicts refuse the claim unless forced;
// warnings are shown. Soft claims (someone has a page open) never conflict, they are presence.
function check({ task, files = [], actor, kind = "agent", askedBy = null }, { claims = [], branches = [], items = [], myBranch = "" } = {}) {
  const hard = [], warn = [], item = items.find((i) => i.key === task);
  const el = eligible(item, kind, askedBy); if (!el.ok) hard.push({ type: "not-eligible", why: el.why });
  if (item && item.done) warn.push({ type: "done", why: `${task} is already ticked done.` });
  if (item && item.blockedBy && item.blockedBy.length) hard.push({ type: "blocked", why: `${task} waits for ${item.blockedBy.join(", ")}.` });
  const allFiles = [...new Set([...(files || []), ...((item && item.files) || [])])];
  for (const c of claims) {
    if (c.actor === actor) continue;
    if (c.soft) { if (c.task === task) warn.push({ type: "presence", why: `${c.actor} has ${task} open (until ${c.expires_at}).`, actor: c.actor }); continue; }
    if (c.task === task) hard.push({ type: "same-task", why: `${c.actor} already holds ${task} until ${c.expires_at}.`, actor: c.actor });
    const o = overlapOf(allFiles, c.files); if (o.length) hard.push({ type: "files", why: `${c.actor} holds ${o.join(", ")} (for ${c.task}) until ${c.expires_at}.`, actor: c.actor, files: o });
  }
  const hits = branches.filter((b) => b.name !== myBranch).map((b) => ({ b, o: overlapOf(allFiles, b.files) })).filter((x) => x.o.length);
  if (hits.length) { const files = [...new Set(hits.flatMap((x) => x.o))], names = hits.map((x) => x.b.name);
    warn.push({ type: "branch", why: `${names.length} open branch${names.length > 1 ? "es" : ""} also change${names.length > 1 ? "" : "s"} ${files.slice(0, 4).join(", ")}${files.length > 4 ? ` and ${files.length - 4} more` : ""} (${names.slice(0, 4).join(", ")}${names.length > 4 ? `, +${names.length - 4}` : ""}): expect merge conflicts; rebase or talk first.`, branch: names.join(", "), branches: names, files }); }
  const sh = shared(allFiles); if (sh.length) hard.push({ type: "shared-doc", why: `${sh.join(", ")} ${sh.length > 1 ? "are" : "is"} shared: changes need both partners' approval (CLAUDE.md).` });
  return { ok: hard.length === 0, hard, warn, files: allFiles };
}

// Every collision on the board right now: claims against claims, claims against branches, and open tasks that will
// touch the same files (sequence them or give them to one owner).
function board({ claims = [], branches = [], items = [] }) {
  const out = [], firm = claims.filter((c) => !c.soft);
  for (let i = 0; i < firm.length; i++) for (let j = i + 1; j < firm.length; j++) {
    const a = firm[i], b = firm[j]; if (a.actor === b.actor) continue;
    if (a.task === b.task) out.push({ type: "same-task", severity: "error", subjects: [a.actor, b.actor], why: `${a.actor} and ${b.actor} both hold ${a.task}.` });
    const o = overlapOf(a.files, b.files); if (o.length) out.push({ type: "files", severity: "error", subjects: [a.actor, b.actor], files: o, why: `${a.actor} (${a.task}) and ${b.actor} (${b.task}) both hold ${o.join(", ")}.` });
  }
  for (const c of firm) for (const b of branches) { const o = overlapOf(c.files, b.files); if (o.length && b.name !== c.branch) out.push({ type: "branch", severity: "warn", subjects: [c.actor, b.name], files: o, why: `${c.actor} (${c.task}) holds files that branch ${b.name} also changes: ${o.slice(0, 5).join(", ")}.` }); }
  // Open tasks that will touch the same files, grouped: one finding per set of tasks (in the order to do them), not
  // one per pair. Tasks already ordered by a dependency, and decisions only people make, aren't collisions.
  const open = items.filter((i) => !i.done && i.files.length && i.who !== "people"), byFile = new Map();
  for (const i of open) for (const f of i.files) { const k = norm(f); if (!byFile.has(k)) byFile.set(k, []); byFile.get(k).push(i); }
  const groups = new Map();
  for (const [f, ts] of byFile) {
    const free = ts.filter((t) => !ts.some((u) => u !== t && (t.dependsOn.includes(u.key) || u.dependsOn.includes(t.key))));
    if (free.length < 2) continue;
    const order = free.slice().sort((a, b) => a.phase - b.phase || b.blocks.length - a.blocks.length || a.key.localeCompare(b.key)), k = order.map((t) => t.key).join("|");
    if (!groups.has(k)) groups.set(k, { order, files: [] }); groups.get(k).files.push(f);
  }
  for (const { order, files } of groups.values()) out.push({ type: "overlapping-tasks", severity: "idea", subjects: order.map((t) => t.key), files,
    why: `${order.length} open tasks touch ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` and ${files.length - 3} more` : ""}: ${order.map((t) => t.key).join(" → ")} (in that order), or give them to one owner.` });
  return out;
}

module.exports = { SHARED, pathsOverlap, overlapOf, shared, eligible, check, board };
