#!/usr/bin/env node
// Properties of the work module (proposed REQ-068..REQ-071), checked on many generated cases (seeded), plus the
// advisor's recall by mutation and the simulation. Synthetic data only.
const path = require("node:path"), fs = require("node:fs"), os = require("node:os"), { spawnSync } = require("node:child_process");
const I = require("../modules/work/items"), O = require("../modules/work/overlap"), P = require("../modules/work/planner"), A = require("../modules/work/advisor"), Sim = require("../modules/work/sim");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const r = Sim.rng(606), pickOf = (xs) => xs[Math.floor(r() * xs.length)];

// --- generators ---------------------------------------------------------------------------------------------------
const SEG = ["modules", "sample", "work", "lib", "test", "a", "b", "sam", "samples"];
const genPath = () => { const n = 1 + Math.floor(r() * 3), parts = Array.from({ length: n }, () => pickOf(SEG)); const kind = r(); return kind < 0.25 ? parts.join("/") + "/" : kind < 0.35 ? parts.join("/") + "/**" : parts.join("/") + pickOf([".js", ".md", ".json"]); };
function genItems(n) {
  const its = [];
  for (let k = 0; k < n; k++) {
    const deps = its.filter(() => r() < 0.12).map((x) => x.key); // only earlier tasks: a DAG by construction
    its.push({ key: `spec:900/T${900 + k}`, source: "speckit", id: `T${900 + k}`, who: pickOf(["agent", "agent", "agent", "rules", "people"]), reqs: [pickOf(["REQ-901", "REQ-902", "REQ-903"])], done: r() < 0.25, text: "Sample task (test data)",
      files: Array.from({ length: Math.floor(r() * 3) }, genPath), areas: [], phase: 1 + Math.floor(k / 5), dependsOn: deps });
  }
  return I.link(its);
}
const REQS = { "REQ-901": { level: "MUST", status: "approved" }, "REQ-902": { level: "SHOULD", status: "proposed" }, "REQ-903": { level: "MAY", status: "proposed" } };

