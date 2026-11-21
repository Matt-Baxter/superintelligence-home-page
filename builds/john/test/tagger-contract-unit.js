// REQ-005/007: malformed adapter output must fail before merge or graph persistence (test data).
const assert = require('node:assert/strict');
const contract = require('../lib/taggers/contract');
const T = require('../lib/taggers');
const owner = { id:'sample-contract', about:'Sample contract adapter (test data)', namespace:'topic', tag:()=>[] };
const tag = () => ({ qid:'topic:alignment', label:'Alignment', matched:['alignment'], method:'ontology-term' });
const edge = () => ({ src:'topic:alignment', rel:'related', dst:'concept:attention', weight:1, evidence:['Sample evidence (test data)'] });
let passed=0;
function check(label, fn) { fn();passed++;console.log('✓ '+label); }
check('canonical tag preserves input and permits empty matches and nullable fields',()=>{
  const value={...tag(),matched:[],via:null,score:null},snapshot=structuredClone(value);
  assert.equal(contract.tags(owner,[value])[0],value);assert.deepEqual(value,snapshot);
});
check('inherited topic accepts a bare child id and finite confidence boundaries',()=>{
  for(const score of [0,1])contract.tags(owner,[{...tag(),via:'scalable-oversight',score}]);
});
for(const [name,mutate] of [
  ['unknown namespace',t=>t.qid='unknown:alignment'],['wrong namespace',t=>t.qid='concept:attention'],
  ['noncanonical whitespace',t=>t.qid=' topic:alignment '],['missing label',t=>delete t.label],['blank label',t=>t.label=' '],
  ['non-array matches',t=>t.matched='alignment'],['blank match',t=>t.matched=[' ']],['non-string match',t=>t.matched=[1]],['sparse matches',t=>t.matched=Array(1)],
  ['unknown method',t=>t.method='invented'],['NaN score',t=>t.score=NaN],['infinite score',t=>t.score=Infinity],
  ['negative confidence',t=>t.score=-.1],['excessive confidence',t=>t.score=1.1],['numeric-string confidence',t=>t.score='0.5'],
  ['qualified via',t=>t.via='topic:alignment'],['blank via',t=>t.via=''],['object via',t=>t.via={id:'alignment'}]
])check('rejects '+name,()=>{const value=tag();mutate(value);assert.throws(()=>contract.tags(owner,[value]),/Tagger sample-contract/);});
check('non-topic tag cannot imply a child topic',()=>assert.throws(()=>contract.tags({...owner,namespace:'concept'},[{...tag(),qid:'concept:attention',via:'alignment'}]),/via/));
for(const output of [null,undefined,{},'sample'])check('rejects non-array tag collection '+String(output),()=>assert.throws(()=>contract.tags(owner,output),/must return an array/));
check('valid cross-namespace curated edges and empty evidence remain supported',()=>{
  const value={...edge(),weight:0,evidence:[]},snapshot=structuredClone(value);assert.equal(contract.edges(owner,[value])[0],value);assert.deepEqual(value,snapshot);
});
for(const [name,mutate] of [
  ['unknown source',e=>e.src='unknown:sample'],['invalid destination',e=>e.dst='not-qualified'],['blank relation',e=>e.rel=' '],
  ['negative weight',e=>e.weight=-1],['nonfinite weight',e=>e.weight=Infinity],['numeric-string weight',e=>e.weight='1'],
  ['non-array evidence',e=>e.evidence='source'],['blank evidence',e=>e.evidence=[' ']],['non-string evidence',e=>e.evidence=[1]],['sparse evidence',e=>e.evidence=Array(1)]
])check('rejects edge '+name,()=>{const value=edge();mutate(value);assert.throws(()=>contract.edges(owner,[value]),/Tagger sample-contract/);});
check('rejects invalid adapter namespace and non-functions at registration',()=>{
  for(const adapter of [{...owner,namespace:'toString'},{...owner,tag:null},{...owner,edges:[]}])assert.throws(()=>T.register(adapter),/Tagger sample-contract/);
});
check('malformed output aborts a mixed adapter result instead of returning partial tags',()=>{
  const adapter={...owner,tag:()=>[tag(),{...tag(),qid:'unknown:sample'}]};T.register(adapter);
  try { assert.throws(()=>T.tagAll('Sample text (test data)',[adapter.id]),/qid/); } finally { T.registry.unregister(adapter.id); }
});
check('registry facade cannot bypass output validation',()=>{
  const adapter={...owner,tag:()=>null};T.registry.register(adapter);
  try { assert.throws(()=>T.tagAll('Sample text (test data)',[adapter.id]),/must return an array/); } finally { T.registry.unregister(adapter.id); }
});
check('invalid curated output aborts before any edge list is returned',()=>{
  const adapter={...owner,edges:()=>[edge(),{...edge(),weight:NaN}]};T.register(adapter);
  try { assert.throws(()=>T.curatedEdges(),/weight/); } finally { T.registry.unregister(adapter.id); }
});
check('tag merging retains order, matching words, and original inputs',()=>{
  const one={...tag(),matched:['alignment']},two={...tag(),matched:['safety','alignment']};
  T.register({...owner,tag:()=>[one,two]});
  try { const result=T.tagAll('Sample text (test data)',[owner.id]);assert.deepEqual(result[0].matched,['alignment','safety']);assert.equal(result.length,1);assert.deepEqual(one.matched,['alignment']); } finally { T.registry.unregister(owner.id); }
});
check('all enabled extended taggers and curated relationships satisfy the contract',()=>{
  const previous=process.env.SITE_PROFILE;process.env.SITE_PROFILE='extended';
  try { const kernel=require('../kernel/kernel').createKernel();for(const adapter of kernel.store.taggers)if(!T.registry.has(adapter.id))T.register(adapter);
    const tags=T.tagAll('Sample: recurrent depth, JEPA, softmax, attention and alignment toward AGI (test data).');
    assert.ok(tags.some(t=>t.qid==='term:softmax'));assert.ok(tags.some(t=>t.qid==='concept:recurrent-depth'));assert.ok(T.curatedEdges().length>20);
  } finally { if(previous===undefined)delete process.env.SITE_PROFILE;else process.env.SITE_PROFILE=previous; }
});
console.log(`Tagger contract: ${passed} passed, 0 failed.`);
