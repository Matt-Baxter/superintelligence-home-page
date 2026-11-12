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
// REQ-003: superintelligence-only scope (when in doubt, leave it out)
const { scope } = require("../lib/analysis");
const sc = (t) => analyze({ title: t }, { kinds: ["news"] }).scope;
assert.equal(sc("Sample: an alignment technique for superhuman systems (test data)").in, true, "strong term is in scope");
assert.equal(sc("Sample launch: a new AI photo-editing app (test data)").in, false, "general AI news is out");
assert.equal(sc("Sample story: AI helps retailers forecast demand (test data)").in, false, "one weak topic is out");
assert.equal(sc("Sample: export controls on datacenter chips (test data)").in, true, "two spec topics are in");
assert.match(sc("Sample launch: a new AI photo-editing app (test data)").reason, /No superintelligence topic/);
// Broad words in ordinary prose don't tag a topic (ontology v4): an RL "policy", industry "standards", "energy" use.
{ const { tag } = require("../lib/tagger"), ids = (t, x) => tag(t, x).topics.map((y) => y.id);
  assert.ok(!ids("Sample paper: self-improving dialogue agents (test data)", "We train the policy for building turn-level prompts.").includes("policy"), "an RL 'policy' is not Governance & policy");
  assert.ok(ids("Sample brief: AI policy for frontier labs (test data)").includes("policy"), "'AI policy' still tags Governance & policy");
  assert.equal(sc("Sample note: a photo app follows industry standards and energy compliance (test data)").in, false, "standards + energy + compliance in ordinary prose stay out");
  assert.equal(sc("Sample paper: image-text features aligned across languages (test data)").in, false, "'aligned' alone is not a strong scope term"); }
// REQ-001: at least 8 default sources across at least 5 kinds
const src = require("../lib/sources.json"); const list = src.sources || src;
assert.ok(list.length >= 8 && new Set(list.map((x) => x.kind)).size >= 5, "REQ-001: 8+ sources across 5+ kinds");
// REQ-007: a negated frontier claim earns no points; a positive one in another clause still does (test data).
const fr = (title) => analyze({ title, summary: "" }, { kinds: ["papers"], nsources: 1 }).claims;
assert.deepEqual(fr("Sample (test data): the model does not achieve superhuman performance"), [], "a negated frontier claim earns nothing");
assert.deepEqual(fr("Sample (test data): no evidence of recursive self-improvement"), [], "\"no evidence of\" negates the claim");
assert.deepEqual(fr("Sample (test data): no evidence of recursive self-improvement, but agents reach expert-level scores"), ["human-level or beyond"], "a clause break ends the negation");
assert.deepEqual(fr("Sample (test data): not only superhuman but cheap"), ["human-level or beyond"], "\"not only\" is not a negation");
console.log("analysis unit checks: 19 passed");
