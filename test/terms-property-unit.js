const assert=require('node:assert/strict'),M=require('../public/js/term-model'),G=require('../modules/learn/glossary'),ids=require('../lib/ids');
let seed=1957,n=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let trial=0;trial<600;trial++){
 const xs=Array.from({length:1+Math.floor(random()*32)},()=>random()*1000-500),weights=M.calculate('softmax',xs),shift=(random()-.5)*200,shifted=M.calculate('softmax',xs.map(x=>x+shift));
 assert.ok(weights.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(weights.every((x,i)=>Math.abs(x-shifted[i])<1e-12));n++;
 const ordered=[...xs].sort((a,b)=>a-b),out=M.calculate('sigmoid',ordered);assert.ok(out.every((x,i)=>Number.isFinite(x)&&x>=0&&x<=1&&(i===0||x>=out[i-1])));assert.ok(ordered.every((x,i)=>Math.abs(out[i]+M.calculate('sigmoid',[-x])[0]-1)<1e-12));n++;
}
for(const x of [[],[Infinity],[NaN],[1001],['1'],[true],Array(33).fill(1),null])assert.throws(()=>M.calculate('softmax',x));n++;
assert.throws(()=>M.calculate('not-a-function',[1]));assert.deepEqual(M.calculate('softmax',[1000,1000]),[.5,.5]);assert.deepEqual(M.calculate('sigmoid',[-1000,0,1000]),[0,.5,1]);n++;
const examples=['égradienté','gradientx','xsoftmax','transformersxyz','transformers.js','/models/transformer','gradient.csv'];for(const text of examples)assert.equal(M.mentions(text,G.DATA.entries).length,0);n++;
const text='A ∇θ step uses a gradient and softmax, not égradienté.';const matches=M.mentions(text,G.DATA.entries);assert.ok(matches.some(m=>m.id==='gradient')&&matches.some(m=>m.id==='parameters'));assert.ok(matches.every((m,i)=>m.text===text.slice(m.start,m.end)&&(i===0||m.start>=matches[i-1].end)));n++;
assert.ok(G.tag('gradient '.repeat(500)+' softmax').some(t=>t.qid==='term:softmax'));assert.deepEqual(G.tag('σ').map(t=>t.qid),['term:sigma']);assert.deepEqual(G.tag('Σ').map(t=>t.qid),['term:summation']);n++;
for(const e of G.DATA.entries){assert.ok(ids.parse('term:'+e.id));assert.ok(e.sources.length&&e.properties.length&&e.caveat);assert.ok(G.edges().some(edge=>edge.src==='term:'+e.id));}n++;
console.log(`Term properties: ${n} passed, 0 failed; 600 generated softmax vectors and 600 generated sigmoid vectors.`);
