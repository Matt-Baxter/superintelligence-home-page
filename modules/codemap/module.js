// Codebase map: the repo as a graph (pages → routes → tables, modules → extension points, spec REQs → code → tests),
// drawn on /m/codemap and queryable by agents (MCP tool codemap_query, `npm run codemap -- <question>`).
// Developer tooling: it reads source files, so it's admins only, and the graph is built at build time.
const fs = require("node:fs"), path = require("node:path");
const DATA = path.join(__dirname, "data", "codemap.json");

let cache = null;
function graph() {
  if (cache) return cache;
  cache = fs.existsSync(DATA) && process.env.VERCEL ? JSON.parse(fs.readFileSync(DATA, "utf8")) : require("./scan").build();
  return cache;
}

module.exports = {
  id: "codemap",
  version: "0.1.0",
  description: "Codebase map: a graph of pages, routes, tables, modules, extension points, blocks, spec requirements and tests, with tracing and search.",
  setup(ctx) {
    ctx.point("http.routes").add((app, { auth, admin, wrap, str, bad }) => {
      const scan = require("./scan");
      app.get("/api/codemap", auth, admin, wrap((req) => { if (req.query.fresh === "1") cache = null; return graph(); }));
      app.get("/api/codemap/trace", auth, admin, wrap((req) => { const id = str(req.query.id, 200); if (!id) bad("Give a node id."); return { id, nodes: scan.trace(graph(), id, Number(req.query.depth) || 4) }; }));
      app.get("/api/codemap/ask", auth, admin, wrap((req) => ({ q: str(req.query.q, 200), answer: scan.answer(graph(), req.query.q) })));
    });
    ctx.point("ui.nav").add({ href: "/m/codemap", label: "Map", admin: true, order: 88 });
  },
  DATA,
};
