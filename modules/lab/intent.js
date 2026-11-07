// Intent routing: a request from a person or another agent -> an action, decided by the gym's learned si-expr policy,
// then a deterministic plan for that action. "build-dashboard" is fully executed here: it returns a json-render spec
// built from live data, which the route validates against the block catalog before returning it.
const gym = require("./gym");
const { runners, rng } = require("./runners");

let POLICY;
function policy() {
  if (!POLICY) { const r = runners.get("decision-gym"); POLICY = r.run({ ...Object.fromEntries(Object.entries(r.params).map(([k, v]) => [k, v.default])), rounds: 8 }, { rng }).artifact.policy; }
  return POLICY;
}
// Walk the tree to explain which words decided.
function explain(expr, text) {
  const words = gym.WORDS(text).join(" "), path = [];
  let node = expr;
  if (gym.decide({ if: [node.if[0], "refuse", "x"] }, text) === "refuse") return { action: "refuse", path: ["a hard rule matched: a Twitter/X link, or words in a real person's voice"] };
  node = node.if[2];
  // Walk if-chains [cond, then, cond, then, ..., else]; a nested chain can sit in any arm.
  while (node && typeof node === "object" && node.if) {
    const arms = node.if; let next = arms.length % 2 ? arms[arms.length - 1] : "clarify";
    for (let i = 0; i + 1 < arms.length; i += 2) {
      const w = arms[i]["si.match"][1], hit = require("../../lib/expr").match(words, w) !== null;
      if (hit) { path.push(`has "${w}"`); next = arms[i + 1]; break; }
    }
    if (next === (arms.length % 2 ? arms[arms.length - 1] : "clarify")) path.push("none of the learned words matched");
    node = next;
  }
  return { action: node, path };
}

const PLANS = {
  "build-dashboard": () => ["Read in-scope stories (GET /api/stories)", "Count by topic and source", "Lay out Metric and BarList blocks", "Validate against the json-render catalog", "Render (or save as a view)"],
  "analyze-media": () => ["Fetch the media (image frames, audio)", "Embed frames and transcript with EmbeddingGemma (embedder adapter)", "Caption and describe with a multimodal model, e.g. Gemma 3 12B via LLM_PROVIDER (worker only)", "Tag the text with lib/taggers", "Store as knowledge chunks and link into the graph"],
  "summarize-paper": () => ["Find the story or paper", "Queue a Learn job of kind explain (plain words, analogy, concepts)", "A worker or agent writes it; a person publishes"],
  "run-experiment": () => ["Match the claim to a Lab runner", "Run the reproduction and our hypothesis (deterministic)", "Ratchet with npm run lab -- explore (optionally a local model proposes)", "Judge reproduction vs hypothesis (weighted; JEV/CLEF recorded on Decide)"],
  "build-app": () => ["Turn the request into a view spec from the catalog (Studio)", "Validate it", "Publish as a module page or artifact; a person reviews"],
  refuse: () => ["Refuse: Twitter/X links are never accepted (REQ-006), and nothing is written in a real person's voice"],
  clarify: () => ["Ask one question: what should be built or analysed?"],
};

function dashboardSpec({ stories, topics }) {
  const tl = Object.fromEntries(topics.map((t) => [t.id, t.label]));
  const byTopic = {}; const sources = new Set();
  for (const s of stories) { for (const t of s.topics || []) if (!t.via && tl[t.id] && !topics.find((x) => x.id === t.id)?.parent) byTopic[t.id] = (byTopic[t.id] || 0) + 1; for (const x of s.sources || []) sources.add(x.name); }
  const items = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...items.map(([, n]) => n));
  return { root: "root", elements: {
    root: { type: "Stack", props: { gap: "md" }, children: ["h", "grid", "bars"] },
    h: { type: "Heading", props: { text: "Superintelligence feed at a glance", level: "2" }, children: [] },
    grid: { type: "Grid", props: { columns: 3 }, children: ["m1", "m2", "m3"] },
    m1: { type: "Metric", props: { label: "Stories", value: String(stories.length) }, children: [] },
    m2: { type: "Metric", props: { label: "Sources", value: String(sources.size) }, children: [] },
    m3: { type: "Metric", props: { label: "Topics covered", value: String(items.length) }, children: [] },
    bars: { type: "BarList", props: { items: items.map(([id, n]) => ({ label: tl[id], value: n, max, display: String(n) })) }, children: [] },
  } };
}

module.exports = { policy, explain, PLANS, dashboardSpec };
