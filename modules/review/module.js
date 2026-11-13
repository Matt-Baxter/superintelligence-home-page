// Review desk: paste a paper, article or comment about superintelligence (or give an arXiv id), and it is tagged,
// judged by three explainable judges behind anti-gaming guards, stress-tested by an adversary, and catalogued in the
// knowledge graph as doc:<hash> with about / mentions / explains / evaluates-on edges. A person can agree or disagree
// with each verdict; those labels are the judge's calibration metric. Extended profile only; deterministic, no model calls.
module.exports = {
  id: "review",
  version: "0.1.0",
  description: "Ingest and judge papers, articles and comments (significance, rigor, hype, anti-Goodhart guards, adversarial stress test), a superintelligence map, and a catalog in the knowledge graph.",
  requires: ["knowledge"],
  // What other modules may use from the review desk, without importing its files: the judge and its published
  // criteria, outlet grades and track records, and topic dossiers (the research layer reads these).
  register(env) {
    env.registerExtensionPoint("review.judge", () => ({ ...require("./review"), sources: require("./sources"), dossier: require("./dossier") }));
  },
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS review_docs (id \${ID}, qid TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, title TEXT NOT NULL, authors TEXT DEFAULT '',
  url TEXT DEFAULT '', excerpt TEXT DEFAULT '', score INTEGER NOT NULL, naive INTEGER NOT NULL, credibility INTEGER NOT NULL,
  verdict TEXT NOT NULL, needs_person INTEGER DEFAULT 0, result TEXT DEFAULT '{}', label TEXT, label_note TEXT DEFAULT '',
  labelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT DEFAULT \${T});
CREATE INDEX IF NOT EXISTS idx_review_docs_created ON review_docs(id);
CREATE TABLE IF NOT EXISTS review_events (id \${ID}, qid TEXT NOT NULL UNIQUE, doc_qid TEXT NOT NULL, outlet TEXT NOT NULL, outlet_label TEXT DEFAULT '',
  sentence TEXT NOT NULL, due TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', note TEXT DEFAULT '',
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, resolved_at TEXT, created_at TEXT DEFAULT \${T});
CREATE INDEX IF NOT EXISTS idx_review_events_outlet ON review_events(outlet);
CREATE TABLE IF NOT EXISTS review_blind (id \${ID}, doc_id INTEGER NOT NULL REFERENCES review_docs(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, credible TEXT NOT NULL, unmasked INTEGER DEFAULT 0, note TEXT DEFAULT '',
  created_at TEXT DEFAULT \${T}, UNIQUE (doc_id, user_id));
CREATE INDEX IF NOT EXISTS idx_review_blind_user ON review_blind(user_id);
`);
    // A probability the forecast states (0 to 1), Brier-scored once resolved.
    ctx.point("db.schema").addColumns([["review_events", "probability", "REAL"]]);
    // Free tier: keep the newest 1,000 reviews, and drop graph edges of reviews that are gone.
    ctx.point("db.schema").addPrune(async (db) => {
      await db.run("DELETE FROM review_docs WHERE id NOT IN (SELECT id FROM review_docs ORDER BY id DESC LIMIT 1000)");
      await db.run("DELETE FROM knowledge_edges WHERE src LIKE 'doc:%' AND src NOT IN (SELECT qid FROM review_docs)");
      await db.run("DELETE FROM review_events WHERE doc_qid NOT IN (SELECT qid FROM review_docs)");
      await db.run("DELETE FROM review_blind WHERE doc_id NOT IN (SELECT id FROM review_docs)");
      await db.run("DELETE FROM knowledge_edges WHERE src LIKE 'event:%' AND src NOT IN (SELECT qid FROM review_events)");
    });
    // Lab examples and Learn concepts enrich the dossiers and the map when those modules are on; null when they're off.
    const lab = ctx.optional("lab.examples"), learn = ctx.optional("learn.concepts");
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, { ...deps, labExamples: () => (lab ? lab.list() : []), concepts: () => (learn ? learn.list() : []) }));
    ctx.point("meta.actions").add(require("./actions"));
    ctx.point("ui.nav").add({ href: "/m/review", label: "Review", order: 21 });
    ctx.point("ui.nav").add({ href: "/m/labels", label: "Label", order: 22, admin: true });
    ctx.point("ui.nav").add({ href: "/m/map", label: "Map", order: 17 });
  },
};
