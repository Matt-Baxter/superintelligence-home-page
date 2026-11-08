// Synthetic assertions: graph weights describe stored relationships, never confidence.
const assert = require('node:assert/strict'), K = require('../modules/knowledge/knowledge');
let n=0;
const shared = K.explainEdge({rel:'co-occurs',evidence:['story:1']});
assert.equal(shared.directed,false);assert.equal(shared.kind,'co-occurrence');assert.equal(shared.weight_unit,'shared passages');assert.match(shared.explanation,/does not establish causation/);n++;
const curated = K.explainEdge({rel:'part-of',evidence:['lib/ontology.json']});assert.equal(curated.kind,'curated');assert.equal(curated.directed,true);n++;
const reviewed = K.explainEdge({rel:'evaluates-on',evidence:['doc:abc']});assert.equal(reviewed.kind,'review-derived');assert.match(reviewed.explanation,/Inspect that review/);n++;
assert.equal(K.explainEdge({rel:'about',evidence:null}).kind,'recorded');n++;
const edges=K.coOccurrence([{story_id:1,tags:[{qid:'topic:a'},{qid:'topic:b'},{qid:'topic:a'},{qid:'topic:parent',via:'topic:a'}]},{story_id:2,tags:[{qid:'topic:b'},{qid:'topic:a'}]}]);assert.equal(edges.length,1);assert.equal(edges[0].weight,2);assert.deepEqual(edges[0].evidence,['story:1','story:2']);n++;
const many=K.coOccurrence(Array.from({length:9},(_,i)=>({story_id:i+1,tags:[{qid:'topic:a'},{qid:'topic:b'}]})));assert.equal(many[0].weight,9);assert.equal(many[0].evidence.length,5);n++;
console.log(`Graph logic: ${n} passed, 0 failed.`);
