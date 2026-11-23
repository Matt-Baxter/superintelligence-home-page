// Boundary tests for bakeoff/score.js decide(): pass/fail/unknown logic and the section 6 rules.
"use strict";
const assert = require("assert");
const { decide } = require("../bakeoff/score");
const criteria = require("../bakeoff/criteria.json");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const empty = () => ({ acceptance: [], relevance: {}, manual: {} });
const allAT = (build, result, on = "deployed") => criteria.acceptance.map((a) => ({ build, at: a.id, on, result, by: "t", date: "2026-11-22" }));
const sample = (onTopic, total = 20) => ({ stories: Array.from({ length: total }, (_, i) => ({ title: `s${i}`, judges: { john: i < onTopic, matt: i < onTopic } })) });
const manual = (v) => ({ security: { value: v }, maintainability: { value: v }, effort: { value: v }, usability: { value: v } });

t("weights total 100", () => assert.strictEqual(criteria.criteria.reduce((s, c) => s + c.weight, 0), 100));
t("14 acceptance tests", () => assert.strictEqual(criteria.acceptance.length, 14));

t("no evidence: open, both 0–100, nothing guessed", () => {
  const r = decide(criteria, empty());
  assert.strictEqual(r.decision.status, "open");
  for (const b of r.builds) { assert.strictEqual(b.low, 0); assert.strictEqual(b.high, 100); assert.strictEqual(b.total, null); }
});

t("self-test results never count", () => {
  const e = empty(); e.acceptance = allAT("A", "pass", "self");
  const a = decide(criteria, e).builds[0];
  assert.strictEqual(a.lines[0].detail.passed, 0);
  assert.strictEqual(a.lines[0].detail.unknown, 14);
});

t("relevance needs both judges on all 20", () => {
  const e = empty(); e.relevance.A = sample(20, 19);
  assert.strictEqual(decide(criteria, e).builds[0].lines[1].value, null);
  e.relevance.A = sample(18);
  assert.strictEqual(decide(criteria, e).builds[0].lines[1].value, 0.9);
  e.relevance.A.stories[0].judges.matt = false;
  assert.strictEqual(decide(criteria, e).builds[0].lines[1].value, 0.85);
});

t("decided early when worst case beats best case", () => {
  const e = empty(); e.acceptance = [...allAT("A", "pass"), ...allAT("B", "fail")];
  e.relevance = { A: sample(20), B: sample(0) }; e.manual = { A: manual(1) };
  const r = decide(criteria, e);
  assert.strictEqual(r.decision.status, "decided"); assert.strictEqual(r.decision.base, "A");
});

t("within 5 points: higher relevance decides", () => {
  const e = empty(); e.acceptance = [...allAT("A", "pass"), ...allAT("B", "pass")];
  e.relevance = { A: sample(18), B: sample(20) }; e.manual = { A: manual(1), B: manual(0.9) };
  const r = decide(criteria, e);
  assert.ok(Math.abs(r.builds[0].total - r.builds[1].total) <= 5);
  assert.strictEqual(r.decision.base, "B");
});

t("manual value outside 0..1 is rejected", () => {
  const e = empty(); e.manual = { A: { security: { value: 7 } } };
  assert.throws(() => decide(criteria, e), /0 to 1/);
});

console.log(`bakeoff-unit: ${n} passed`);
