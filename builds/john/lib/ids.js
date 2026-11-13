// Qualified ids: one way to name any label, tag or thing across the app, the API, the codebase map and the agent kit.
//   <namespace>:<id>   e.g. topic:alignment, org:openai, benchmark:swe-bench, person:<watchlist id>, concept:attention, req:REQ-003
// Bare ids are kebab-case (lowercase letters, digits, single hyphens). REQ ids keep the spec's form (REQ-001).
// docs/NAMING.md has the full convention; scripts/naming.js checks it in preflight.
const NAMESPACES = {
  term: "a sourced glossary term, symbol or function (modules/learn/data/glossary.json)",
  topic: "an ontology topic (lib/ontology.json topics)",
  org: "an organisation (lib/ontology.json organizations)",
  benchmark: "a benchmark (lib/ontology.json benchmarks)",
  person: "a watchlist entry (lib/ontology.json people)",
  concept: "a Learn concept (modules/learn/data/concepts.json)",
  req: "a requirement in the shared spec (REQ-001)",
  module: "a plug-in module (modules/<id>)",
  source: "a source row (numeric id)",
  story: "a story row (numeric id)",
  doc: "a reviewed paper, article or comment (modules/review; a hash of its title and text)",
  event: "a dated forecast record (modules/review; a hash of sentence and due date)",
  outlet: "a publication hostname or pooled source class (never a person)",
  lab: "a registered toy experiment referenced by evidence dossiers",
};
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQ = /^REQ-\d{3}$/;
// Keep lexical identity separate from catalog membership and database existence.
// Outlet hosts retain dots and IPv6 brackets; never slugify persisted graph nodes.
const OUTLET = /^(?:[a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.?|\[[0-9a-f:.]+\])$/;
const PATTERNS = Object.fromEntries(Object.keys(NAMESPACES).map(ns=>[ns,ns==='req'?REQ:ns==='source'||ns==='story'?/^[0-9]+$/:ns==='outlet'?OUTLET:KEBAB]));
const QID_PATTERN = '^(?:'+Object.entries(PATTERNS).map(([ns,re])=>ns+':(?:'+re.source.slice(1,-1)+')').join('|')+')$';
const valid = (ns, id) => Object.hasOwn(PATTERNS,ns) && typeof id==='string' && PATTERNS[ns].test(id);
const qid = (ns, id) => { if (!valid(ns, String(id))) throw new Error(`Not a valid ${ns} id: ${id}`); return `${ns}:${id}`; };
function parse(q) {
  const m = /^([a-z]+):(.+)$/.exec(String(q || "").trim());
  return m && valid(m[1], m[2]) ? { ns: m[1], id: m[2], qid: `${m[1]}:${m[2]}` } : null;
}
// "topic:alignment, org:openai" -> [{ns,id,qid}], dropping anything malformed (callers may report what was dropped).
const parseList = (s, max = 8) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, max).map((x) => ({ raw: x, ok: parse(x) }));
module.exports = { NAMESPACES, PATTERNS, QID_PATTERN, KEBAB, REQ, valid, qid, parse, parseList };
