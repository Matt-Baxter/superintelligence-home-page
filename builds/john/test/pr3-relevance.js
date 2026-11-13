// Compare the current admission policy with the fixed phrase table proposed in
// PR #3, spec 001 v1.1 at 501d8c23acb7e018da197ac5931e8b48c7762e7d.
const assert = require("node:assert/strict");
const { analyze } = require("../lib/analysis");
const { proposedTopics, reviewFeedItems } = require("../lib/relevance-review");
const cases = [
  ["mixed-case single topic", { title: "Study of ScAlAbLe OvErSiGhT" }, ["alignment"]],
  ["summary-only match", { title: "A new experiment", summary: "It tests a sparse autoencoder." }, ["interpretability"]],
  ["forecast topic and trigger words", { title: "AGI timelines surveyed" }, ["capabilities", "forecasting"]],
  ["weak generic mention", { title: "A photo editing app uses AI" }, []],
  ["broad terms across two topics", { title: "A forecast for cheaper GPU hosting" }, []],
  ["author metadata alone", { title: "A photo editing app", authors: "AGI Research Group" }, []],
  ["phrase cannot cross fields", { title: "Power used in training", summary: "Compute estimates follow." }, []],
  ["substring false positive under literal rule", { title: "A magic brush for photo editing" }, ["capabilities"]],
  ["ambiguous phrase under literal rule", { title: "Wheel alignment for passenger cars" }, ["alignment"]],
];

let differences = 0;
for (const [name, item, expected] of cases) {
  const matched = proposedTopics(item);
  assert.deepEqual(matched.map(entry => entry.topic), expected, name);
  if (name === "forecast topic and trigger words") assert.deepEqual(matched[1].matched, ["AGI timelines"]);
  const current = analyze(item).scope.in;
  const proposed = matched.length > 0;
  if (current !== proposed) differences++;
  console.log(`  ${name}: current ${current ? "include" : "exclude"}, proposal ${proposed ? "include" : "exclude"}`);
}
console.log(`PR #3 relevance comparison: ${cases.length} passed, 0 failed, ${differences} admission differences`);

const entries = [
  { source: { name: "Sample paper index" }, item: { title: "Mechanistic interpretability study", url: "https://arxiv.org/abs/2401.12345v1" } },
  { source: { name: "Sample paper mirror" }, item: { title: "Replication notes", url: "https://huggingface.co/papers/2401.12345", summary: "Mechanistic interpretability of a frontier model." } },
  { source: { name: "Sample journal" }, item: { title: "A distinct interpretability study", url: "https://doi.org/10.1234/sample" } },
  { source: { name: "Sample news" }, item: { title: "Magic brush and wheel alignment", url: "https://example.test/sample" } },
  { source: { name: "Sample technical note" }, item: { title: "Alignment tolerances", url: "https://example.test/tolerances" } },
];
const report = reviewFeedItems(entries);
assert.deepEqual(report.samePublication, [{ key: "arxiv:2401.12345", items: [1, 2] }]);
assert.deepEqual(report.sharedTopic.find(group => group.topic === "interpretability").items, [1, 2, 3]);
assert.deepEqual(report.items[1].relevance.exact.find(match => match.topic === "interpretability").evidence,
  [{ phrase: "interpretability", field: "summary" }, { phrase: "mechanistic interpretability", field: "summary" }]);
assert.ok(report.items[3].relevance.literal.some(match => match.topic === "capabilities"));
assert.ok(!report.items[3].relevance.exact.some(match => match.topic === "capabilities"));
assert.ok(report.items[3].relevance.reviewReasons.some(reason => reason.includes("outside AI")));
assert.ok(!report.sharedTopic.some(group => group.topic === "alignment"));
console.log("Relevance review: 7 checks passed, including identity, topic links, evidence fields and ambiguity");

const boundary = reviewFeedItems([
  { item: { title: "AI systems and RSI", url: "https://arxiv.org/abs/2401.12345" } },
  { item: { title: "RSI in wrist injury", summary: '<img alt="AI safety">', url: "https://example.test/wrist" } },
  { item: { title: "AI safety study", url: "https://arxiv.org/abs/2401.12345v2" } },
  { item: { title: "AI safety study updated", url: "https://arxiv.org/abs/2401.12345v3" } },
]);
assert.ok(boundary.items[0].relevance.reviewReasons.some(reason => reason.includes("RSI")));
assert.ok(!boundary.items[1].relevance.reviewReasons.some(reason => reason.includes("RSI")));
assert.deepEqual(boundary.items[1].relevance.exact, []);
assert.deepEqual(boundary.sharedTopic, []);
console.log("Real-feed regressions: 4 passed, 0 failed");
