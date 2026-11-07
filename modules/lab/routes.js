// Lab routes (docs/NAMING.md: /api/lab/* for signed-in users). Deterministic runs only; model calls stay in the worker.
const L = require("./lab");
const intent = require("./intent");
const tagger = require("../../lib/tagger");

module.exports = function mountLab(app, { db, auth, admin, wrap, str, bad, notFound, views, weighted }) {
  // The live intent policy: the latest one applied from the Arena, or the gym's learned policy.
  let applied = { id: null, policy: null };
  const livePolicy = async () => {
    const row = await db.get("SELECT id, policy FROM lab_policies WHERE active = 1 ORDER BY id DESC LIMIT 1");
    if (!row) return { id: null, policy: intent.policy() };
    if (applied.id !== row.id) applied = { id: row.id, policy: JSON.parse(row.policy) };
    return applied;
  };
  const cache = new Map(); // deterministic results: same example + params -> same answer
  const runCached = (id, overrides = {}) => { const k = id + JSON.stringify(overrides); if (!cache.has(k)) { if (cache.size > 200) cache.clear(); cache.set(k, L.runExample(id, overrides)); } return cache.get(k); };
  const summary = (r) => ({ id: r.example.id, title: r.example.title, concept: r.example.concept, topics: r.example.topics, idea: r.example.idea,
    expect: r.example.reproduce.expect, hypothesis: r.example.hypothesis.statement, verdict: r.verdict });
  const scorecard = (input) => { try { return weighted(input); } catch (e) { return { error: e.message }; } };

  app.get("/api/lab/examples", auth, wrap(async () => ({ about: L.EX.about, examples: L.EX.examples.map((e) => summary(runCached(e.id))) })));
  app.get("/api/lab/examples/:id", auth, wrap(async (req) => {
    const id = str(req.params.id, 60); if (!L.BY_ID[id]) notFound("That example");
    const r = runCached(id), runner = L.runners.get(r.example.reproduce.runner);
    const runs = await db.all("SELECT id, kind, proposer, metric, value, created_at FROM lab_runs WHERE example_id = ? ORDER BY id DESC LIMIT 20", id);
    return { ...summary(r), runner: { id: runner.id, about: runner.about, params: runner.params, metrics: runner.metrics },
      reproduce: r.example.reproduce, hypothesisParams: r.example.hypothesis.params, predict: r.example.hypothesis.predict,
      baseline: r.baseline, variant: r.variant, judgeInput: r.judgeInput, scorecard: scorecard(r.judgeInput), runs, program: L.programText(r.example, r.example.hypothesis.predict.metric, runner.metrics.find((m) => m.id === r.example.hypothesis.predict.metric).better, []) };
  }));
  // Try your own variant: params override the hypothesis (clamped to each parameter's range).
  app.post("/api/lab/examples/:id/run", auth, wrap(async (req) => {
    const id = str(req.params.id, 60); if (!L.BY_ID[id]) notFound("That example");
    const p = req.body?.params || {}; if (typeof p !== "object" || Object.keys(p).length > 12) bad("Send {params: {name: number}}.");
    const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]));
    const r = runCached(id, clean);
    await db.insert("INSERT INTO lab_runs (example_id, kind, proposer, metric, value, result, created_by) VALUES (?, 'run', 'person', ?, ?, ?, ?)",
      id, r.verdict.metric, r.verdict.variant, JSON.stringify({ params: r.variant.params, metrics: r.variant.metrics, verdict: r.verdict.supported }), req.user.id);
    return { variant: r.variant, verdict: r.verdict, judgeInput: r.judgeInput, scorecard: scorecard(r.judgeInput) };
  }));
  app.get("/api/lab/runs/:id", auth, wrap(async (req) => {
    const r = await db.get("SELECT * FROM lab_runs WHERE id = ?", Number(req.params.id)); if (!r) notFound("That run");
    return { run: { ...r, result: JSON.parse(r.result || "{}") } };
  }));

  // Intent -> action (the gym's learned si-expr policy) -> plan; "build-dashboard" is executed and validated.
  app.post("/api/lab/intent", auth, wrap(async (req) => {
    const text = str(req.body?.text, 400); if (!text) bad("Say what you want done.");
    const live = await livePolicy(), pol = live.policy, { action, path } = intent.explain(pol, text);
    const out = { text, action, why: path, policy: live.id ? `applied #${live.id}` : "learned", plan: (intent.PLANS[action] || intent.PLANS.clarify)() };
    if (action === "build-dashboard") {
      // Two portable queries (no string aggregation, which differs between SQLite and Postgres).
      const rows = await db.all("SELECT id, topics FROM stories WHERE COALESCE(in_scope, 1) = 1 AND COALESCE(hidden, 0) = 0 ORDER BY id DESC LIMIT 500");
      const links = await db.all("SELECT l.story_id, src.name FROM story_links l JOIN sources src ON src.id = l.source_id JOIN stories s ON s.id = l.story_id WHERE COALESCE(s.in_scope, 1) = 1 ORDER BY l.story_id DESC LIMIT 3000");
      const srcBy = {}; for (const l of links) (srcBy[l.story_id] ||= []).push({ name: l.name });
      const spec = intent.dashboardSpec({ stories: rows.map((s) => ({ topics: JSON.parse(s.topics || "[]"), sources: srcBy[s.id] || [] })), topics: tagger.topicList() });
      const { catalog } = await views(); const v = catalog.validate(spec);
      out.spec = spec; out.valid = v.success; out.issues = v.success ? [] : (v.error?.issues || []).slice(0, 5).map((i) => i.message);
    }
    return out;
  }));
  app.get("/api/lab/policy", auth, wrap(async () => {
    const live = await livePolicy();
    return { about: "The live intent policy as portable si-expr JSON (runs in Node, Python, Rust, WebAssembly): the latest one applied from the Arena, or the gym's learned policy.", id: live.id, source: live.id ? "applied" : "learned", policy: live.policy, score: intent.score(live.policy) };
  }));
  app.get("/api/lab/policies", auth, wrap(async () => ({ policies: await db.all("SELECT id, accuracy, properties, note, active, created_at FROM lab_policies ORDER BY id DESC LIMIT 30") })));
  // Apply an edited policy: the server re-scores it and refuses it unless every safety property holds and held-out
  // accuracy is no worse than the live policy (the same ratchet the gym uses). Admins only.
  app.post("/api/admin/lab/policy", auth, admin, wrap(async (req) => {
    const p = req.body?.policy; if (!p || typeof p !== "object" || Array.isArray(p)) bad("Send {policy: <si-expr object>}.");
    if (JSON.stringify(p).length > 200000) bad("That policy is too large.");
    let cand; try { cand = intent.score(p); } catch (e) { bad(`The policy doesn't evaluate: ${e.message}`); }
    const live = await livePolicy(), cur = intent.score(live.policy);
    if (cand.properties < cand.of) bad(`Refused: only ${cand.properties} of ${cand.of} safety properties hold (Twitter/X and impersonation must be refused, decisions must be deterministic and case-insensitive).`);
    if (cand.accuracy < cur.accuracy) bad(`Refused by the ratchet: held-out accuracy ${cand.accuracy} is below the live policy's ${cur.accuracy}.`);
    const id = await db.tx(async (t) => { await t.run("UPDATE lab_policies SET active = 0 WHERE active = 1");
      return t.insert("INSERT INTO lab_policies (policy, accuracy, properties, note, active, created_by) VALUES (?, ?, ?, ?, 1, ?)", JSON.stringify(p), cand.accuracy, cand.properties, str(req.body?.note, 300), req.user.id); });
    return { applied: id, score: cand, previous: cur };
  }));
  // Go back to the learned policy (or to an earlier applied one).
  app.post("/api/admin/lab/policy/reset", auth, admin, wrap(async (req) => {
    const to = Number(req.body?.id) || null;
    await db.run("UPDATE lab_policies SET active = 0 WHERE active = 1");
    if (to) { if (!(await db.get("SELECT id FROM lab_policies WHERE id = ?", to))) notFound("That policy"); await db.run("UPDATE lab_policies SET active = 1 WHERE id = ?", to); }
    applied = { id: null, policy: null };
    return { active: to || "learned" };
  }));
  // Saved variants: a reader's params for an example, re-run on the server and kept for everyone to see.
  app.post("/api/lab/examples/:id/variants", auth, wrap(async (req) => {
    const id = str(req.params.id, 60); if (!L.BY_ID[id]) notFound("That example");
    const name = str(req.body?.name, 80); if (!name) bad("Give the variant a name.");
    const p = req.body?.params || {}; const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => Number.isFinite(Number(v))).slice(0, 12).map(([k, v]) => [k, Number(v)]));
    const r = runCached(id, clean);
    const vid = await db.insert("INSERT INTO lab_runs (example_id, kind, proposer, metric, value, result, created_by) VALUES (?, 'variant', 'person', ?, ?, ?, ?)",
      id, r.verdict.metric, r.verdict.variant, JSON.stringify({ name, params: r.variant.params, metrics: r.variant.metrics, verdict: r.verdict }), req.user.id);
    return { id: vid, name, params: r.variant.params, metrics: r.variant.metrics, verdict: r.verdict };
  }));
  app.get("/api/lab/examples/:id/variants", auth, wrap(async (req) => {
    const rows = await db.all("SELECT r.id, r.value, r.result, r.created_at, u.username AS by_user FROM lab_runs r LEFT JOIN users u ON u.id = r.created_by WHERE r.example_id = ? AND r.kind = 'variant' ORDER BY r.id DESC LIMIT 50", str(req.params.id, 60));
    return { variants: rows.map((r) => ({ id: r.id, value: r.value, by: r.by_user, created_at: r.created_at, ...JSON.parse(r.result || "{}") })) };
  }));
};
