// REQ-006/REQ-007: every key phrase in the shared spec's "Superintelligence topics and key phrases"
// table must tag its topic. The table is the fairness rule both builds are judged against, so it is
// copied verbatim from Matt-Baxter/superintelligence-home-page main (spec 17c1ddb, 2026-11-14).
// If the shared spec changes, update AGREED below in the same commit.
const assert = require("node:assert/strict");
const { tag, ontology } = require("../lib/tagger");

const AGREED = {
  "Capabilities & AGI progress": ["AGI", "artificial general intelligence", "superintelligence", "superintelligent", "frontier model", "frontier models", "human-level AI"],
  "Automating AI research": ["automated AI research", "AI scientist", "AI scientists", "automating AI research", "AI research agent", "AI research agents"],
  "Recursive self improvement": ["recursive self-improvement", "self-improving AI", "intelligence explosion"],
  Alignment: ["alignment", "aligned AI", "misalignment", "reward hacking", "scalable oversight", "superalignment"],
  Interpretability: ["interpretability", "mechanistic interpretability", "sparse autoencoder", "sparse autoencoders"],
  "Safety & risk": ["AI safety", "existential risk", "existential risks", "x-risk", "catastrophic risk", "catastrophic risks", "loss of control", "deceptive alignment"],
  "Forecasting & timelines": ["AGI timeline", "AGI timelines", "forecasting AI", "AI forecast", "AI forecasts", "transformative AI"],
  "Compute & scaling": ["scaling law", "scaling laws", "compute scaling", "training compute", "scaling hypothesis"],
  "Governance & policy": ["AI governance", "frontier AI regulation", "compute governance", "AI policy", "AI policies", "frontier AI safety"],
};

const idByLabel = new Map(ontology.topics.map((t) => [t.label, t.id]));
let passed = 0;

for (const [label, phrases] of Object.entries(AGREED)) {
  const id = idByLabel.get(label);
  assert.ok(id, `spec topic "${label}" has no matching topic in lib/ontology.json`);
  for (const phrase of phrases) {
    const topics = tag(`Sample headline about ${phrase} (test data)`, "").topics.map((t) => t.id);
    assert.ok(topics.includes(id), `"${phrase}" should tag ${label} (${id}); got [${topics.join(", ")}]`);
    passed++;
  }
}

assert.ok(!tag("Sample headline about how to align a model (test data)", "").topics.some((t) => t.id === "alignment"),
  'near-miss "align" must not tag Alignment (spec edge case: only exact key phrases count)');
passed++;

console.log(`✓ ${passed} checks: every agreed key phrase tags its topic, and a near-miss does not`);
