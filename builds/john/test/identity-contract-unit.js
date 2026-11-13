// REQ-005/007: one qualified-ID grammar across runtime and generated schema.
const assert=require('node:assert/strict'),ids=require('../lib/ids'),schema=require('../schema/types.json');
(async()=>{const Z=await import('../schema/gen/zod.mjs');let n=0;const check=(f,label)=>{f();n++;console.log('✓ '+label);};
check(()=>assert.deepEqual([...schema.enums.Namespace.values].sort(),Object.keys(ids.NAMESPACES).sort()),'schema and runtime namespaces agree');
check(()=>assert.equal(schema.types.Tag.fields.qid.pattern,ids.QID_PATTERN),'generated tag grammar uses the runtime identity contract');
const valid=['topic:alignment','term:softmax','concept:recurrent-depth','doc:abc123','event:a1b2c3d4e5f6','outlet:arxiv.org','outlet:class-commentary','outlet:[::1]','outlet:research.example.org','lab:sparse-toy','source:42','story:12','req:REQ-018'];
for(const qid of valid)check(()=>{assert.ok(ids.parse(qid));assert.equal(new RegExp(ids.QID_PATTERN).test(qid),true);assert.ok(Z.Tag.safeParse({qid,label:'Sample (test data)',matched:[],method:'human'}).success);},'identity round-trips: '+qid);
for(const qid of ['nonsense:foo','constructor:abc','__proto__:abc','topic:--','topic:Alignment','req:req-018','source:nope','outlet:https://example.org','outlet:example.org/path','outlet:example.org?key=value','outlet:example.org#x'])check(()=>{assert.equal(ids.parse(qid),null);assert.equal(Z.Tag.safeParse({qid,label:'Sample',matched:[],method:'human'}).success,false);},'malformed identity rejected: '+qid);
check(()=>{const review=require('../modules/review/review');const r=review.review({title:'Sample: AGI forecast (test data)',text:'By 2028, AGI systems will outperform humans on reasoning benchmarks.',url:'https://arxiv.org/abs/2611.00001'});assert.ok(r.edges.some(e=>e.dst.startsWith('outlet:')));for(const e of r.edges){assert.ok(ids.parse(e.src),e.src);assert.ok(ids.parse(e.dst),e.dst);}},'actual synthetic review graph preserves parseable stored identities');
check(()=>{const proto=require('node:fs').readFileSync(require('node:path').join(__dirname,'../schema/gen/si.proto'),'utf8');for(const [name,value] of Object.entries({TOPIC:1,ORG:2,BENCHMARK:3,PERSON:4,CONCEPT:5,REQ:6,MODULE:7,SOURCE:8,STORY:9,TERM:10}))assert.ok(proto.includes(`NAMESPACE_${name} = ${value};`));},'existing protobuf namespace wire numbers remain unchanged');
// Grammar membership does not assert that a database or catalog record exists.
check(()=>assert.ok(ids.parse('topic:syntactically-valid-but-unregistered')),'syntax and vocabulary membership remain separate');
console.log(`Identity contract: ${n} passed, 0 failed.`);
})().catch(e=>{console.error(e);process.exit(1)});
