// REQ-004/005/007: authoritative publication identity must not be overridden by weak title similarity.
// Isolated database only; never inherits the caller's ordinary database connection.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
delete process.env.POSTGRES_URL;
if(process.env.ENTITY_TEST_DATABASE_URL){const u=new URL(process.env.ENTITY_TEST_DATABASE_URL);assert.ok(['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname.endsWith('_test'),'Use a local disposable *_test database.');process.env.DATABASE_URL=u.href;}else{delete process.env.DATABASE_URL;process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'si-entity-grouping-'));}
const db=require('../lib/db'),{addItem}=require('../lib/harvest'),feeds=require('../lib/feeds');
(async()=>{let n=0;const stories=new Set(),sources=[],prefix=`Sample entity grouping ${process.pid} (test data)`;
const check=(v,label)=>{assert.ok(v,label);n++;console.log('✓ '+label);};
const item=(url,title)=>({url,title:`${prefix} ${title}`,summary:'Sample AGI alignment and interpretability research record (test data).',published:'2026-11-08T12:00:00Z'});
const add=async(record,source=0)=>{const out=await db.tx(t=>addItem(t,record,sources[source]));stories.add(out.sid);return out;};
const coverage=async id=>{const r=await db.get('SELECT analysis FROM stories WHERE id=?',id);return JSON.parse(r.analysis).why.find(x=>x.factor==='Coverage')?.points||0;};
try{await db.ready();for(let i=0;i<3;i++)sources.push(await db.insert("INSERT INTO sources (name,kind,format,url,status) VALUES (?,'papers','rss',?,'paused')",`${prefix} source ${i}`,`https://example.test/${process.pid}/${i}/feed`));
const a=await add(item('https://arxiv.org/abs/2611.91001v1','same arxiv headline'));
const version=await add(item('https://arxiv.org/pdf/2611.91001v2.pdf','same arxiv headline'),1);
check(version.sid===a.sid&&!version.isNew,'same arxiv identity across versions/PDF links remains grouped');check(await coverage(a.sid)===7,'real second-source coverage is still counted');
const b=await add(item('https://arxiv.org/abs/2611.91002','same arxiv headline'),2);
check(b.sid!==a.sid&&b.isNew,'distinct arxiv identities cannot merge through a shared title');check(await coverage(b.sid)===0,'rejected false merge cannot inflate new story coverage');
const c=await add(item('https://doi.org/10.5555/ENTITY-A','same doi headline'));
const cVersion=await add(item('https://doi.org/10.5555/entity-a','same doi headline'),1);
check(c.sid===cVersion.sid,'DOI case variants use the same authoritative identity');
const d=await add(item('https://doi.org/10.5555/entity-b','same doi headline'),2);check(d.sid!==c.sid&&await coverage(d.sid)===0,'different DOI identities stay separate with honest coverage');
const cross=await add(item('https://doi.org/10.5555/entity-cross','same arxiv headline'),2);check(cross.sid!==a.sid&&cross.sid!==b.sid,'DOI/arxiv equivalence is not inferred from title alone');
const weak=await add(item(`https://example.test/${process.pid}/weak-first`,'weak first announcement'));
const strengthened=await add(item('https://arxiv.org/abs/2611.91003','weak first announcement'),1);check(strengthened.sid===weak.sid,'a title-only candidate without strong identity can acquire an explicit identity');
const weakLater=await add(item(`https://example.test/${process.pid}/weak-later`,'weak first announcement'),2);check(weakLater.sid===weak.sid,'existing generic announcement/title grouping remains compatible');
// A legacy record with no authoritative key still carries identity in its stored URL.
const legacyItem=item('https://arxiv.org/abs/2611.91004','legacy URL title');
const legacy=await db.insert('INSERT INTO stories (title,url,summary,first_seen,topics,orgs) VALUES (?,?,?,?,?,?)',legacyItem.title,legacyItem.url,legacyItem.summary,db.now(),'[]','[]');stories.add(legacy);
const titleKey=feeds.storyKeys(legacyItem).find(k=>k.startsWith('title:'));await db.run('INSERT INTO story_keys (key,story_id) VALUES (?,?)',titleKey,legacy);
const legacyConflict=await add(item('https://arxiv.org/abs/2611.91005','legacy URL title'),1);check(legacyConflict.sid!==legacy,'legacy canonical URL prevents a conflicting strong-title merge even without an old strong key');
// Historical collisions require human repair; do not rewrite IDs or break idempotency here.
await db.run('INSERT INTO story_keys (key,story_id) VALUES (?,?)','arxiv:2611.91006',legacy);
const polluted=await add(item('https://arxiv.org/abs/2611.91006','legacy URL title'),1);check(polluted.sid===legacy,'an already-owned legacy authoritative key keeps stable ownership');
const additional=await add(item('https://arxiv.org/abs/2611.91007','legacy URL title'),2);check(additional.sid!==legacy,'legacy ambiguous records cannot acquire another conflicting identity through title');
const spoof=await add(item('https://evil-arxiv.org/abs/2611.91001','unrelated lookalike host article'),2);check(spoof.sid!==a.sid&&await coverage(spoof.sid)===0,'lookalike host path does not claim a real arxiv identity');
const upper=await add(item(`https://example.test/${process.pid}/Paper?id=ABC`,'upper path case record'));
const lower=await add(item(`https://example.test/${process.pid}/paper?id=abc`,'lower path case record'),1);check(upper.sid!==lower.sid,'case-sensitive URL paths and queries remain distinct');
const port=await add(item(`https://example.test:8443/${process.pid}/Paper?id=ABC`,'different port record'),2);check(port.sid!==upper.sid,'different authority ports remain distinct');
// Simulate a pre-change URL key whose lowercased identity must not be used as proof.
const replayItem=item(`https://example.test/${process.pid}/Replay?Case=ABC`,'original replay headline');
const replay=await add(replayItem);const newUrlKey=feeds.storyKeys(replayItem).find(k=>k.startsWith('url:'));
await db.run('DELETE FROM story_keys WHERE key=?',newUrlKey);
await db.run('INSERT INTO story_keys (key,story_id) VALUES (?,?)',`url:example.test/${process.pid}/replay?case=abc`,replay.sid);
const replayed=await add({...replayItem,title:prefix+' changed replay headline'},1);check(replayed.sid===replay.sid&&!replayed.isNew,'exact stored URL replay survives old key format and changed headline');
const allKeys=await db.all('SELECT key,story_id FROM story_keys WHERE key IN (?,?)','arxiv:2611.91001','arxiv:2611.91002');check(new Set(allKeys.map(k=>k.story_id)).size===2,'separate authoritative key ownership is persisted');
const concurrent=await Promise.all([
 add(item('https://arxiv.org/abs/2611.91008v1','concurrent first publication'),0),
 add(item('https://arxiv.org/pdf/2611.91008v2.pdf','concurrent second headline'),1)
]);
check(concurrent[0].sid===concurrent[1].sid&&concurrent.filter(x=>x.isNew).length===1,'concurrent transactions admit only one story for a strong identity');
check(await coverage(concurrent[0].sid)===7,'concurrent legitimate sources retain one honest coverage result');
const bridge=await add(item(`https://example.test/${process.pid}/concurrent-weak`,'concurrent weak title bridge'),0);
const conflicts=await Promise.all([
 add(item('https://arxiv.org/abs/2611.91009','concurrent weak title bridge'),1),
 add(item('https://arxiv.org/abs/2611.91010','concurrent weak title bridge'),2)
]);
check(conflicts[0].sid!==conflicts[1].sid&&conflicts.some(x=>x.sid===bridge.sid),'concurrent conflicting strong identities cannot both acquire the same weak title bridge');
check(await coverage(conflicts.find(x=>x.sid!==bridge.sid).sid)===0,'concurrent rejected title merge does not manufacture coverage');
const manual=[];
for(const url of ['https://arxiv.org/abs/2611.91011v1','https://arxiv.org/pdf/2611.91011v2.pdf','https://huggingface.co/papers/2611.91011']){
 const out=await db.tx(t=>addItem(t,item(url,'manual submission URL variants'),null));stories.add(out.sid);manual.push(out);
}
check(new Set(manual.map(x=>x.sid)).size===1&&manual.filter(x=>x.isNew).length===1,'manual URL variants retain one authoritative story identity');
check(await coverage(manual[0].sid)===0,'manual URL variants remain one provenance class and cannot manufacture coverage credit');
console.log(`Entity grouping ${db.engine}: ${n} passed, 0 failed.`);
}finally{for(const id of stories)await db.run('DELETE FROM stories WHERE id=?',id);for(const id of sources)await db.run('DELETE FROM sources WHERE id=?',id);if(db.end)await db.end();}
})().catch(e=>{console.error(e);process.exitCode=1});
