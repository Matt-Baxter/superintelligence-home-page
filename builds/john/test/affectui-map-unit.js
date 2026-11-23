// Guard: the background affectUI map only points at parts that exist (blocks, intents, decision models, pages),
// and the saved map still matches the rules in scripts/affectui-map.js.
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, "..");
const map = require("../docs/affectui-map.json");
const { classify, INTENTS, DECISION, SURFACES } = require("../scripts/affectui-map");
const { PLANS } = require("../modules/lab/intent");
let failed = 0, n = 0; const ok = (c, m) => { n++; if (!c) { failed++; console.log(`FAIL ${m}`); } };

for (const i of INTENTS.filter((i) => i !== "clarify")) ok(PLANS[i], `intent ${i} has a plan in modules/lab/intent.js`);
for (const d of DECISION) ok(fs.existsSync(path.join(root, "modules/decision/blocks", d)), `decision model ${d} is a block`);
const pages = new Set([...fs.readdirSync(path.join(root, "public")), ...fs.readdirSync(path.join(root, "modules")).flatMap((m) => { const p = path.join(root, "modules", m, "pages"); return fs.existsSync(p) ? fs.readdirSync(p) : []; }).map((f) => `m/${f.replace(/\.html$/, "")}`)]);
for (const [k, text] of Object.entries(SURFACES)) for (const [, href] of text.matchAll(/(?:\(|, )(\/[\w./-]*)/g)) {
  const p = href.replace(/^\//, ""); ok(p === "" || pages.has(p), `surface ${k} links a real page: ${href}`);
}
const blocks = new Set(["modules/blocks-core/blocks", "modules/decision/blocks"].flatMap((d) => fs.readdirSync(path.join(root, d))));
const ids = new Set();
for (const e of map.entries) {
  ok(!ids.has(`${e.kit}/${e.name}`), `no duplicate entry ${e.kit}/${e.name}`); ids.add(`${e.kit}/${e.name}`);
  ok(SURFACES[e.surface], `${e.name} maps to a known surface`);
  ok(!e.intent || INTENTS.includes(e.intent), `${e.name} maps to a known intent`);
  ok(!e.decision || DECISION.includes(e.decision), `${e.name} maps to a known decision model`);
  if (e.blockStatus === "existing") ok(blocks.has(e.block), `${e.name} -> existing block ${e.block}`);
  if (e.blockStatus === "proposed") ok(!blocks.has(e.block), `${e.name} -> ${e.block} is marked proposed but already exists; regenerate the map`);
  const t = classify(e.kit, e.name); ok(t.surface === e.surface && t.use === e.use, `${e.name} matches the current rules; regenerate with npm run map:affectui`);
}
ok(map.entries.length === map.totals.assets, "totals match the entries");
ok(map.entries.every((e) => e.surface !== "reference" || e.use === "reference"), "reference assets are never placed on reader surfaces");

if (failed) { console.error(`affectUI map: ${failed} of ${n} failed`); process.exit(1); }
console.log(`affectUI map: ${n} passed, 0 failed; ${map.totals.assets} assets, ${map.totals.byUse.block} as blocks, ${map.totals.byUse.reference} reference only`);
