// Ontology tagger: matches each topic's and organization's terms against a story's title + summary.
// Returns the matched terms so every tag can explain itself in the UI.
const ontology = require("./ontology.json");
const topicIndex = require("./topic-index").createTopicIndex(ontology.topics);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compile(term) {
  const t = term.toLowerCase().trim();
  const prefix = t.endsWith("*"), body = esc(prefix ? t.slice(0, -1) : t);
  // word boundary that also treats - and ' as part of words
  return new RegExp(`(?<![a-z0-9])${body}${prefix ? "[a-z0-9-]*" : "(?![a-z0-9])"}`, "i");
}
const TOPICS = ontology.topics.map((t) => ({ ...t, res: t.terms.map((term) => [term, compile(term)]) }));
const ORGS = ontology.organizations.map((o) => ({ ...o, res: o.terms.map((term) => [term, compile(term)]) }));

function match(list, text, ns) {
  const out = [];
  for (const t of list) {
    const hits = [];
    for (const [term, re] of t.res) { const m = text.match(re); if (m) hits.push(m[0].toLowerCase()); }
    if (hits.length) out.push({ id: t.id, qid: `${ns}:${t.id}`, label: t.label, matched: [...new Set(hits)].slice(0, 5) });
  }
  return out;
}

function tag(title, summary = "") {
  // Runs of spaces and tabs are one space, so a multi-word term ("reward hacking") matches however the text was spaced.
  const text = `${title}\n${summary}`.replace(/[^\S\n]+/g, " ").slice(0, 6000);
  const topics = match(TOPICS, text, "topic");
  // Include every ancestor exactly once, retaining the immediate child as the explanation edge.
  const present = new Set(topics.map(t => t.id));
  for (const t of [...topics]) {
    let child = t.id;
    for (const parent of topicIndex.ancestors(t.id)) {
      if (!present.has(parent)) { const p = topicIndex.byId.get(parent); topics.push({ id: p.id, qid: `topic:${p.id}`, label: p.label, matched: [], via: child }); present.add(parent); }
      child = parent;
    }
  }
  return { topics, orgs: match(ORGS, text, "org") };
}

module.exports = { tag, ontology, topicIndex, topicList: () => TOPICS.map(({ id, label, parent }) => ({ id, label, parent })), orgList: () => ORGS.map(({ id, label }) => ({ id, label })) };
