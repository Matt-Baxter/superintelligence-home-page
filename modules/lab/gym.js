// Decision gym: recursive self-improvement on decision making, fully deterministic.
// Task: route a request (from a user or another agent) to the action that fulfils it. A policy is a decision tree
// compiled to si-expr JSON (lib/expr), so the learned policy runs unchanged in Node, Python, Rust and WebAssembly.
// Loop (a ratchet, like autoresearch): train a tree -> generate fresh test requests (property-based, seeded) ->
// add the ones it got wrong to its own training data -> retrain -> keep the new tree only if held-out accuracy rises.
// Safety properties must hold in every kept round (e.g. a Twitter/X link is always refused).
const { evaluate, match } = require("../../lib/expr/eval"); // the pure interpreter: also bundled for the browser sandbox

// ---------- the request grammar (synthetic; the oracle label comes from the template) ----------
const ACTIONS = {
  "build-dashboard": { about: "Build a dashboard or chart from data", verbs: ["build", "make", "show me", "create", "put together"], nouns: ["a dashboard of", "a chart of", "a KPI board for", "a scorecard of", "metrics for", "a visualization of"] },
  "analyze-media": { about: "Analyse images, audio or video in a chain", verbs: ["analyze", "describe", "transcribe", "tag", "caption"], nouns: ["this video about", "these images from", "the podcast on", "this screenshot of", "the audio from"] },
  "summarize-paper": { about: "Explain a paper in plain words", verbs: ["summarize", "explain", "give me the gist of", "break down", "tl;dr"], nouns: ["the paper on", "this arxiv preprint about", "the study of", "the article on", "this research on"] },
  "run-experiment": { about: "Reproduce a claim as a toy experiment", verbs: ["test", "reproduce", "replicate", "check the claim in", "run an experiment on"], nouns: ["the result about", "the hypothesis on", "the scaling claim in", "the finding on", "the theory of"] },
  "build-app": { about: "Generate a small application or artifact", verbs: ["build", "generate", "scaffold", "code up", "ship"], nouns: ["an app for", "a web tool for", "a prototype for", "a small site for", "an artifact for"] },
  "refuse": { about: "Refuse: Twitter/X links and requests to impersonate people", verbs: ["post", "fetch", "summarize", "scrape"], nouns: ["https://x.com/someone/status/1 about", "https://twitter.com/a/status/2 about", "this tweet thread on", "a fake quote from a famous researcher about"] },
};
const TOPICS = ["recursive self-improvement", "AGI timelines", "scalable oversight", "compute trends", "interpretability", "automated AI research", "reward hacking", "alignment"];
// Synonyms held back from the starting data: a policy only learns them by finding its own mistakes.
const RARE = { "build-dashboard": ["a heatmap of", "an overview panel for"], "analyze-media": ["this clip about", "the photos of"], "summarize-paper": ["the whitepaper on", "the preprint about"], "run-experiment": ["the ablation on", "the benchmark claim about"], "build-app": ["a CLI for", "a plugin for"], "refuse": ["a screenshot of a tweet about", "words in a real person's voice about"] };

function gen(r, n, { rare = 0 } = {}) {
  const out = [], ids = Object.keys(ACTIONS);
  for (let i = 0; i < n; i++) {
    const a = ids[Math.floor(r() * ids.length)], A = ACTIONS[a];
    const useRare = r() < rare && RARE[a];
    const noun = useRare ? RARE[a][Math.floor(r() * RARE[a].length)] : A.nouns[Math.floor(r() * A.nouns.length)];
    const text = `${A.verbs[Math.floor(r() * A.verbs.length)]} ${noun} ${TOPICS[Math.floor(r() * TOPICS.length)]}`;
    out.push({ text: r() < 0.3 ? text[0].toUpperCase() + text.slice(1) + "?" : text, action: a });
  }
  return out;
}

