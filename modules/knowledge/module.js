// Knowledge: chunks, chunk tags, embeddings and a knowledge graph of qualified ids, plus the JSON-RPC endpoint
// described by schema/gen/openrpc.json. Extended profile only. Nothing runs on a timer: an admin builds the index
// (POST /api/admin/knowledge/build, or npm run knowledge:build), which only redoes chunks whose text changed.
module.exports = {
  id: "knowledge",
  version: "0.1.0",
  description: "Chunked stories tagged by every registered tagger, local embeddings, a co-occurrence and curated knowledge graph, JSON-LD export and a JSON-RPC endpoint.",
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS knowledge_chunks (story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE, ord INTEGER NOT NULL,
  text TEXT NOT NULL, hash TEXT NOT NULL, tags TEXT DEFAULT '[]', model TEXT DEFAULT '', vector TEXT DEFAULT '[]', updated_at TEXT DEFAULT \${T},
  PRIMARY KEY (story_id, ord));
CREATE TABLE IF NOT EXISTS knowledge_edges (src TEXT NOT NULL, rel TEXT NOT NULL, dst TEXT NOT NULL, weight REAL DEFAULT 1, evidence TEXT DEFAULT '[]',
  updated_at TEXT DEFAULT \${T}, PRIMARY KEY (src, rel, dst));
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_dst ON knowledge_edges(dst);
`);
    // Free tier: keep chunks for the newest 2,000 stories only.
    ctx.point("db.schema").addPrune(async (db) => {
      await db.run("DELETE FROM knowledge_chunks WHERE story_id NOT IN (SELECT id FROM stories ORDER BY id DESC LIMIT 2000)");
    });
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/knowledge", label: "Knowledge", admin: true, order: 86 });
  },
};
