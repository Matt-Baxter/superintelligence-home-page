#!/usr/bin/env node
// The app graph and the learning flywheel from the command line (REQ-065..REQ-067, proposed).
//   npm run graph -- report      out/graph/report.md: counts, DAG, SHACL, discovery paths, flywheel stages and recall
//   npm run graph -- evolve      the evolutionary loop with its overtraining stop (about 20 s); proposes, never adopts
const fs = require("node:fs"), path = require("node:path");
const G = require("../modules/graph/appgraph"), Sh = require("../modules/graph/shacl"), A = require("../modules/graph/algorithms"), F = require("../modules/graph/flywheel");
const cmd = process.argv[2] || "report", out = path.join(__dirname, "..", "out", "graph"); fs.mkdirSync(out, { recursive: true });
if (cmd === "evolve") {
  const e = F.evolve({});
  console.log(`evolve: ${e.reason}; best at generation ${e.generationsToPlateau}: train ${e.best.train}, held-out ${e.best.heldout}, gap ${e.best.gap}; hand-set values: train ${e.handSet.train}, held-out ${e.handSet.heldout} (${e.seconds} s)`);
  fs.writeFileSync(path.join(out, "evolve.json"), JSON.stringify(e, null, 2)); process.exit(0);
}
const g = G.build(), shapes = Sh.loadShapes(fs.readFileSync(path.join(__dirname, "..", "modules", "graph", "shapes.ttl"), "utf8")), v = Sh.validate(shapes, G.triples(g));
const by = {}; for (const n of g.nodes) by[n.type] = (by[n.type] || 0) + 1;
const d = A.dag(g, "requires"), r = F.recall(), recalled = new Set(r.results.filter((x) => x.recalled).map((x) => x.learning)), st = F.stages(undefined, { recalled });
const isolated = g.nodes.filter((n) => !g.edges.some((e) => e.s === n.id || e.o === n.id)).map((n) => n.id);
const unguarded = g.nodes.filter((n) => n.type === "Requirement" && !g.edges.some((e) => e.s === n.id && e.p === "checkedBy")).map((n) => n.label);
const L = [`# App graph and flywheel report`, "", `${g.nodes.length} nodes, ${g.edges.length} edges. ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")}.`, "",
  `**Module dependencies:** ${d.dag ? `a DAG; load order ${[...d.order].reverse().join(" → ")}` : `a cycle: ${d.cycle.join(" → ")}`}.`, "",
  `**SHACL:** ${v.conforms ? "conforms" : `${v.results.length} violations`} (${shapes.length} shapes).`, ...v.results.slice(0, 30).map((x) => `- ${x.focus} ${x.path}: ${x.message}`), "",
  "## Discovery paths", "", "Isolated tables are written by helper modules the code map doesn't follow (it reads SQL inside route handlers), so they show where the map is blind as much as where the code is unused.", "", `- Elements connected to nothing: ${isolated.length ? isolated.join(", ") : "none"}.`, `- Requirements without a check: ${unguarded.length ? unguarded.join(", ") : "none"}.`, "",
  "## Flywheel", "", `Recall by mutation: ${r.ok} of ${r.n} QA-guarded learnings caught (${Math.round(r.recall * 100)}%).`, "", "| Learning | Stage | Guard |", "| --- | --- | --- |", ...st.map((s) => `| ${s.id} | ${s.stage} | ${s.guard} |`), ""];
fs.writeFileSync(path.join(out, "report.md"), L.join("\n"));
console.log(`graph: ${g.nodes.length} nodes, ${g.edges.length} edges; DAG ${d.dag}; SHACL ${v.conforms ? "conforms" : `${v.results.length} violations`}; recall ${r.ok}/${r.n}; ${isolated.length} isolated elements -> out/graph/report.md`);
