// The research map: Anthropic's and Goodfire's interpretability, alignment and safety work (data/research-map.json)
// connected through our ontology. Each item is scored by the same superintelligence rubric as stories and reviews
// (lib/si-rubric.js), so its dimensions, stance and relevance come from published rules, not from the catalog. Links:
//   builds-on       the item extends another (stated by the item, or plain lineage)
//   shares-method   two items use the same method tag (only methods two or more items use)
//   bridges         a method both organisations use: the place where the two research programmes meet
// and threads: per method, the items in date order, so a reader can follow one idea from first paper to latest.
// Deterministic: same data, same map. Nothing is fetched.
const DATA = require("./data/research-map.json");
const rubric = require("../../lib/si-rubric");
const { tag, ontology } = require("../../lib/tagger");

const ORGS = { anthropic: "Anthropic", goodfire: "Goodfire", "anthropic+goodfire": "Anthropic and Goodfire" };
const orgsOf = (o) => (o === "anthropic+goodfire" ? ["anthropic", "goodfire"] : [o]);
const topicLabel = Object.fromEntries(ontology.topics.map((t) => [t.id, t.label]));

function profileOf(item) {
  // The item's curated topics plus whatever the tagger finds in its title and summary; the rubric reads both.
  const tagged = tag(item.title, item.summary).topics;
  const have = new Set(tagged.map((t) => t.id));
  const topics = [...tagged, ...item.topics.filter((t) => !have.has(t)).map((id) => ({ id, matched: [] }))];
  return rubric.profile({ title: item.title, text: item.summary, topics });
}

let cached = null;
function build() {
  if (cached) return cached;
  const items = [...DATA.items].sort((a, b) => a.published.localeCompare(b.published) || a.id.localeCompare(b.id)).map((it) => {
    const p = profileOf(it);
    return { ...it, qid: `paper:${it.id}`, orgLabel: ORGS[it.org] || it.org,
      si: { stance: p.stance, relevance: p.relevance, summary: p.summary, axes: p.axes, dimensions: p.dimensions.map(({ id, label, axis, level, why }) => ({ id, label, axis, level, why })) } };
  });
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const edges = [];
  for (const x of items) for (const b of x.builds_on || []) if (byId[b]) edges.push({ src: x.id, rel: "builds-on", dst: b, why: "stated by the item or plain lineage" });
  // Methods used by two or more items, with the organisations that use them.
  const methods = {};
  for (const x of items) for (const m of x.methods || []) (methods[m] ||= []).push(x.id);
  const shared = Object.entries(methods).filter(([, ids]) => ids.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [m, ids] of shared) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) edges.push({ src: ids[i], rel: "shares-method", dst: ids[j], why: m });
  const threads = shared.map(([m, ids]) => {
    const orgs = [...new Set(ids.flatMap((id) => orgsOf(byId[id].org)))].sort();
    return { method: m, items: ids, orgs, bridge: orgs.length > 1, from: byId[ids[0]].published, to: byId[ids.at(-1)].published };
  });
  // Rubric dimensions across the map: how many items engage each, by organisation.
  const dims = rubric.DIMENSIONS.map((d) => {
    const engaged = items.filter((x) => x.si.dimensions.find((y) => y.id === d.id).level > 0);
    return { ...d, items: engaged.length, byOrg: Object.fromEntries(Object.keys(ORGS).map((o) => [o, engaged.filter((x) => x.org === o).length])) };
  });
  // Ontology grounding: topics and concepts with the items that carry them.
  const count = (key) => { const c = {}; for (const x of items) for (const v of x[key] || []) (c[v] ||= []).push(x.id); return Object.entries(c).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([id, ids]) => ({ id, items: ids })); };
  const stance = {}; for (const x of items) stance[x.si.stance] = (stance[x.si.stance] || 0) + 1;
  cached = {
    about: DATA.about, checked: DATA.checked, items, edges, threads, dimensions: dims,
    topics: count("topics").map((t) => ({ ...t, qid: `topic:${t.id}`, label: topicLabel[t.id] || t.id })),
    concepts: count("concepts").map((c) => ({ ...c, qid: `concept:${c.id}` })),
    stats: { items: items.length, byOrg: Object.fromEntries(Object.keys(ORGS).map((o) => [o, items.filter((x) => x.org === o).length])),
      links: edges.length, buildsOn: edges.filter((e) => e.rel === "builds-on").length, bridges: threads.filter((t) => t.bridge).map((t) => t.method), stance },
  };
  return cached;
}

module.exports = { build, profileOf };
