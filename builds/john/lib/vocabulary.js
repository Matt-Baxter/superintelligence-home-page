// REQ-005/007; extended REQ-027/031. A backend facade over the existing canonical registries.
// This validates references; it does not infer scientific support or database row existence.
const ids = require('./ids');
const { createTopicIndex } = require('./topic-index');
const { searchKey } = require('../public/js/term-model');

function createVocabulary({ schema, ontology, concepts, glossary, namespaces }) {
  const problems = [], entries = [], edges = [], byQid = new Map();
  const issue = message => problems.push(message);
  const present = value => typeof value === 'string' && value.trim().length > 0;
  const ns = Object.keys(namespaces).sort(), declared = schema.enums?.Namespace?.values || [];
  if (new Set(declared).size !== declared.length || [...declared].sort().join('|') !== ns.join('|')) issue('schema Namespace enum differs from lib/ids namespaces');
  let hierarchy;
  try { hierarchy = createTopicIndex(ontology.topics); } catch (e) { issue(e.message); }
  function add(namespace, item, { label = item.label, definition = '', aliases = item.terms || [], source, kind = namespace } = {}) {
    const qid = `${namespace}:${item.id}`;
    if (!ids.parse(qid)) issue(`Invalid qualified id ${qid}`);
    if (byQid.has(qid)) issue(`Duplicate vocabulary id ${qid}`);
    if (!present(label)) issue(`Missing label for ${qid}`);
    if (!Array.isArray(aliases) || aliases.some(a => !present(a))) issue(`Invalid aliases for ${qid}`);
    const entry = { qid, label, kind, definition, aliases: Array.isArray(aliases) ? [...aliases] : [], source, formula: item.formula || '', caveat: item.caveat || '', properties: Array.isArray(item.properties) ? [...item.properties] : [], references: Array.isArray(item.sources) ? item.sources.map(s=>({...s})) : [] };
    entries.push(entry); byQid.set(qid, entry); return entry;
  }
  for (const [key, namespace] of [['topics','topic'],['organizations','org'],['benchmarks','benchmark'],['people','person']]) {
    for (const item of ontology[key] || []) add(namespace, item, { source: 'lib/ontology.json', definition: namespace === 'person' ? 'Watchlist mention only; no claims are attributed to this person.' : '' });
  }
  for (const c of concepts.concepts || []) add('concept', c, { label: c.name, definition: c.plain, source: 'modules/learn/data/concepts.json' });
  for (const e of glossary.entries || []) add('term', e, { definition: e.plain, aliases: e.aliases, source: 'modules/learn/data/glossary.json', kind: e.kind });
  function edge(src, rel, dst, source) { edges.push({ src, rel, dst, source }); }
  for (const t of ontology.topics || []) if (t.parent) edge(`topic:${t.id}`, 'part-of', `topic:${t.parent}`, 'lib/ontology.json');
  for (const b of ontology.benchmarks || []) if (b.measures) edge(`benchmark:${b.id}`, 'measures', `topic:${b.measures}`, 'lib/ontology.json');
  const glossaryById = new Map((glossary.entries || []).map(e => [e.id, e]));
  for (const c of concepts.concepts || []) {
    if (!present(c.plain)) issue(`Missing definition for concept:${c.id}`);
    if(c.sources !== undefined && !Array.isArray(c.sources)) issue(`Invalid primary sources for concept:${c.id}`);
    for(const source of Array.isArray(c.sources)?c.sources:[]){try{if(!present(source.title)||new URL(source.url).protocol!=='https:')issue(`Invalid primary source for concept:${c.id}`);}catch{issue(`Invalid primary source for concept:${c.id}`);}}
    if (!hierarchy?.byId.has(c.topic)) issue(`Unknown topic ${c.topic} for concept:${c.id}`);
    else if (hierarchy.ancestors(c.topic).length) issue(`Concept ${c.id} must reference a root topic`);
    edge(`concept:${c.id}`, 'about', `topic:${c.topic}`, 'modules/learn/data/concepts.json');
    for (const r of c.relations || []) {
      if (!Object.hasOwn(concepts.relations || {}, r.kind)) issue(`Unknown concept relation ${r.kind} for ${c.id}`);
      edge(`concept:${c.id}`, r.kind, `concept:${r.to}`, 'modules/learn/data/concepts.json');
    }
    if (c.glossary) {
      const target = glossaryById.get(c.glossary);
      if (!target) issue(`Unknown glossary pointer ${c.glossary} for concept:${c.id}`);
      else if (target.concept !== c.id) issue(`Conflicting concept/glossary pointer for concept:${c.id}`);
      edge(`concept:${c.id}`, 'defined-by', `term:${c.glossary}`, 'modules/learn/data/concepts.json');
    }
  }
  const glossaryAliases = new Map();
  for (const e of glossary.entries || []) {
    if (!present(e.plain) || !present(e.formula) || !present(e.caveat) || !Array.isArray(e.properties) || !e.properties.length || e.properties.some(p => !present(p))) issue(`Incomplete definition/properties for term:${e.id}`);
    if (!['term','symbol','function'].includes(e.kind)) issue(`Unknown glossary kind for term:${e.id}`);
    if (!Array.isArray(e.aliases) || !e.aliases.length) issue(`Missing aliases for term:${e.id}`);
    for (const alias of Array.isArray(e.aliases) ? e.aliases : []) {
      const key = searchKey(alias);
      if (glossaryAliases.has(key)) issue(`Duplicate glossary alias ${alias}`);
      glossaryAliases.set(key, e.id);
    }
    if (!Array.isArray(e.sources) || !e.sources.length) issue(`Missing source for term:${e.id}`);
    for (const source of Array.isArray(e.sources) ? e.sources : []) {
      try { if (!present(source.title) || new URL(source.url).protocol !== 'https:') issue(`Invalid source for term:${e.id}`); }
      catch { issue(`Invalid source for term:${e.id}`); }
    }
    edge(`term:${e.id}`, 'related', `concept:${e.concept}`, 'modules/learn/data/glossary.json');
    for (const related of e.related || []) edge(`term:${e.id}`, 'related', `term:${related}`, 'modules/learn/data/glossary.json');
    for (const notation of e.notation || []) edge(`term:${e.id}`, 'uses-notation', `term:${notation}`, 'modules/learn/data/glossary.json');
  }
  for (const e of edges) {
    if (!byQid.has(e.src) || !byQid.has(e.dst)) issue(`Dangling vocabulary relationship ${e.src} ${e.rel} ${e.dst}`);
  }
  const typeNames = new Set(['string','int','float','bool','datetime','json', ...Object.keys(schema.enums || {}), ...Object.keys(schema.types || {})]);
  const fields = [];
  for (const [type, spec] of Object.entries(schema.types || {})) for (const [name, field] of Object.entries(spec.fields || {})) {
    const base = String(field.type || '').replace(/\?$/, '').replace(/\[\]$/, '');
    if (!typeNames.has(base)) issue(`Unknown field type ${type}.${name}: ${field.type}`);
    fields.push({ owner: type, name, ...field });
  }
  if (problems.length) throw new Error('Vocabulary validation failed:\n- ' + [...new Set(problems)].join('\n- '));
  entries.sort((a,b) => a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0);
  edges.sort((a,b) => { const x=JSON.stringify(a),y=JSON.stringify(b); return x<y?-1:x>y?1:0; });
  return {
    version: schema.version, versions: { ontology: ontology.version, concepts: concepts.version, glossary: glossary.version },
    namespaces: ns.map(name => ({ name, description: namespaces[name] })), enums: schema.enums, types: schema.types,
    entries, edges, fields,
    lookup: qid => byQid.get(qid) || null,
    resolveEntity: (reference, namespace) => {
      const text=typeof reference==='string'?reference.trim():'',parsed=ids.parse(text);
      const matches=parsed?[byQid.get(parsed.qid)].filter(e=>e&&(!namespace||e.qid.startsWith(namespace+':'))):entries.filter(e=>(!namespace||e.qid.startsWith(namespace+':'))&&e.aliases.some(alias=>searchKey(alias)===searchKey(text)));
      return {reference:typeof reference==='string'?reference:'',status:matches.length===1?'resolved':matches.length?'ambiguous':'unresolved',candidates:matches.map(e=>e.qid),basis:parsed?'qualified-id':'literal-alias'};
    },
    lookupAlias: (text, namespace) => entries.filter(e => (!namespace || e.qid.startsWith(namespace + ':')) && e.aliases.some(alias => searchKey(alias) === searchKey(text))),
  };
}

