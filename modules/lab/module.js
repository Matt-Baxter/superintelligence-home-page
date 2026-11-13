// Lab: superintelligence ideas -> our own toy reproductions -> our hypotheses, with recursive self-improvement at the
// centre (a decision gym whose policies are portable si-expr trees, and an autoresearch ratchet). Deterministic runs
// take milliseconds, so the server can show them; anything that calls a model runs in the worker (npm run lab).
module.exports = {
  id: "lab",
  version: "0.1.0",
  description: "Idea -> reproduction -> hypothesis experiments (recursive self-improvement, Goodhart, weak-to-strong, scaling), a self-improving decision gym, intent routing and an autoresearch ratchet.",
  requires: ["decision"],
  // Lab examples that have a precomputed result, with their verdict, for other modules' dossiers.
  register(env) {
    env.registerExtensionPoint("lab.examples", () => ({
      list: () => { try { const L = require("./lab"), pre = require("./results.json").results; return L.EX.examples.filter((e) => pre[e.id]).map((e) => ({ ...e, verdict: pre[e.id].verdict })); } catch { return []; } },
    }));
  },
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS lab_runs (id \${ID}, example_id TEXT NOT NULL, kind TEXT NOT NULL, proposer TEXT DEFAULT 'deterministic', metric TEXT DEFAULT '',
  value REAL, result TEXT DEFAULT '{}', created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT \${T});
CREATE INDEX IF NOT EXISTS idx_lab_runs_example ON lab_runs(example_id, id);
CREATE TABLE IF NOT EXISTS lab_policies (id \${ID}, policy TEXT NOT NULL, accuracy REAL NOT NULL, properties INTEGER NOT NULL, note TEXT DEFAULT '',
  active INTEGER DEFAULT 0, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT \${T});
`);
    ctx.point("db.schema").addPrune(async (db) => {
      await db.run("DELETE FROM lab_runs WHERE kind <> 'variant' AND id NOT IN (SELECT id FROM lab_runs ORDER BY id DESC LIMIT 500)");
      await db.run("DELETE FROM lab_policies WHERE active = 0 AND id NOT IN (SELECT id FROM lab_policies ORDER BY id DESC LIMIT 50)");
    });
    const weighted = ctx.point("decision.judges").weighted; // shared judge arithmetic, used without importing the decision module
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, { ...deps, weighted }));
    ctx.point("ui.nav").add({ href: "/m/lab", label: "Lab", order: 19 });
    ctx.point("ui.nav").add({ href: "/m/arena", label: "Arena", order: 20 });
  },
};
