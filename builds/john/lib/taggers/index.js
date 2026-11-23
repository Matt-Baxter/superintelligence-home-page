// Tagger registry: every way of putting a tag on text is an adapter with the same shape,
//   { id, about, namespace, tag(text, ctx) -> Tag[], edges?() -> Edge[] }   (edges: curated links for the knowledge graph)   where Tag = { qid, label, matched[], via?, method, score? } (schema/types.json)
// Core adapters are registered here; modules add theirs through the kernel's "knowledge.taggers" extension point.
//   const T = require("./lib/taggers"); T.tagAll("text"); T.registry.ids(); T.register({...})
const { createRegistry } = require("../registry");
const tagger = require("../tagger");
const analysis = require("../analysis");
const contract = require("./contract");

const registry = createRegistry("tagger", { required: ["id", "about", "namespace", "tag"] });
function register(adapter) { return registry.register(contract.adapter(adapter)); }

register({
  id: "ontology-topics", namespace: "topic", about: "Ontology topic terms (lib/ontology.json topics); parent topics are added with via",
  tag: (text) => tagger.tag(text, "").topics.map((t) => ({ qid: `topic:${t.id}`, label: t.label, matched: t.matched, ...(t.via ? { via: t.via } : {}), method: "ontology-term" })),
});
// Parent topics are curated part-of links.
registry.get("ontology-topics").edges = () => tagger.topicList().filter((t) => t.parent).map((t) => ({ src: `topic:${t.id}`, rel: "part-of", dst: `topic:${t.parent}`, weight: 1, evidence: ["lib/ontology.json"] }));
register({
  id: "ontology-orgs", namespace: "org", about: "Organisations (lib/ontology.json organizations)",
  tag: (text) => tagger.tag(text, "").orgs.map((o) => ({ qid: `org:${o.id}`, label: o.label, matched: o.matched, method: "ontology-term" })),
});
register({
  id: "benchmarks", namespace: "benchmark", about: "Benchmarks and the scores reported with them",
  tag: (text) => analysis.benchmarks(text).map((b) => ({ qid: `benchmark:${b.id}`, label: b.label, matched: [String(b.matched).toLowerCase()], method: "entity" })),
});
register({
  id: "people", namespace: "person", about: "Watchlist entries mentioned (names only; never claims about them)",
  tag: (text) => analysis.people(text).map((p) => ({ qid: `person:${p.id}`, label: p.label, matched: [String(p.matched || p.label).toLowerCase()], method: "entity" })),
});

// Run the chosen adapters (all when ids is empty) and merge tags by qid.
function tagAll(text, ids = [], ctx = {}) {
  const use = ids && ids.length ? ids.map((id) => registry.get(id)) : registry.list();
  const by = new Map();
  for (const a of use) for (const t of contract.tags(a, contract.adapter(a).tag(text, ctx))) {
    const prev = by.get(t.qid);
    if (!prev) by.set(t.qid, { ...t, matched: [...new Set(t.matched || [])] });
    else prev.matched = [...new Set([...prev.matched, ...(t.matched || [])])];
  }
  return [...by.values()];
}
const curatedEdges = () => registry.list().flatMap((a) => contract.edges(a, typeof contract.adapter(a).edges === "function" ? a.edges() : []));
module.exports = { registry, register, tagAll, curatedEdges };
