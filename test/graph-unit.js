#!/usr/bin/env node
// App graph, SHACL shapes, DAG, quantified path patterns, A* and the learning flywheel (proposed REQ-065..REQ-067,
// openspec/changes/add-graph-model-and-flywheel). Sample cases are synthetic and labelled test data.
const fs = require("node:fs"), path = require("node:path");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
process.env.SITE_PROFILE = "extended";
const G = require("../modules/graph/appgraph"), Sh = require("../modules/graph/shacl"), A = require("../modules/graph/algorithms"), F = require("../modules/graph/flywheel"), KG = require("../modules/data/kg");
const shapes = Sh.loadShapes(fs.readFileSync(path.join(__dirname, "..", "modules", "graph", "shapes.ttl"), "utf8"));

console.log("REQ-065: the system as a typed graph, checked by shapes");
const g = G.build(), by = {}; for (const n of g.nodes) by[n.type] = (by[n.type] || 0) + 1;
ok(G.TYPES.every((t) => by[t] > 0), `every node type is present (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")})`);
const req061 = g.edges.filter((e) => e.s === "requirement:007-REQ-061");
ok(req061.some((e) => e.p === "tracedTo" && e.o === "module:data") && req061.some((e) => e.p === "checkedBy"), "a requirement's trace becomes tracedTo and checkedBy edges");
const v = Sh.validate(shapes, G.triples(g));
ok(v.conforms, `the real app graph conforms to ${shapes.length} shapes${v.conforms ? "" : `: ${v.results.slice(0, 3).map((x) => x.message).join("; ")}`}`);
const I = (s) => KG.iri(`urn:si:app:${s}`), si = KG.si, A_ = KG.A;
const bad = [
  `${I("learning:LX")} ${A_} ${si("Learning")} .`, `${I("learning:LX")} ${si("cause")} ${KG.lit("Sample cause (test data)")} .`,
  `${I("module:Bad_Name")} ${A_} ${si("Module")} .`, `${I("module:Bad_Name")} ${KG.LABEL} ${KG.lit("Bad_Name")} .`,
  `${I("action:sample.open")} ${A_} ${si("Action")} .`, `${I("action:sample.open")} ${si("access")} ${KG.lit("public")} .`,
];
const vb = Sh.validate(shapes, bad), msg = vb.results.map((x) => `${x.focus.split(":").slice(-2).join(":")} ${x.path.split("#").pop()}`);
ok(!vb.conforms && msg.includes("learning:LX fix") && msg.includes("learning:LX guardedBy") && msg.includes("module:Bad_Name label") && msg.includes("action:sample.open access") && msg.includes("action:sample.open about"), `Sample violations are each reported (${vb.results.length}: ${msg.join(", ")})`);

console.log("REQ-066: DAG, quantified path patterns, A*");
const d = A.dag(g, "requires");
ok(d.dag && d.order.indexOf("module:responses") < d.order.indexOf("module:data"), "module requirements form a DAG, dependents before what they need");
const cyc = A.dag({ nodes: [], edges: [{ s: "a", p: "requires", o: "b" }, { s: "b", p: "requires", o: "a" }, { s: "c", p: "requires", o: "a" }] }, "requires");
ok(!cyc.dag && cyc.cycle.join(" → ") === "a → b → a", `a Sample cycle is found and named (${cyc.cycle.join(" → ")})`);
const paths = A.qpp(g, { start: "module:responses", rel: "requires", min: 2, max: 3 });
const allReq = paths.every((p) => p.slice(1).every((n, i) => g.edges.some((e) => e.s === p[i] && e.p === "requires" && e.o === n)));
ok(paths.length > 0 && paths.every((p) => p.length - 1 >= 2 && p.length - 1 <= 3) && allReq, `paths of 2 to 3 requires hops, only requires edges (${paths.length})`);
ok(A.qpp(g, { start: "learning:L4", rel: ["guardedBy", "^guardedBy"], min: 1, max: 1 })[0].join() === "learning:L4,check:qa:calibration", "a backwards hop (^rel) and a forwards one can be mixed");
const ids = g.nodes.map((n) => n.id), r = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(7); let same = 0, fewer = 0, tries = 0;
for (let i = 0; i < 25; i++) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)], x = A.astar(g, a, b), y = A.bfs(g, a, b); tries++; if ((x.path && x.path.length) === (y.path && y.path.length)) same++; if (x.expanded <= y.expanded) fewer++; }
ok(same === tries, `A* finds paths as short as BFS on ${tries} random pairs`);
ok(fewer >= Math.floor(tries * 0.8), `...expanding no more nodes in ${fewer} of ${tries} cases`);

console.log("REQ-067: the learning flywheel");
const rc = F.recall();
ok(rc.n >= 5 && rc.ok === rc.n && rc.results.every((x) => x.caughtBad && x.passedGood), `recall by mutation catches every QA-guarded learning and passes every corrected case (${rc.ok} of ${rc.n})`);
const recalled = new Set(rc.results.filter((x) => x.recalled).map((x) => x.learning)), st = F.stages(undefined, { recalled });
ok(st.length === require("../modules/responses/learnings.json").learnings.length && st.every((s) => ["recalled", "validated"].includes(s.stage)), `every learning is validated or recalled (${st.filter((s) => s.stage === "recalled").length} recalled)`);
const e = F.evolve({ population: 4, generations: 4, patience: 2, maxEpisodes: 3000 });
ok(e.history.length >= 1 && e.best && typeof e.best.gap === "number" && /plateau|overtraining|ran all/.test(e.reason) && e.handSet && /proposal/.test(e.note), `the evolutionary loop reports its stop (${e.reason}), train ${e.best.train} vs held-out ${e.best.heldout}`);
const e2 = F.evolve({ population: 4, generations: 4, patience: 2, maxEpisodes: 3000, gapStop: -10 });
ok(/overtraining/.test(e2.reason) && e2.history.length === 1, "a gap over the threshold stops the loop as overtraining");
console.log(`\ngraph unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
