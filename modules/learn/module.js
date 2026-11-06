// Learn: superintelligence concepts in plain words, mapped as a graph and linked to stories in the feed,
// the "how it works" teardown of the pipeline, and an admin queue for background work
// (blog/Substack drafts, explainer videos, Lean 4 proofs, paper-to-code, reverse-engineering).
// Free tier: the server never runs the heavy jobs. It stores them; scripts/learn-worker.js (local or CI) and agents do the work.
module.exports = {
  id: "learn",
  version: "0.1.0",
  description: "Concept graph with plain-language explanations and analogies, pipeline teardown, explainer player and an admin job queue.",
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS learn_jobs (id \${ID}, kind TEXT NOT NULL, concept_id TEXT, story_id INTEGER REFERENCES stories(id) ON DELETE SET NULL,
  note TEXT DEFAULT '', status TEXT DEFAULT 'queued', output TEXT DEFAULT '', files TEXT DEFAULT '[]', error TEXT DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT \${T}, updated_at TEXT DEFAULT \${T}, published_at TEXT);
CREATE INDEX IF NOT EXISTS idx_learn_jobs_status ON learn_jobs(status, id);
`);
    // Keep the queue small: finished jobs that were never published go after 60 days.
    ctx.point("db.schema").addPrune(async (db) => {
      const cut = new Date(Date.now() - 60 * 864e5).toISOString();
      await db.run("DELETE FROM learn_jobs WHERE status IN ('done','failed','needs-agent') AND published_at IS NULL AND updated_at < ?", cut);
    });
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/learn", label: "Learn", order: 18 });
  },
};
