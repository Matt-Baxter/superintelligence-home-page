// REQ-005/007; extended REQ-027/031. Pure registry integrity checks, no database/network.
const assert = require('node:assert/strict');
const { createVocabulary, renderDictionary } = require('../lib/vocabulary');
const { inputs } = require('../scripts/dictionary');
let count = 0;
const check = (fn,label) => { fn(); count++; console.log('✓ '+label); };
const source = inputs();
// Namespace alignment itself is exercised against the actual registries, never patched in this fixture.
const vocabulary = createVocabulary(source);
check(()=>assert.equal(vocabulary.entries.length,source.ontology.topics.length+source.ontology.organizations.length+source.ontology.benchmarks.length+source.ontology.people.length+source.concepts.concepts.length+source.glossary.entries.length),'every controlled entry has one qualified identity');
check(()=>assert.ok(vocabulary.edges.every(e=>vocabulary.lookup(e.src)&&vocabulary.lookup(e.dst))),'every declared static relationship resolves at both ends');
check(()=>{assert.equal(vocabulary.lookupAlias('σ','term')[0].qid,'term:sigma');assert.equal(vocabulary.lookupAlias('Σ','term')[0].qid,'term:summation');assert.equal(vocabulary.lookupAlias('SOFTMAX','term')[0].qid,'term:softmax');},'literal lookup preserves mathematical case and folds Latin case');
check(()=>{assert.ok(vocabulary.lookupAlias('aime').some(e=>e.qid==='benchmark:aime'));assert.ok(vocabulary.lookupAlias('aime').some(e=>e.qid==='topic:math'));},'legitimate cross-namespace aliases remain distinct');
check(()=>{assert.equal(vocabulary.lookup('story:999999'),null);assert.equal(vocabulary.lookup('topic:not-a-topic'),null);assert.deepEqual(vocabulary.lookupAlias('neural networks'),[]);},'static lookup does not invent dynamic records or expand wildcard terms');
check(()=>{const entry=vocabulary.lookup('term:softmax');assert.ok(entry.formula&&entry.caveat&&entry.properties.length&&entry.references.length);},'joined terms retain conventions, properties, caveats and source provenance');
check(()=>{const text=renderDictionary(vocabulary);assert.equal(text,renderDictionary(createVocabulary(structuredClone(source))));assert.ok(text.includes('Tag.qid')&&text.includes('schema/types.json')&&text.includes('uses-notation'));},'dictionary generation is deterministic and traces fields and relationships');
const mutations = [
  ['namespace drift',x=>x.schema.enums.Namespace.values.pop()],
  ['duplicate static identity',x=>x.ontology.topics.push(structuredClone(x.ontology.topics[0]))],
  ['missing parent',x=>x.ontology.topics[0].parent='missing-parent'],
  ['topic cycle',x=>x.ontology.topics[0].parent=x.ontology.topics[0].id],
  ['missing benchmark topic',x=>x.ontology.benchmarks[0].measures='missing-topic'],
  ['missing concept topic',x=>x.concepts.concepts[0].topic='missing-topic'],
  ['missing related concept',x=>x.concepts.concepts[0].relations.push({kind:'needs',to:'missing-concept'})],
  ['unknown relation',x=>x.concepts.concepts[0].relations.push({kind:'invented-relation',to:x.concepts.concepts[0].id})],
  ['missing concept glossary pointer',x=>x.concepts.concepts[0].glossary='missing-term'],
  ['conflicting reverse pointer',x=>x.concepts.concepts[1].glossary=x.glossary.entries[0].id],
  ['unsafe concept primary source',x=>x.concepts.concepts[0].sources=[{title:'Sample source (test data)',url:'javascript:alert(1)'}]],
  ['missing glossary concept',x=>x.glossary.entries[0].concept='missing-concept'],
  ['missing related term',x=>x.glossary.entries[0].related.push('missing-term')],
  ['missing notation',x=>x.glossary.entries[0].notation.push('missing-term')],
  ['unsafe source scheme',x=>x.glossary.entries[0].sources[0].url='javascript:alert(1)'],
  ['empty definition',x=>x.glossary.entries[0].plain=' '],
  ['duplicate glossary alias',x=>x.glossary.entries[1].aliases.push(x.glossary.entries[0].aliases[0])],
  ['unknown canonical field type',x=>x.schema.types.Tag.fields.qid.type='MissingType'],
];
for(const [label,mutate] of mutations)check(()=>{const copy=structuredClone(source);mutate(copy);assert.throws(()=>createVocabulary(copy),/Vocabulary validation failed/);},label+' is rejected');
console.log(`Vocabulary unit: ${count} passed, 0 failed.`);
