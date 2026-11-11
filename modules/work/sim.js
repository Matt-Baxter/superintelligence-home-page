// A multi-actor simulation that tests whether coordination pays (REQ-068, REQ-069, proposed). Synthetic: Sample
// people and agents work through the repo's real open tasks in discrete ticks. Two policies:
//   uncoordinated  each actor takes the best-ranked task by its own view (the planner without claims), as agents did
//   coordinated    each actor claims before starting; a claim that collides is refused and it tries the next task
// Measured per run: duplicate work (two actors on one task at once), file collisions (two actors editing overlapping
// files at once: a merge conflict later), tasks finished, idle actor-ticks, and the SC-901 invariant (no two live
// unforced claims overlap) checked on every tick. Seeded, so runs repeat exactly.
const O = require("./overlap"), P = require("./planner");

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function run(items, { policy = "coordinated", agents = 6, people = 2, ticks = 40, seed = 1, reqs = {}, pick = 3 } = {}) {
  const r = rng(seed);
  // Work only on what may be done: open tasks; gates open as their tasks finish. People finish people's tasks.
  const tasks = items.filter((i) => !i.done).map((i) => ({ ...i, blockedBy: [...i.blockedBy], blocks: [...i.blocks], done: false }));
  const by = new Map(tasks.map((t) => [t.key, t]));
  const actors = [...Array.from({ length: people }, (_, k) => ({ id: `person:sample-${k + 1}`, kind: "person" })), ...Array.from({ length: agents }, (_, k) => ({ id: `agent:sample-${k + 1}`, kind: "agent" }))];
  const working = new Map(); // actor -> { task, files, left }
  const m = { policy, seed, duplicate: 0, fileCollisions: 0, finished: 0, idle: 0, refused: 0, invariantBroken: 0 };
  for (let tick = 0; tick < ticks; tick++) {
    const claims = [...working].map(([a, w]) => ({ actor: a, task: w.task, files: w.files, expires_at: "9999" }));
    for (const a of actors) {
      if (working.has(a.id)) continue;
      const askedBy = a.kind === "agent" ? "person:sample-1" : null;
      const view = P.next(tasks, { actor: a.id, kind: a.kind, askedBy, claims: policy === "coordinated" ? claims : [], reqs, limit: 12 }).next;
      let chosen = null;
      if (policy === "uncoordinated") { if (view.length) chosen = view[Math.floor(r() * Math.min(pick, view.length))]; }
      else for (const v of view) { const c = O.check({ task: v.key, actor: a.id, kind: a.kind, askedBy }, { claims, items: tasks }); if (c.ok) { chosen = v; break; } m.refused++; }
      if (!chosen) { m.idle++; continue; }
      const t = by.get(chosen.key), w = { task: t.key, files: t.files, left: 1 + Math.floor(r() * 3) + Math.min(3, t.files.length) };
      working.set(a.id, w); claims.push({ actor: a.id, task: w.task, files: w.files, expires_at: "9999" });
    }
    // Measure what is in progress at the same time.
    const now = [...working];
    for (let i = 0; i < now.length; i++) for (let j = i + 1; j < now.length; j++) {
      const [, x] = now[i], [, y] = now[j];
      if (x.task === y.task) m.duplicate++;
      else if (O.overlapOf(x.files, y.files).length) m.fileCollisions++;
    }
    if (policy === "coordinated" && O.board({ claims: now.map(([a, w]) => ({ actor: a, task: w.task, files: w.files })) }).some((b) => b.severity === "error")) m.invariantBroken++;
    // Progress; a finished task opens what waited on it. Duplicate finishes count once.
    for (const [a, w] of now) {
      if (--w.left > 0) continue;
      working.delete(a); const t = by.get(w.task); if (t.done) continue;
      t.done = true; m.finished++;
      for (const k of t.blocks) { const u = by.get(k); if (u) u.blockedBy = u.blockedBy.filter((d) => d !== t.key); }
    }
  }
  return m;
}

function compare(items, { seeds = 20, ...o } = {}) {
  const stat = (xs) => { const n = xs.length, mean = xs.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1)); return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), min: Math.min(...xs), max: Math.max(...xs) }; };
  const out = {};
  for (const policy of ["uncoordinated", "coordinated"]) {
    const runs = Array.from({ length: seeds }, (_, k) => run(items, { ...o, policy, seed: k + 1 }));
    out[policy] = Object.fromEntries(["duplicate", "fileCollisions", "finished", "idle", "refused", "invariantBroken"].map((f) => [f, stat(runs.map((x) => x[f]))]));
  }
  return out;
}

module.exports = { run, compare, rng };
