#!/usr/bin/env node
// The research map of Anthropic and Goodfire work (modules/knowledge/data/research-map.json, research.js): grounded in
// the ontology, links resolve, no Twitter/X, no copied numbers, deterministic. REQ-023.
const D = require("../modules/knowledge/data/research-map.json"), M = require("../modules/knowledge/research");
const { ontology } = require("../lib/tagger"), concepts = new Set(require("../modules/learn/data/concepts.json").concepts.map((c) => c.id));
const topics = new Set(ontology.topics.map((t) => t.id)), KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const it = D.items, ids = new Set(it.map((x) => x.id));
ok(D.version && it.length >= 40 && ids.size === it.length && it.every((x) => KEBAB.test(x.id)), `${it.length} items with unique kebab-case ids and a version`);
ok(it.every((x) => ["anthropic", "goodfire", "anthropic+goodfire"].includes(x.org)) && ontology.organizations.some((o) => o.id === "goodfire") && ontology.organizations.some((o) => o.id === "anthropic"), "both organisations are ontology organisations");
ok(it.every((x) => /^https:\/\//.test(x.url) && !/(^|\.)(x|twitter)\.com\/|nitter/i.test(x.url)), "every link is https and none is Twitter/X");
ok(it.every((x) => /^20(2[3-6])-\d{2}(-\d{2})?$/.test(x.published)), "every item has a 2023-2026 date");
ok(it.every((x) => x.topics.length && x.topics.every((t) => topics.has(t))), "every topic is an ontology topic");
ok(it.every((x) => x.concepts.every((c) => concepts.has(c))), "every concept is a Learn concept");
ok(it.every((x) => (x.builds_on || []).every((b) => ids.has(b) && b !== x.id)), "every builds-on link points at another item in the map");
ok(it.every((x) => !/\d+(\.\d+)?\s?%/.test(x.summary)), "summaries copy no percentages from the papers");
const a = M.build(), b = (delete require.cache[require.resolve("../modules/knowledge/research")], require("../modules/knowledge/research").build());
ok(JSON.stringify(a) === JSON.stringify(b), "same data, same map (deterministic)");
ok(a.items.every((x) => x.si && x.si.dimensions.length === 8 && x.si.dimensions.every((d) => d.level === d.why.reduce((s, w) => s + w.points, 0))), "every item carries the rubric profile and its levels add up");
ok(a.threads.every((t) => t.items.length >= 2) && a.threads.some((t) => t.bridge), "threads are methods two or more items share, and some bridge both organisations");
ok(a.edges.every((e) => ids.has(e.src) && ids.has(e.dst)), "every link joins two items in the map");
console.log(`\nresearch map unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