console.log("Paths (2,000 generated pairs)");
let sym = true, refl = true, contain = true, noPrefix = true;
for (let k = 0; k < 2000; k++) {
  const a = genPath(), b = genPath();
  if (O.pathsOverlap(a, b) !== O.pathsOverlap(b, a)) sym = false;
  if (!O.pathsOverlap(a, a)) refl = false;
  if (/\/$/.test(a) && !O.pathsOverlap(a, a + "x.js")) contain = false;
  if (!/[/*]$/.test(a) && O.pathsOverlap(a, a.replace(/\.\w+$/, "") + "x/y.js") && !/\/$/.test(a)) noPrefix = false;
}
ok(sym, "overlap is symmetric"); ok(refl, "every path overlaps itself"); ok(contain, "a folder overlaps every file inside it"); ok(noPrefix, "a file never overlaps a different path that merely starts with its name");

console.log("Planner (300 generated task graphs)");
let partition = true, sums = true, never = true, order = true, acyclic = true;
for (let g = 0; g < 300; g++) {
  const items = genItems(8 + Math.floor(r() * 20)), kind = pickOf(["agent", "person"]), askedBy = r() < 0.5 ? "person:sample-1" : null;
  const claims = items.filter((i) => !i.done && r() < 0.15).map((i) => ({ task: i.key, actor: "agent:sample-other", files: i.files, expires_at: "9999" }));
  const res = P.next(items, { actor: "agent:sample-me", kind, askedBy, claims, reqs: REQS, limit: 999 });
  const offered = new Set(res.next.map((x) => x.key)), skipped = new Set(res.skipped.map((x) => x.key)), open = items.filter((i) => !i.done);
  if (open.some((i) => offered.has(i.key) === skipped.has(i.key)) || offered.size + skipped.size !== open.length) partition = false;
  if (res.next.some((x) => x.score !== x.reasons.reduce((s, y) => s + y.pts, 0))) sums = false;
  for (const x of res.next) { const i = items.find((y) => y.key === x.key); if (i.blockedBy.length || claims.some((c) => c.task === i.key) || !O.eligible(i, kind, askedBy).ok) never = false; }
  for (let k = 1; k < res.next.length; k++) if (res.next[k - 1].score < res.next[k].score) order = false;
  for (const i of items) if (i.blockedBy.includes(i.key)) acyclic = false;
}
ok(partition, "every open task is either offered or skipped with a reason, never both");
ok(sums, "every score is exactly the sum of its listed reasons (SC-902)");
ok(never, "never offered: a blocked task, a task someone holds, or one the actor may not take");
ok(order, "offers come in score order"); ok(acyclic, "no task waits for itself");

console.log("Claims (200 generated sequences of 60 claims, releases and expiries)");
let invariant = true, forcedOnly = true, refusals = 0, accepts = 0;
for (let s = 0; s < 200; s++) {
  const items = genItems(15); let live = [];
  for (let step = 0; step < 60; step++) {
    const roll = r();
    if (roll < 0.2 && live.length) live.splice(Math.floor(r() * live.length), 1); // release or expiry
    else {
      const actor = pickOf(["agent:sample-1", "agent:sample-2", "agent:sample-3", "person:sample-1", "person:sample-2"]), kind = actor.startsWith("person") ? "person" : "agent";
      const i = pickOf(items), files = r() < 0.5 ? [genPath()] : [], force = kind === "person" && r() < 0.1;
      const c = O.check({ task: i.key, files, actor, kind, askedBy: "person:sample-1" }, { claims: live, items });
      if (c.ok || (force && !c.hard.some((h) => h.type === "not-eligible"))) { live = live.filter((x) => !(x.actor === actor && x.task === i.key)); live.push({ task: i.key, actor, files: c.files, forced: !c.ok }); accepts++; } else refusals++;
    }
    const firm = live.filter((x) => !x.forced);
    for (let a = 0; a < firm.length; a++) for (let b = a + 1; b < firm.length; b++) if (firm[a].actor !== firm[b].actor && (firm[a].task === firm[b].task || O.overlapOf(firm[a].files, firm[b].files).length)) invariant = false;
    const errs = O.board({ claims: live }).filter((x) => x.severity === "error");
    if (errs.length && !live.some((x) => x.forced)) forcedOnly = false;
  }
}
ok(invariant, `no two live unforced claims by different actors share a task or files (SC-901; ${accepts} accepted, ${refusals} refused)`);
ok(forcedOnly, "the board shows a collision only when a person forced one");

console.log("Guard hook agrees with the claim check (40 generated edits)");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "si-hookprop-")); fs.mkdirSync(path.join(root, "modules", "work"), { recursive: true }); fs.mkdirSync(path.join(root, "out", "work"), { recursive: true });
fs.copyFileSync(path.join(__dirname, "..", "modules", "work", "overlap.js"), path.join(root, "modules", "work", "overlap.js"));
const held = Array.from({ length: 6 }, (_, k) => ({ task: `sample:${k}`, actor: `agent:sample-${k % 3}`, files: [genPath()], expires_at: "9999-01-01T00:00:00Z" }));
fs.writeFileSync(path.join(root, "out", "work", "claims.json"), JSON.stringify({ claims: held }));
let agree = 0, cases = 0;
for (let k = 0; k < 40; k++) {
  const me = `agent:sample-${Math.floor(r() * 4)}`, file = genPath().replace(/\/(\*\*)?$/, "/x.js");
  const want = held.some((c) => c.actor !== me && c.files.some((f) => O.pathsOverlap(f, file)));
  const h = spawnSync(process.execPath, [path.join(__dirname, "..", "agent-kit", "hooks", "guard.js")], { input: JSON.stringify({ tool_name: "Edit", tool_input: { file_path: file, new_string: "x" }, cwd: root }), env: { ...process.env, SI_ACTOR: me }, encoding: "utf8" });
  cases++; if ((h.status === 2) === want) agree++;
}
ok(agree === cases, `the hook blocks exactly the edits the claim check says collide (${agree}/${cases})`);

console.log("Advisor: recall by mutation (each rule against a clean base and a mutant with one gap)");
const base = () => ({ reqs: [{ id: "REQ-901", spec: "900", text: "The system MUST read sample papers in full", level: "MUST", status: "approved", trace: { code: "modules/sample/" }, tasks: [{ id: "T910" }] }],
  specs: [{ id: "900", dir: "900-sample", title: "Sample" }], specDir: { 900: "900-sample" }, hasTasks: { 900: true }, nextTask: { 900: 911 },
  capabilities: { papers: { title: "Paper reading", purpose: "Read papers in full" } }, inChanges: {}, mapped: new Set(["REQ-901"]),
  items: [{ key: "spec:900/T910", source: "speckit", spec: "900", who: "agent", reqs: ["REQ-901"], done: false, files: ["modules/sample/a.js"], phase: 1, dependsOn: [], blockedBy: [], blocks: [] }],
  mentions: { "REQ-901": { code: ["modules/sample/a.js"], tests: [] } }, tables: [{ name: "sample_rows", file: "modules/sample/module.js", cols: ["id"] }], interfaces: "sample_rows",
  types: ["Module"], shaped: new Set(["Module"]), views: [{ name: "sample-view", module: "sample", spec: { bindings: { "/x": { source: "sample.list" } }, elements: {} } }],
  sources: [{ kind: "source", id: "sample.list", module: "sample", about: "Sample rows for the test", params: { q: { type: "string", max: 40 } }, access: "user", guarded: true }],
  actions: [{ kind: "action", id: "sample.save", module: "sample", about: "Save a sample row", params: {}, access: "admin", guarded: true, refresh: ["sample.list"] }],
  sourceIds: new Set(["sample.list"]), actionIds: new Set(["sample.save"]), boundSources: new Set(["sample.list"]), pageSources: new Set(), learnings: [{ id: "L1", area: "sample", guard: "qa:x" }], today: "2026-11-11" });
const MUT = {
  "speckit.untraced": (f) => { f.reqs[0].trace = null; },
  "speckit.no-task": (f) => { f.reqs[0].trace = null; f.reqs[0].status = "proposed"; f.reqs[0].tasks = []; f.items = []; },
  "speckit.no-tasks-file": (f) => { f.hasTasks = { 900: false }; },
  "openspec.unmapped": (f) => { f.mapped = new Set(); },
  "openspec.archive-ready": (f) => { f.inChanges = { "sample-change": ["REQ-901"] }; f.mapped.add("REQ-901"); f.items = [{ ...f.items[0], key: "change:sample-change/1.1", source: "openspec", change: "sample-change", done: true }]; },
  "openspec.gate-waiting": (f) => { f.items = [{ ...f.items[0], key: "change:s/2.1", source: "openspec", change: "s", who: "people", blocks: ["a", "b"] }]; },
  "data-model.undocumented-table": (f) => { f.interfaces = ""; },
  "data-model.unshaped-type": (f) => { f.types = ["Module", "Sample"]; },
  "bindings.unknown-refresh": (f) => { f.actions[0].refresh = ["sample.gone"]; },
  "bindings.view-references": (f) => { f.views[0].spec.bindings["/x"].source = "sample.gone"; f.boundSources.add("sample.list"); },
  "bindings.unbound-source": (f) => { f.boundSources = new Set(); },
  "validation.unbounded-string": (f) => { delete f.sources[0].params.q.max; },
  "validation.inconsistent-guard": (f) => { f.actions[0].guarded = false; },
  "validation.action-without-about": (f) => { f.actions[0].about = ""; },
  "learning.area-without-qa": (f) => { f.learnings = [1, 2, 3].map((k) => ({ id: `L${k}`, area: "sample", guard: "unit:x" })); },
  "agents.overlapping-tasks": (f) => { f.items = [f.items[0], { ...f.items[0], key: "spec:900/T911", id: "T911" }]; },
};
const clean = A.advise(base());
ok(clean.length === 0, `the clean base has no findings (${clean.map((x) => x.rule).join(", ") || "none"})`);
const rules = A.RULES.map((x) => x.id), caught = [], missed = [], spill = [];
for (const id of rules) {
  if (!MUT[id]) { missed.push(`${id} (no mutant)`); continue; }
  const f = base(); MUT[id](f); const got = A.advise(f);
  if (got.some((x) => x.rule === id)) caught.push(id); else missed.push(id);
  const other = got.filter((x) => x.rule !== id).map((x) => x.rule); if (other.length) spill.push(`${id} → ${[...new Set(other)].join(",")}`);
}
ok(missed.length === 0, `every advisor rule catches its mutant: recall ${caught.length}/${rules.length}${missed.length ? ` (missed ${missed.join(", ")})` : ""}`);
console.log(`    side effects (other rules a single gap also trips): ${spill.join("; ") || "none"}`);

console.log("Simulation: Sample people and agents on the repo's real open tasks (10 seeds each)");
const items = I.collect(), reqs = Object.fromEntries(require("../modules/project/specs").collect().reqs.map((x) => [x.id, x]));
const short = Sim.compare(items, { seeds: 10, ticks: 12, reqs }), long = Sim.compare(items, { seeds: 10, ticks: 40, reqs });
const fmt = (s) => `${s.mean}±${s.sd}`;
console.log(`    12 ticks: uncoordinated duplicate ${fmt(short.uncoordinated.duplicate)}, file collisions ${fmt(short.uncoordinated.fileCollisions)}, finished ${fmt(short.uncoordinated.finished)}`);
console.log(`              coordinated   duplicate ${fmt(short.coordinated.duplicate)}, file collisions ${fmt(short.coordinated.fileCollisions)}, finished ${fmt(short.coordinated.finished)}, idle ${fmt(short.coordinated.idle)}`);
console.log(`    40 ticks: finished ${fmt(long.uncoordinated.finished)} uncoordinated vs ${fmt(long.coordinated.finished)} coordinated`);
ok(short.coordinated.duplicate.max === 0 && short.coordinated.fileCollisions.max === 0 && long.coordinated.invariantBroken.max === 0, "with claims: no duplicate work, no file collisions, the invariant holds on every tick of every run");
ok(short.uncoordinated.duplicate.mean > 0 && short.coordinated.finished.mean >= short.uncoordinated.finished.mean && long.coordinated.finished.mean > long.uncoordinated.finished.mean, "without claims the same actors duplicate work, and claims finish at least as much (more over 40 ticks)");
fs.mkdirSync(process.env.WORK_OUT || path.join(__dirname, "..", "out", "work"), { recursive: true });
fs.writeFileSync(path.join(process.env.WORK_OUT || path.join(__dirname, "..", "out", "work"), "proof.json"), JSON.stringify({ at: new Date().toISOString(), short, long, advisor: { recall: `${caught.length}/${rules.length}`, spill } }, null, 1));

console.log(`\nwork properties: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
