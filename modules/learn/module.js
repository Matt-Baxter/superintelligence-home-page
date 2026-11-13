// Learn: superintelligence concepts in plain words, mapped as a graph and linked to stories in the feed,
// the "how it works" teardown of the pipeline, and an admin queue for background work
// (blog/Substack drafts, explainer videos, Lean 4 proofs, paper-to-code, reverse-engineering).
// Free tier: the server never runs the heavy jobs. It stores them; scripts/learn-worker.js (local or CI) and agents do the work.
module.exports = {
  id: "learn",
  version: "0.1.0",
  description: "Concept graph with plain-language explanations and analogies, pipeline teardown, explainer player and an admin job queue.",
  // The concept graph, for other modules (the map and dossiers link stories and papers to concepts).
  register(env) {
    env.registerExtensionPoint("learn.concepts", () => ({ list: () => require("./data/concepts.json").concepts || [] }));
  },
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
    // Concepts become tags too: concept:<id>, with the words that matched.
    ctx.point("knowledge.taggers").add({ id: "concepts", namespace: "concept", about: "Learn concepts (modules/learn/data/concepts.json terms)",
      tag: (text) => require("./learn").conceptsIn(text).map((c) => ({ qid: `concept:${c.id}`, label: c.name, matched: c.matched, method: "concept-term" })),
      // Curated links for the knowledge graph: each concept is about a topic, plus the concept-to-concept relations.
      edges: () => require("./learn").DATA.concepts.flatMap((c) => [{ src: `concept:${c.id}`, rel: "about", dst: `topic:${c.topic}`, weight: 1, evidence: ["modules/learn/data/concepts.json"] },
        ...(c.relations || []).map((r) => ({ src: `concept:${c.id}`, rel: r.kind, dst: `concept:${r.to}`, weight: 1, evidence: ["modules/learn/data/concepts.json"] }))]) });
    ctx.point("knowledge.taggers").add({id:"glossary",namespace:"term",about:"Sourced term and symbol mentions; not verified claims",tag:text=>require("./glossary").tag(text),edges:()=>require("./glossary").edges()});
    ctx.point("ui.nav").add({href:"/m/glossary",label:"Glossary",order:19,group:"research"});
    ctx.point("ui.nav").add({ href: "/m/learn", label: "Learn", order: 18, group: "research" });
  },
};
