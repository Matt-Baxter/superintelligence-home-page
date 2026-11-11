// The system as a graph (REQ-065..REQ-067, proposed; openspec/changes/add-graph-model-and-flywheel; extended only):
// the app graph with SHACL shapes, DAG checks, quantified path patterns and A*, and the learning flywheel. Exposed
// as data sources and an action on the data layer; the slow evolutionary loop runs from the command line only
// (npm run graph -- evolve).
const fs = require("node:fs"), path = require("node:path");
let cache = null;
function app() {
  if (cache) return cache;
  const G = require("./appgraph"), Sh = require("./shacl"), A = require("./algorithms");
  const g = G.build(), shapes = Sh.loadShapes(fs.readFileSync(path.join(__dirname, "shapes.ttl"), "utf8"));
  return (cache = { g, shapes, G, Sh, A, validation: Sh.validate(shapes, G.triples(g)) });
}
const ID = { type: "string", required: true, max: 200 };
module.exports = {
  id: "graph",
  version: "0.1.0",
  description: "The system as a typed graph with SHACL shapes, DAG checks, quantified path patterns, A* and the learning flywheel.",
  requires: ["data", "responses"],
  setup(ctx) {
    const S = ctx.point("data.sources"), Ac = ctx.point("data.actions");
    S.add("graph.summary", { about: "Nodes and edges of the app graph by type, whether module dependencies form a DAG, and SHACL conformance.", params: {}, access: "admin",
      run: () => { const { g, A, validation } = app(), by = {}; for (const n of g.nodes) by[n.type] = (by[n.type] || 0) + 1; const rel = {}; for (const e of g.edges) rel[e.p] = (rel[e.p] || 0) + 1; const d = A.dag(g, "requires");
        return { nodes: g.nodes.length, edges: g.edges.length, byType: by, byRelation: rel, requiresIsDag: d.dag, order: d.order || null, cycle: d.cycle || null, conforms: validation.conforms, violations: validation.results.length }; } });
    S.add("graph.validate", { about: "SHACL violations of the app graph (shape, node, path, message).", params: {}, access: "admin", run: () => app().validation.results });
    S.add("graph.paths", { about: "Quantified path pattern: paths from start following rel (or ^rel backwards) between min and max hops, optionally ending at a node type.",
      params: { start: ID, rel: { type: "string", required: true, max: 60 }, min: { type: "integer", min: 0, max: 6, default: 1 }, max: { type: "integer", min: 1, max: 6, default: 3 }, endType: { type: "string", max: 40 } }, access: "admin",
      run: (p) => { const { g, A } = app(); return A.qpp(g, { start: p.start, rel: p.rel.split(","), min: p.min, max: p.max, end: (n) => !p.endType || n.type === p.endType, limit: 200 }); } });
    S.add("graph.route", { about: "Shortest path between two elements of the app graph (A* with landmarks; the same length as BFS).", params: { from: ID, to: ID }, access: "admin",
      run: (p) => { const { g, A } = app(); return A.astar(g, p.from, p.to); } });
    S.add("graph.flywheel", { about: "Each learning's stage (recorded, ruled, validated, recalled) and recall by mutation.", params: {}, access: "admin",
      run: () => { const F = require("./flywheel"), r = F.recall(), recalled = new Set(r.results.filter((x) => x.recalled).map((x) => x.learning)); return { stages: F.stages(undefined, { recalled }), recall: r }; } });
    Ac.add("graph.export", { about: "Write the app graph into the knowledge graph (named graph urn:si:app), replacing the previous export.", input: {}, access: "admin",
      run: async (i, c) => { cache = null; const { g, G } = app(); return c.kg.replaceGraph("urn:si:app", G.triples(g)); } });
  },
};