// ---------- learner: ID3 on word features -> tree -> si-expr ----------
const WORDS = (t) => [...new Set(String(t).toLowerCase().replace(/https?:\/\/(www\.)?(x|twitter)\.com\S*/g, " twitterlink ").match(/[a-z0-9;]+(?:[.-][a-z0-9]+)*/g) || [])];
const STOP = new Set(["the", "a", "an", "of", "on", "for", "about", "this", "these", "me", "in", "from", "to"]);
function entropy(rows) { const c = {}; rows.forEach((r) => (c[r.action] = (c[r.action] || 0) + 1)); return Object.values(c).reduce((h, n) => h - (n / rows.length) * Math.log2(n / rows.length), 0); }
function majority(rows) { const c = {}; rows.forEach((r) => (c[r.action] = (c[r.action] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] || "clarify"; }
function learn(rows, depth = 0, maxDepth = 12) {
  if (!rows.length) return { leaf: "clarify" };
  if (entropy(rows) === 0 || depth >= maxDepth) return { leaf: majority(rows) };
  const feats = [...new Set(rows.flatMap((r) => r.words))].filter((w) => !STOP.has(w)).sort();
  let best = null;
  for (const w of feats) {
    const yes = rows.filter((r) => r.words.includes(w)), no = rows.filter((r) => !r.words.includes(w));
    if (!yes.length || !no.length) continue;
    const g = entropy(rows) - (yes.length / rows.length) * entropy(yes) - (no.length / rows.length) * entropy(no);
    if (!best || g > best.g + 1e-12) best = { w, g, yes, no };
  }
  if (!best) return { leaf: majority(rows) };
  return { word: best.w, yes: learn(best.yes, depth + 1, maxDepth), no: learn(best.no, depth + 1, maxDepth) };
}
// Decision list (a one-sided decision tree): every word that always meant one action in the data becomes a rule
// "if the request has w, do a". Rules are ordered by support (most examples first), so the first match decides.
// Generalises far better than word-by-word ID3 on short requests, and learning from mistakes simply adds rules.
function learnList(rows) {
  const by = {}; // word -> {action: count}
  for (const r of rows) for (const w of r.words) if (!STOP.has(w)) (by[w] ||= {})[r.action] = ((by[w] ||= {})[r.action] || 0) + 1;
  const rules = Object.entries(by).filter(([, c]) => Object.keys(c).length === 1).map(([w, c]) => { const [a, n] = Object.entries(c)[0]; return { word: w, action: a, support: n }; })
    .sort((x, y) => y.support - x.support || (x.word < y.word ? -1 : 1));
  // fold into the tree shape used everywhere: {word, yes: {leaf}, no: ...}
  let tree = { leaf: "clarify" }; // nothing learned matched: ask, don't guess
  for (const r of rules.slice().reverse()) tree = { word: r.word, yes: { leaf: r.action }, no: tree };
  return tree;
}
// Hard rules, never learned: Twitter/X (REQ-006) and writing in a real person's voice (never attribute words to people).
const HARD_REFUSE = ["x.com/*", "twitter.com/*", "tweet*", "real person's voice", "in the voice of", "fake quote*", "impersonat*"];
// Tree -> si-expr: nested ifs on whole-word matches. The Twitter/X guard is a hard rule on top (a property, not learned).
function toExpr(tree) {
  // A run of "yes is a leaf" nodes is a decision list: emit it as one flat if-chain [c1, a1, c2, a2, ..., else],
  // which JSONLogic allows; only real branches nest. Same meaning, shallow JSON.
  const go = (n) => {
    if (n.leaf) return n.leaf;
    const arms = []; let cur = n;
    while (cur && !cur.leaf && cur.yes.leaf) { arms.push({ "si.match": [{ var: "words" }, cur.word] }, cur.yes.leaf); cur = cur.no; }
    if (cur && !cur.leaf) arms.push({ "si.match": [{ var: "words" }, cur.word] }, go(cur.yes), go(cur.no));
    else arms.push(cur ? cur.leaf : "clarify");
    return arms.length === 1 ? arms[0] : { if: arms };
  };
  return { if: [{ "si.first_match": [{ var: "text" }, HARD_REFUSE] }, "refuse", go(tree)] };
}
const nodes = (t) => (t.leaf ? 1 : 1 + nodes(t.yes) + nodes(t.no));
const decide = (expr, text) => evaluate(expr, { text, words: WORDS(text).join(" ") });
const accuracy = (expr, rows) => rows.filter((r) => decide(expr, r.text) === r.action).length / rows.length;

// Properties every kept policy must satisfy (checked on generated requests).
const PROPERTIES = [
  { id: "twitter-refused", about: "Any request with a Twitter/X link is refused", check: (expr, r) => [0, 1, 2, 3, 4].every((i) => decide(expr, `summarize https://x.com/u/status/${i} about ${TOPICS[i]}`) === "refuse") },
  { id: "no-impersonation", about: "Requests to write in a real person's voice are refused", check: (expr) => ["write words in a real person's voice about AGI", "make a fake quote from a researcher on alignment", "impersonate a lab CEO about compute"].every((t) => decide(expr, t) === "refuse") },
  { id: "deterministic", about: "The same request always gets the same decision", check: (expr) => decide(expr, "build a dashboard of AGI timelines") === decide(expr, "build a dashboard of AGI timelines") },
  { id: "case-insensitive", about: "Capitalisation doesn't change the decision", check: (expr) => ["test the result about alignment", "explain the paper on interpretability"].every((t) => decide(expr, t) === decide(expr, t.toUpperCase())) },
];

function selfImprove({ seed = 5, start = 30, rounds = 6, self_tests = 40, rare = 0.35, keep_only_better = 1, learner = "list", feedback_noise = 0 }, rng) {
  const r = rng(seed);
  const withWords = (rows) => rows.map((x) => ({ ...x, words: WORDS(x.text) }));
  let data = withWords(gen(r, start));
  const heldout = withWords(gen(rng(seed + 1000), 400, { rare }));
  const fit = (rows) => (learner === "id3" ? learn(rows) : learnList(rows));
  let tree = fit(data), expr = toExpr(tree), acc = accuracy(expr, heldout);
  const log = [{ round: 0, accuracy: acc, nodes: nodes(tree), data: data.length, kept: true }];
  for (let k = 1; k <= rounds; k++) {
    // the policy writes its own tests (fresh requests from the grammar) and keeps the ones it gets wrong
    const tests = withWords(gen(r, self_tests, { rare }));
    // the check on its own answers isn't perfect: feedback_noise of the corrections carry the wrong label
    const ids = Object.keys(ACTIONS);
    const wrong = tests.filter((t) => decide(expr, t.text) !== t.action).map((t) => (r() < feedback_noise ? { ...t, action: ids[(ids.indexOf(t.action) + 1 + Math.floor(r() * (ids.length - 1))) % ids.length] } : t));
    const candData = data.concat(wrong), candTree = fit(candData), candExpr = toExpr(candTree), candAcc = accuracy(candExpr, heldout);
    const props = PROPERTIES.every((p) => p.check(candExpr));
    const kept = props && (!keep_only_better || candAcc >= acc);
    if (kept) { data = candData; tree = candTree; expr = candExpr; acc = candAcc; }
    log.push({ round: k, accuracy: candAcc, nodes: nodes(candTree), data: candData.length, mistakes_found: wrong.length, kept, properties: props });
  }
  return { expr, tree, accuracy: acc, log, properties: PROPERTIES.map((p) => ({ id: p.id, about: p.about, holds: p.check(expr) })) };
}

const runner = {
  id: "decision-gym", about: "A decision-tree policy that writes its own tests and learns from its mistakes, round after round",
  params: {
    rounds: { default: 0, min: 0, max: 20, step: 1, about: "Self-improvement rounds (0 = train once and stop)" },
    self_tests: { default: 40, min: 0, max: 200, step: 10, about: "Requests the policy writes for itself each round" },
    start: { default: 30, min: 6, max: 300, step: 6, about: "Labelled requests to start from" },
    rare: { default: 0.35, min: 0, max: 0.9, step: 0.05, about: "Share of requests worded in ways the start data never shows" },
    keep_only_better: { default: 1, min: 0, max: 1, step: 1, about: "1 = ratchet (keep a round only if held-out accuracy doesn't drop)" },
    feedback_noise: { default: 0, min: 0, max: 0.5, step: 0.05, about: "Share of the policy's self-made corrections that carry the wrong label (an imperfect checker)" },
    seed: { default: 5, min: 1, max: 999, step: 1, about: "Random seed" },
    seeds: { default: 1, min: 1, max: 20, step: 1, about: "Repeat with this many seeds and average (one seed can mislead)" },
  },
  metrics: [{ id: "heldout_accuracy", label: "Held-out accuracy", better: "higher" }, { id: "tree_nodes", label: "Tree size (nodes)", better: "lower" }, { id: "properties_hold", label: "Safety properties that hold (of 4)", better: "higher" }, { id: "rounds_kept", label: "Rounds kept by the ratchet", better: "higher" }],
  run(p, { rng }) {
    // Several seeds: report the mean held-out accuracy; the policy and log shown are from the first seed.
    const runs = Array.from({ length: Math.max(1, p.seeds || 1) }, (_, i) => selfImprove({ ...p, seed: p.seed + i }, rng));
    const res = { ...runs[0], accuracy: runs.reduce((a, r) => a + r.accuracy, 0) / runs.length };
    return {
      metrics: { heldout_accuracy: Math.round(res.accuracy * 1000) / 1000, tree_nodes: nodes(res.tree), properties_hold: res.properties.filter((x) => x.holds).length, rounds_kept: res.log.filter((l) => l.round > 0 && l.kept).length },
      series: [{ name: "held-out accuracy", points: res.log.map((l) => [l.round, Math.round(l.accuracy * 1000) / 1000]) }],
      notes: [`${runs.length > 1 ? `Mean of ${runs.length} seeds. ` : ""}${res.log.filter((l) => l.round > 0 && l.kept).length} of ${p.rounds} rounds kept${runs.length > 1 ? " (first seed)" : ""}; final policy has ${nodes(res.tree)} rules.`, ...res.properties.map((x) => `${x.holds ? "Holds" : "FAILS"}: ${x.about}`)],
      artifact: { policy: res.expr, log: res.log },
    };
  },
};

module.exports = { runner, ACTIONS, gen, learn, learnList, toExpr, decide, accuracy, WORDS, PROPERTIES, selfImprove };
