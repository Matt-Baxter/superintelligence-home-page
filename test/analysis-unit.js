// Fast checks of the rule-based analysis (run by preflight). Synthetic sentences only.
const assert = require("node:assert");
const { analyze, benchmarks } = require("../lib/analysis");
const a = analyze({ title: "Introducing Sample Model A (test data)", summary: "Sample Model A reaches 71.7% on SWE-bench Verified, a new state-of-the-art." }, { kinds: ["lab"], nsources: 2 });
assert.equal(a.type.id, "release"); assert.equal(a.evidence.id, "lab");
assert.deepEqual(a.benchmarks.map((b) => [b.id, b.score?.value]), [["swe-bench-verified", 71.7]], "specific benchmark wins over generic SWE-bench");
assert.ok(a.claims.includes("claims a new best result"));
assert.equal(a.significance, a.why.reduce((s, w) => s + w.points, 0), "score is the sum of its explained parts");
assert.equal(benchmarks("a 50% time horizon of 2 hours 15 minutes")[0].score.value, 2.25, "time horizons read in hours");
assert.equal(benchmarks("IMO this library is nice").length, 0, "IMO as 'in my opinion' is not the olympiad");
assert.equal(analyze({ title: "Sample (test data)", summary: "Accepted at NeurIPS." }, { kinds: ["papers"] }).evidence.id, "peer-reviewed", "named venue upgrades a preprint");
const low = analyze({ title: "Sample community post (test data)" }, { kinds: ["community"] });
assert.ok(low.significance < a.significance, "community chatter scores below a lab release with results");
const j = analyze({ title: "Sample (test data)" }, { kinds: ["community", "journal"], nsources: 2 }); assert.equal(j.evidence.id, "peer-reviewed", "strongest source decides evidence");
console.log("analysis unit checks: 9 passed");
