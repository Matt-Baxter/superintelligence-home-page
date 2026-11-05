// Ontology tagger: matches each topic's and organization's terms against a story's title + summary.
// Returns the matched terms so every tag can explain itself in the UI.
const ontology = require("./ontology.json");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function compile(term) {
  const t = term.toLowerCase().trim();
  const prefix = t.endsWith("*"), body = esc(prefix ? t.slice(0, -1) : t);
  // word boundary that also treats - and ' as part of words
  return new RegExp(`(?<![a-z0-9])${body}${prefix ? "[a-z0-9-]*" : "(?![a-z0-9])"}`, "i");
}
const TOPICS = ontology.topics.map((t) => ({ ...t, res: t.terms.map((term) => [term, compile(term)]) }));
const ORGS = ontology.organizations.map((o) => ({ ...o, res: o.terms.map((term) => [term, compile(term)]) }));

function match(list, text) {
  const out = [];
  for (const t of list) {
    const hits = [];
    for (const [term, re] of t.res) { const m = text.match(re); if (m) hits.push(m[0].toLowerCase()); }
    if (hits.length) out.push({ id: t.id, label: t.label, matched: [...new Set(hits)].slice(0, 5) });
  }
  return out;
}

function tag(title, summary = "") {
  const text = `${title}\n${summary}`.slice(0, 6000);
  const topics = match(TOPICS, text);
  // A child topic implies its parent, so filtering by "Safety" also finds interpretability work.
  for (const t of [...topics]) {
    const parent = TOPICS.find((x) => x.id === t.id)?.parent;
    if (parent && !topics.some((x) => x.id === parent)) {
      const p = TOPICS.find((x) => x.id === parent);
      topics.push({ id: p.id, label: p.label, matched: [], via: t.id });
    }
  }
  return { topics, orgs: match(ORGS, text) };
}

module.exports = { tag, ontology, topicList: () => TOPICS.map(({ id, label, parent }) => ({ id, label, parent })), orgList: () => ORGS.map(({ id, label }) => ({ id, label })) };
