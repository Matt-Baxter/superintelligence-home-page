#!/usr/bin/env node
// Codebase map CLI.
//   node scripts/codemap.js build          write modules/codemap/data/codemap.json (npm run build does this)
//   node scripts/codemap.js check          fail if a page calls an API route that doesn't exist (preflight runs this)
//   node scripts/codemap.js <question>     answer from the map, e.g. "votes", "REQ-003", "POST /api/lists"
const fs = require("node:fs"), path = require("node:path");
const scan = require("../modules/codemap/scan");
const [cmd, ...rest] = process.argv.slice(2);
const g = scan.build();
if (cmd === "build") {
  const out = path.join(__dirname, "..", "modules", "codemap", "data"); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "codemap.json"), JSON.stringify(g));
  console.log(`codemap: ${Object.entries(g.counts).map(([k, v]) => `${v} ${k}s`).join(", ")}; ${g.edges.length} edges`);
} else if (cmd === "check") {
  if (g.problems.length) { console.error(g.problems.map((p) => "  - " + p.message).join("\n")); process.exit(1); }
  console.log(`${g.counts.page} pages, ${g.counts.route} routes, ${g.counts.table} tables; every page call has a route`);
} else if (cmd) {
  const a = scan.answer(g, [cmd, ...rest].join(" "));
  if (!a.length) { console.log("Nothing in the map matches. Try a table, route, page, module or REQ id."); process.exit(0); }
  for (const n of a) console.log(`\n${n.id}${n.where ? `  (${n.where})` : ""}${n.detail ? `\n  ${n.detail.slice(0, 160)}` : ""}\n${n.links.map((l) => "  " + l).join("\n")}`);
} else { console.log("usage: node scripts/codemap.js build | check | <question>"); process.exit(1); }
