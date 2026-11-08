// Isolated HTTP/database regression: never uses the caller's ordinary database configuration.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
if(process.env.PAGINATION_TEST_DATABASE_URL){const u=new URL(process.env.PAGINATION_TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname.endsWith('_test'),'Use a local disposable *_test database.');process.env.DATABASE_URL=u.href;}else{delete process.env.DATABASE_URL;delete process.env.POSTGRES_URL;process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'si-page-test-'));}
process.env.SITE_PROFILE='extended';process.env.FETCH_MINUTES='0';
const {app,db,boot,ingestItems}=require('../server');const D=require('../modules/review/dossier');
(async()=>{let server;const ids=[],actors=[],sources=[];const prefix=`Sample pagination ${process.pid} (test data)`, eventQid=`event:sample-page-${process.pid}`;let pass=0;
try{await boot();const items=[];await db.tx(async t=>{
 for(let i=0;i<3;i++)actors.push(await t.insert('INSERT INTO users (username,display_name,pass_hash,is_admin) VALUES (?,?,?,0)',`${prefix}-${i}`,'Sample pagination actor','unused-test-hash'));
 const source=await t.insert("INSERT INTO sources (name,kind,format,url,status) VALUES ('Sample pagination source (test data)','papers','rss',?,'paused')",`https://example.test/${process.pid}/feed`);sources.push(source);
 for(let i=0;i<242;i++){
 const time=`2026-11-0${1+i%7}T12:00:00Z`,title=`${prefix} ${i}`,significance=i%17;
 const id=await t.insert('INSERT INTO stories (title,url,summary,published_at,first_seen,in_scope,hidden,significance,topics,analysis) VALUES (?,?,?,?,?,?,?,?,?,?)',title,`https://example.test/${process.pid}/${i}`,'Sample summary',time,time,i===241?null:1,i===240?1:0,significance,'[]','{}');ids.push(id);
 await t.run("INSERT INTO story_topics (story_id,topic) VALUES (?,'alignment')",id);
 await t.run('INSERT INTO story_links (story_id,source_id,url,title) VALUES (?,?,?,?)',id,source,`https://example.test/${process.pid}/${i}`,title);
 if(i<240){items.push({id,time,significance,votes:i%4});for(let v=0;v<i%4;v++)await t.run('INSERT INTO votes (user_id,story_id) VALUES (?,?)',actors[v],id);}
 }
});
server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const original=db.all.bind(db);let materialized=0;db.all=async(sql,...args)=>{const rows=await original(sql,...args);if(sql.includes(' AS nnotes'))materialized=rows.length;return rows;};
for(const sort of ['new','votes','signal']){
 const expected=[...items].sort((a,b)=>(sort==='votes'?b.votes-a.votes:sort==='signal'?b.significance-a.significance:0)||b.time.localeCompare(a.time)||b.id-a.id).slice(40,80).map(x=>x.id);
 const start=performance.now(),response=await fetch(base+'/api/stories?'+new URLSearchParams({q:prefix,sort,offset:'40'})),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.stories.map(s=>s.id),expected);assert.equal(materialized,40);assert.ok(data.stories.every(s=>s.notes===0&&!s.saved&&!s.voted&&s.sources.every(l=>l.title===s.title)));pass++;
 console.log(`${db.engine} ${sort}: 40 database rows materialized for a page from 240 admitted matches; ${(performance.now()-start).toFixed(1)}ms local request (not a production speed claim).`);
}
const fractional=await (await fetch(base+'/api/stories?'+new URLSearchParams({q:prefix,offset:'40.9'}))).json();assert.equal(fractional.stories.length,40);pass++;
const huge=await fetch(base+'/api/stories?'+new URLSearchParams({q:prefix,offset:'Infinity'}));assert.equal(huge.status,200);assert.equal((await huge.json()).stories.length,0);pass++;
await db.run('INSERT INTO story_links (story_id,source_id,url,title) VALUES (?,NULL,?,?)',ids[0],`https://example.test/${process.pid}/uncatalogued`,items[0] ? prefix+' 0' : prefix);
const gathered=await D.gather(db,'alignment');assert.ok(!gathered.stories.some(s=>s.id===ids[240]||s.id===ids[241]));assert.ok(gathered.stories.some(s=>s.id===ids[1]&&s.significance===1));assert.equal(gathered.stories.find(s=>s.id===ids[0]).sourceIds.length,2);pass++;
const attentionItem={title:prefix+' AGI attention',url:`https://example.test/${process.pid}/attention`,summary:'Sample AGI preprint (test data)',authors:[],published:'bad-date',score:1};
await ingestItems(sources[0],[attentionItem]);const before=await db.get('SELECT id,significance,published_at FROM stories WHERE url=?',attentionItem.url);ids.push(before.id);assert.equal(before.published_at,null);
await ingestItems(sources[0],[{...attentionItem,score:100}]);const updated=await db.get('SELECT ext_score,significance FROM stories WHERE id=?',before.id);assert.equal(updated.ext_score,100);assert.ok(updated.significance>before.significance);pass++;
await ingestItems(sources[0],[{...attentionItem,score:Infinity}]);assert.equal((await db.get('SELECT ext_score FROM stories WHERE id=?',before.id)).ext_score,100);pass++;
const K=require('../modules/knowledge/knowledge'),embedder=K.embedders.create('hash-256'),text='Sample alignment passage (test data)',vector=JSON.stringify(embedder.embed(text));
await db.run('UPDATE users SET is_admin=1 WHERE id=?',actors[0]);const token=require('node:crypto').randomBytes(24).toString('hex');await db.run('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)',token,actors[0],Date.now()+60000);const headers={cookie:'sid='+token};
for(const id of [ids[0],ids[240],ids[241]])await db.run('INSERT INTO knowledge_chunks (story_id,ord,text,hash,tags,model,vector) VALUES (?,0,?,?,?,?,?)',id,text,'sample-hash',JSON.stringify([{qid:'topic:alignment',label:'Alignment',matched:['alignment'],method:'test'}]),embedder.id,vector);
await db.run("INSERT INTO knowledge_edges (src,rel,dst,weight,evidence) VALUES ('topic:alignment','co-occurs','topic:capabilities',3,?)",JSON.stringify([`story:${ids[0]}`,`story:${ids[240]}`]));
const read=async p=>{const r=await fetch(base+p,{headers});assert.equal(r.status,200);return r.json();};
const passages=await read('/api/knowledge/chunks?tag=topic:alignment');assert.ok(passages.chunks.some(c=>c.story_id===ids[0]));assert.ok(!passages.chunks.some(c=>c.story_id===ids[240]||c.story_id===ids[241]));pass++;
const similar=await read('/api/knowledge/similar?q='+encodeURIComponent(text));assert.ok(similar.results.some(c=>c.story_id===ids[0]));assert.ok(!similar.results.some(c=>c.story_id===ids[240]||c.story_id===ids[241]));pass++;
const exported=await read('/api/knowledge/export.jsonld');assert.ok(!exported['@graph'].some(c=>c['@type']==='Chunk'&&(c.story_id===ids[240]||c.story_id===ids[241])));assert.ok(!exported['@graph'].some(e=>e.rel==='co-occurs'));pass++;
const graph=await read('/api/knowledge/graph?qid=topic:alignment');assert.equal(graph.stale,true);assert.ok(!graph.edges.some(e=>e.rel==='co-occurs'));pass++;
const cached=K.chunk({id:ids[239],title:prefix+' 239',summary:'Sample summary'})[0];await db.run('INSERT INTO knowledge_chunks (story_id,ord,text,hash,tags,model,vector) VALUES (?,?,?,?,?,?,?)',ids[239],cached.ord,cached.text,cached.hash,'[{"qid":"topic:obsolete"}]',embedder.id,JSON.stringify(embedder.embed(cached.text)));
await db.run("INSERT INTO knowledge_edges (src,rel,dst,weight,evidence) VALUES (?,'about','topic:alignment',1,'[]')",eventQid);
const build=await fetch(base+'/api/admin/knowledge/build',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({limit:5})});assert.equal(build.status,200);assert.equal((await db.get('SELECT COUNT(*) AS n FROM knowledge_chunks WHERE story_id IN (?,?)',ids[240],ids[241])).n,0);pass++;
assert.ok(!(await db.get('SELECT tags FROM knowledge_chunks WHERE story_id=? AND ord=?',ids[239],cached.ord)).tags.includes('obsolete'));pass++;
assert.equal((await read('/api/knowledge/graph')).stale,false);pass++;
const explained=await read('/api/knowledge/graph?qid=topic:alignment&limit=-1');assert.equal(explained.edges.length,1);assert.ok(explained.edges.every(e=>typeof e.meaning.directed==='boolean'&&e.meaning.weight_unit));pass++;
const infinite=await read('/api/knowledge/graph?qid=topic:alignment&limit=Infinity');assert.ok(infinite.edges.length<=25);pass++;
assert.ok(await db.get('SELECT src FROM knowledge_edges WHERE src=?',eventQid));pass++;
await db.run("UPDATE stories SET hidden=1 WHERE id=?",ids[0]);
let prune;require('../modules/knowledge/module').setup({point:()=>({addSql:()=>{},addPrune:fn=>prune=fn,add:()=>{}})});await prune(db);
assert.ok(!await db.get('SELECT story_id FROM knowledge_chunks WHERE story_id=?',ids[0]));
assert.ok(!(await db.all("SELECT evidence FROM knowledge_edges WHERE rel='co-occurs'")).some(e=>JSON.parse(e.evidence).includes(`story:${ids[0]}`)));assert.ok(await db.get('SELECT src FROM knowledge_edges WHERE src=?',eventQid));pass++;

const glossaryResponse=await fetch(base+'/api/learn/glossary');assert.equal(glossaryResponse.status,200);assert.equal((await glossaryResponse.json()).entries.length,22);pass++;
const termGraph=await read('/api/knowledge/graph?qid=term:softmax');assert.ok(termGraph.edges.some(e=>e.rel==='uses-notation'));pass++;
for(const id of [ids[1],ids[240],ids[241]])await db.run('UPDATE stories SET title=? WHERE id=?',prefix+' neural network '+id,id);
const learned=await read('/api/learn/concepts/neural-network');assert.ok(learned.stories.some(s=>s.id===ids[1]));assert.ok(!learned.stories.some(s=>s.id===ids[240]||s.id===ids[241]));pass++;
db.all=original;console.log(`Story pagination ${db.engine}: ${pass} passed, 0 failed.`);
}finally{await db.run('DELETE FROM knowledge_edges WHERE src=?',eventQid);for(const id of ids)await db.run('DELETE FROM stories WHERE id=?',id);for(const id of actors)await db.run('DELETE FROM users WHERE id=?',id);for(const id of sources)await db.run('DELETE FROM sources WHERE id=?',id);if(server)await new Promise(r=>server.close(r));if(db.end)await db.end();}})().catch(e=>{console.error(e);process.exitCode=1});
