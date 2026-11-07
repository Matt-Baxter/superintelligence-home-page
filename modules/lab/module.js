// Lab: superintelligence ideas -> our own toy reproductions -> our hypotheses, with recursive self-improvement at the
// centre (a decision gym whose policies are portable si-expr trees, and an autoresearch ratchet). Deterministic runs
// take milliseconds, so the server can show them; anything that calls a model runs in the worker (npm run lab).
module.exports = {
  id: "lab",
  version: "0.1.0",
  description: "Idea -> reproduction -> hypothesis experiments (recursive self-improvement, Goodhart, weak-to-strong, scaling), a self-improving decision gym, intent routing and an autoresearch ratchet.",
  requires: ["decision"],
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS lab_runs (id \${ID}, example_id TEXT NOT NULL, kind TEXT NOT NULL, proposer TEXT DEFAULT 'deterministic', metric TEXT DEFAULT '',
  value REAL, result TEXT DEFAULT '{}', created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT \${T});
CREATE INDEX IF NOT EXISTS idx_lab_runs_example ON lab_runs(example_id, id);
`);
    ctx.point("db.schema").addPrune(async (db) => { await db.run("DELETE FROM lab_runs WHERE id NOT IN (SELECT id FROM lab_runs ORDER BY id DESC LIMIT 500)"); });
    const weighted = ctx.point("decision.judges").weighted; // shared judge arithmetic, used without importing the decision module
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, { ...deps, weighted }));
    ctx.point("ui.nav").add({ href: "/m/lab", label: "Lab", order: 19 });
  },
};
