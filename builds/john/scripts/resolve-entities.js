#!/usr/bin/env node
// Offline review tool: no fetching, graph writes, person attribution or publication.
const {resolve}=require('../lib/publication-identity'),{createVocabulary}=require('../lib/vocabulary'),{inputs}=require('./dictionary');
const [kind,reference,namespace]=process.argv.slice(2);
if(!reference||!['publication','vocabulary'].includes(kind)){console.error('Use: resolve-entities.js publication <URL> | vocabulary <reference> [namespace]');process.exitCode=1;}
else if(kind==='publication')console.log(JSON.stringify({scope:'backend-review',verification:'syntax-only; not verified existence, identity ownership or evidence quality',result:resolve(reference)},null,2));
else {const vocabulary=createVocabulary(inputs()),result=vocabulary.resolveEntity(reference,namespace);console.log(JSON.stringify({scope:'backend-review',verification:'static registry match only; no inferred identity equivalence',result,pointers:result.candidates.map(qid=>({qid,registry:vocabulary.lookup(qid).source,graph:'/m/knowledge?qid='+encodeURIComponent(qid)}))},null,2));}
