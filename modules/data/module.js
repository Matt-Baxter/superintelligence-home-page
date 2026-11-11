// Data layer (REQ-061..REQ-063, proposed, openspec/changes/add-data-layer-and-builders; extended version only).
// Owns two extension points other modules contribute to:
//   data.sources  add(id, { about, params, access: public|user|admin, guard?, run(params, ctx) })   named reads
//   data.actions  add(id, { about, input, access: user|admin, guard?, refresh?, run(input, ctx) })  named writes
// plus versioned artifacts and the knowledge graph store. Routes: /api/data/*.
const reg = require("./registry");
module.exports = {
  id: "data",
  version: "0.1.0",
  description: "Named sources and actions with permissions and audit, versioned artifacts, and an RDF knowledge graph (oxilite or Oxigraph).",
  register({ registerExtensionPoint }) {
    reg.sources.clear(); reg.actions.clear(); // a new kernel starts with an empty registry
    registerExtensionPoint("data.sources", (mod) => ({ add: (id, def) => reg.add(reg.sources, "source", mod, id, def) }));
    registerExtensionPoint("data.actions", (mod) => ({ add: (id, def) => reg.add(reg.actions, "action", mod, id, def) }));
  },
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS data_artifacts (id \${ID}, kind TEXT NOT NULL, akey TEXT NOT NULL, title TEXT DEFAULT '', current_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT \${T}, updated_at TEXT DEFAULT \${T}, UNIQUE (kind, akey));
CREATE TABLE IF NOT EXISTS data_artifact_versions (artifact_id INTEGER NOT NULL REFERENCES data_artifacts(id) ON DELETE CASCADE, version INTEGER NOT NULL,
  body TEXT NOT NULL, files TEXT DEFAULT '[]', note TEXT DEFAULT '', actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, at TEXT DEFAULT \${T},
  PRIMARY KEY (artifact_id, version));
CREATE TABLE IF NOT EXISTS data_kg_snapshots (name TEXT PRIMARY KEY, nquads TEXT NOT NULL, triples INTEGER DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT \${T});`);
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/data", label: "Data and graph", admin: true, order: 90 });
    // Built-in sources and actions.
    ctx.point("data.sources").add("data.artifacts", { about: "Artifacts, newest first: { kind? }", params: { kind: { type: "string", max: 60 } }, access: "admin", run: (p, c) => c.artifacts.list(p.kind) });
    ctx.point("data.sources").add("data.artifact", { about: "One artifact's version (the current one unless version is given) and its history.", params: { kind: { type: "string", required: true, max: 60 }, key: { type: "string", required: true, max: 200 }, version: { type: "integer", min: 1 } }, access: "admin",
      run: async (p, c) => { const a = await c.artifacts.get(p.kind, p.key, p.version); if (!a) c.notFound("That artifact"); return { ...a, history: await c.artifacts.history(p.kind, p.key) }; } });
    ctx.point("data.sources").add("data.sparql", { about: "Run a read-only SPARQL query (SELECT, ASK, CONSTRUCT, DESCRIBE) on the knowledge graph.", params: { query: { type: "string", required: true, max: 8000 } }, access: "admin", run: (p, c) => c.kg.query(p.query) });
    ctx.point("data.sources").add("data.graph-info", { about: "Which graph engine runs here, whether it persists, and its size.", params: {}, access: "admin", run: (p, c) => c.kg.info() });
    ctx.point("data.actions").add("data.restore", { about: "Restore an earlier version of an artifact as a new version.", input: { kind: { type: "string", required: true, max: 60 }, key: { type: "string", required: true, max: 200 }, version: { type: "integer", required: true, min: 1 } }, access: "admin",
      run: (i, c) => c.artifacts.restore(i.kind, i.key, i.version, c.user.id) });
  },
};
