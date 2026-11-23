const assert = require('node:assert/strict');
const tagger = require('../lib/tagger'), { createTopicIndex } = require('../lib/topic-index'), analysis = require('../lib/analysis');
const source = require('../modules/review/sources'), dossier = require('../modules/review/dossier'), values = require('../lib/story-values');
let n=0; const check=(fn)=>{fn();n++};
for(const text of ['Sample AIME result (test data)','Sample hours-long autonomous agent (test data)']) check(()=>{
 const tags=tagger.tag(text).topics; assert.ok(tags.some(t=>t.id==='capabilities')); assert.equal(new Set(tags.map(t=>t.qid)).size,tags.length);
 for(const t of tags) for(const a of tagger.topicIndex.ancestors(t.id)) assert.ok(tags.some(x=>x.id===a));
});
for(const topics of [[{id:'a',parent:'missing'}],[{id:'a',parent:'b'},{id:'b',parent:'a'}],[{id:'a'},{id:'a'}]]) check(()=>assert.throws(()=>createTopicIndex(topics)));
for(const score of [-1,-0.5,Infinity,NaN,'bad',true,[100],{}]) check(()=>{
 const a=analysis.analyze({title:'Sample AGI evaluation (test data)',ext_score:score},{kinds:['papers']});
 assert.ok(a.why.every(w=>Number.isFinite(w.points)&&w.points>=0)); assert.equal(a.why.find(w=>w.factor==='Community attention'),undefined);
});
for(const title of ['Sample AGI science education (test data)','Sample AGI paper submitted to NeurIPS, not accepted (test data)',"Sample AGI paper not accepted at NeurIPS (test data)","Sample AGI paper was never accepted at NeurIPS (test data)","Sample AGI paper hasn't been accepted at NeurIPS (test data)","Sample AGI paper hasn’t yet been accepted at NeurIPS (test data)"]) check(()=>assert.equal(analysis.analyze({title},{kinds:['papers']}).evidence.id,'preprint'));
check(()=>assert.equal(analysis.analyze({title:'Sample AGI paper accepted at NeurIPS (test data)'},{kinds:['papers']}).evidence.id,'peer-reviewed'));
check(()=>assert.match(analysis.analyze({title:'Sample AGI (test data)'},{nsources:3}).why.find(w=>w.factor==='Coverage').detail,/linked sources/));
const at='2026-11-07';
for(const date of [undefined,'not-a-date','2099-01-01','2026-11-08','2026-02-30']) check(()=>assert.equal(source.buzz({stories:[{at:date,kinds:['news']}],at}).items,0));
check(()=>assert.equal(source.buzz({stories:[{at:'2026-11-07T23:59:59Z',kinds:['forum']},{at:'2026-10-08',kinds:['news']}],at,days:30}).items,1));
check(()=>assert.equal(source.buzz({articles:[{at,hype:-10},{at,hype:200},{at,hype:Infinity},{at,hype:'bad'}],at}).hype,50));
check(()=>assert.equal(source.buzz({articles:[{at,hype:'bad'}],at}).hype,null));
check(()=>assert.ok(Number.isNaN(values.timestamp('2026-02-30'))));
check(()=>assert.equal(values.timestamp('2026-11-07 12:00:00'),Date.parse('2026-11-07T12:00:00Z')));
check(()=>{
 const d=dossier.analyse({topic:'alignment',ids:['alignment'],docs:[],docEdges:[],stories:[{id:1,title:'Sample AGI (test data)',sources:['Sample source'],entities:[],kinds:['news'],at,significance:0},{id:2,title:'Sample analysis (test data)',sources:['Sample source'],entities:[],kinds:['news'],at,significance:80}]},{at});
 assert.equal(d.top[0].id,2); assert.equal(d.top[0].significance,80); assert.equal(d.top.find(s=>s.id===1).significance,0);
});
check(()=>assert.equal(values.attention(1e30),2147483647));
check(()=>assert.equal(values.attention(1.9),1));
check(()=>assert.equal(values.publication('2026-11-07T12:00:00-06:00'),'2026-11-07T18:00:00.000Z'));
check(()=>assert.equal(values.publication('2026-11-07'),'2026-11-07'));
check(()=>assert.equal(values.publication('not-a-date'),null));
console.log(`Pipeline quality: ${n} passed, 0 failed.`);