const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
function renderDictionary(v) {
  const out = ['# Data dictionary and controlled vocabulary', '', 'Generated by `node scripts/dictionary.js gen`. Edit the canonical registries, not this file.', '',
    `Schema ${v.version}; ontology ${v.versions.ontology}; concepts ${v.versions.concepts}; glossary ${v.versions.glossary}.`, '',
    'This backend reference joins existing schema fields, identifier namespaces and controlled terms. It does not publish a new site feature, approve proposed requirements, establish scientific support or assert that dynamic database records exist.', '',
    'Canonical sources: [types](../schema/types.json), [ID grammar](../lib/ids.js), [ontology](../lib/ontology.json), [concepts](../modules/learn/data/concepts.json), [glossary](../modules/learn/data/glossary.json).', '',
    '## Identifier namespaces', '', '| Namespace | Meaning |', '| --- | --- |', ...v.namespaces.map(n => `| \`${n.name}:\` | ${cell(n.description)} |`), '',
    'Static vocabulary lookup resolves only entries listed below. Record namespaces such as story, source, doc, event and outlet require their owning repository to establish existence. Literal alias lookup preserves Greek mathematical case; wildcard matching terms are documented verbatim and are not expanded by this lookup. An alias may legitimately match multiple entries or namespaces.', '',
    'Coverage is the existing knowledge-layer schema, not every database column or CMS contract. Other build interfaces remain documented in [INTERFACES.md](INTERFACES.md).', '',
    'External publication keys (arxiv:, doi:, url:) belong to PublicationIdentity, not Tag.qid namespaces. Compound chunk:<story>:<ord> embedding/evidence locators and registry file paths are provenance strings, not Tag.qid values. The qualified-ID grammar applies to declared identity fields, not every trace string.', '',
    '## Canonical fields', '', '| Type.field | Data type | Meaning | JSON-LD term |', '| --- | --- | --- | --- |',
  ];
  for (const f of v.fields) out.push(`| \`${f.owner}.${f.name}\` | \`${cell(f.type)}\` | ${cell(f.about || '')} | ${cell(f.ld || '')} |`);
  out.push('', '## Enumerations', '');
  for (const [name,e] of Object.entries(v.enums)) out.push(`- **${name}:** ${e.values.map(value => '`' + value + '`').join(', ')}. ${e.about || ''}`);
  out.push('', '## Controlled entries', '', 'Definitions are copied from their owning registry. Empty definitions mean the registry supplies a label/matching terms rather than a scientific definition. People are watchlist mentions only.', '', '| Qualified ID | Label / kind | Definition | Matching terms / aliases | Canonical source |', '| --- | --- | --- | --- | --- |');
  for (const e of v.entries) out.push(`| \`${e.qid}\` | ${cell(e.label)} (${cell(e.kind)}) | ${cell(e.definition)} | ${cell(e.aliases.join(', '))} | [registry](../${e.source}) |`);
  out.push('', '## Term properties and source pointers', '', 'Notation follows the source author; formulas are conventions, not executable expressions. Properties state assumptions and caveats, not independent scientific verification.', '');
  for(const e of v.entries.filter(e=>e.qid.startsWith('term:'))){
    out.push(`### ${e.qid}`, '', e.definition, '', `Convention: ${e.formula}`, '', ...e.properties.map(p=>'- '+p), '', `Caveat: ${e.caveat}`, '', ...e.references.map(r=>`- [${r.title}](${r.url})`), '');
  }
  out.push('', '## Concept primary readings', '');
  for(const e of v.entries.filter(e=>e.qid.startsWith('concept:')&&e.references.length))out.push(`- **${e.qid}:** ${e.references.map(r=>`[${r.title}](${r.url})`).join('; ')}.`);
  out.push('', '## Registry relationships', '', 'These are declarations in the static registries, not a claim that the current database index is built or fresh.', '', '| From | Relation | To | Source |', '| --- | --- | --- | --- |');
  for (const e of v.edges) out.push(`| \`${e.src}\` | ${cell(e.rel)} | \`${e.dst}\` | [registry](../${e.source}) |`);
  return out.join('\n') + '\n';
}
module.exports = { createVocabulary, renderDictionary };
