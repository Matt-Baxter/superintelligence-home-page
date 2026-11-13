// Compare the current admission policy with the fixed phrase table proposed in
// PR #3, spec 001 v1.1 at 501d8c23acb7e018da197ac5931e8b48c7762e7d.
const assert = require("node:assert/strict");
const { analyze } = require("../lib/analysis");
const phrases = {
  capabilities: ["AGI", "artificial general intelligence", "superintelligence", "superintelligent", "frontier model", "human-level AI"],
  "automating-ai-research": ["automated AI research", "AI scientist", "automating AI research", "AI research agent"],
  "recursive-self-improvement": ["recursive self-improvement", "self-improving AI", "intelligence explosion"],
  alignment: ["alignment", "aligned AI", "misalignment", "reward hacking", "scalable oversight", "superalignment"],
  interpretability: ["interpretability", "mechanistic interpretability", "sparse autoencoder"],
  safety: ["AI safety", "existential risk", "x-risk", "catastrophic risk", "loss of control", "deceptive alignment"],
  forecasting: ["AGI timelines", "forecasting AI", "AI forecast", "transformative AI"],
  compute: ["scaling laws", "compute scaling", "training compute", "scaling hypothesis"],
  policy: ["AI governance", "frontier AI regulation", "compute governance", "AI policy", "frontier AI safety"],
};

function proposedTopics({ title, summary = "" }) {
  const fields = [title, summary].map(field => field.toLowerCase());
  return Object.entries(phrases).flatMap(([topic, terms]) => {
    const matched = terms.filter(term => fields.some(field => field.includes(term.toLowerCase())));
    return matched.length ? [{ topic, matched }] : [];
  });
}

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
