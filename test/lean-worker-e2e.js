#!/usr/bin/env node
// REQ-024/038: disposable HTTP -> persisted queue -> actual Lean worker -> HTTP result.
'use strict';
const {request} = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {execFileSync} = require('node:child_process');
const B = process.env.BASE, lean = process.env.LEAN;
(async () => {
  const url = new URL(B);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && ['3201','3301'].includes(url.port), 'Use disposable fixture server');
  if (process.env.DATABASE_URL) {
    const db = new URL(process.env.DATABASE_URL);
    assert.ok(['localhost','127.0.0.1'].includes(db.hostname) && db.pathname.endsWith('_test'), 'Use disposable local Postgres *_test database');
  } else {
    assert.ok(process.env.DATA_DIR && path.resolve(process.env.DATA_DIR).startsWith(os.tmpdir()) && path.basename(process.env.DATA_DIR).startsWith('si-test-'), 'Use disposable fixture DATA_DIR');
  }
  assert.ok(lean, 'Set LEAN to a real Lean4 binary');
  assert.match(execFileSync(lean, ['--version'], {encoding:'utf8'}), /version 4\.15\.0\b/);
  const admin = await request.newContext({baseURL:B}), reader = await request.newContext({baseURL:B}), guest = await request.newContext({baseURL:B});
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'si-lean-worker-'));
  let n=0;
  const check = (condition, label) => { assert.ok(condition, label); n++; console.log('✓ '+label); };
  try {
    assert.ok((await admin.post('/api/login', {data:{username:'john',password:'correct-horse-9'}})).ok());
    assert.ok((await reader.post('/api/login', {data:{username:'matt',password:'correct-horse-9'}})).ok());
    check((await guest.get('/api/admin/learn/jobs')).status()===401, 'guest cannot inspect proof queue');
    check((await reader.post('/api/admin/learn/jobs',{data:{kind:'lean-proof',concept_id:'orthogonality'}})).status()===403, 'reader cannot enqueue proof jobs');
    const ids=[];
    for(const concept_id of ['orthogonality','attention']) {
      const response=await admin.post('/api/admin/learn/jobs',{data:{kind:'lean-proof',concept_id}});
      assert.equal(response.status(),200,await response.text());
      const job=(await response.json()).job;
      check(job.status==='queued', concept_id+' proof is durably queued'); ids.push(job.id);
    }
    const worker=execFileSync(process.execPath,['scripts/learn-worker.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,POSTGRES_URL:'',SITE_PROFILE:'extended',LEARN_OUT:out,LEAN:lean},encoding:'utf8',timeout:300000});
    const response=await admin.get('/api/admin/learn/jobs'), body=await response.json();
    const jobs=body.jobs;
    const done=jobs.find(j=>j.id===ids[0]), incomplete=jobs.find(j=>j.id===ids[1]);
    check(done?.status==='done' && done.output.includes('proof is accepted'), 'actual Lean worker completion is visible through API');
    check(incomplete?.status==='needs-agent' && incomplete.output.includes('Proof still to do'), 'unfinished Mathlib statement cannot be reported proved');
    const proof=path.join(out,String(done.id),'orthogonality.lean');
    check(fs.existsSync(proof) && fs.readFileSync(proof,'utf8').includes('theorem orthogonal'), 'worker retains the checked source artifact');
    const receipt=JSON.parse(fs.readFileSync(path.join(out,String(done.id),'proof-audit.json'),'utf8'));
    check(receipt.sourceSha256===require('node:crypto').createHash('sha256').update(fs.readFileSync(proof)).digest('hex') && receipt.theorems.includes('orthogonal') && receipt.footprints.length===1 && /^Lean \(version 4\./.test(receipt.toolVersion), 'audit receipt binds the checked source, theorem assumptions and actual tool version');
    check(done.status!=='published' && incomplete.status!=='published' && worker.includes('needs-agent'), 'checking a proof never publishes it');
    // Inject only into a disposable worker child. The server and repository registry stay unchanged.
    const badResponse=await admin.post('/api/admin/learn/jobs',{data:{kind:'lean-proof',concept_id:'orthogonality'}});
    assert.equal(badResponse.status(),200);
    const badId=(await badResponse.json()).job.id, preload=path.join(out,'sample-bad-proof.cjs');
    const learnModule=path.join(__dirname,'../modules/learn/learn.js');
    fs.writeFileSync(preload, `// Synthetic test data: a false theorem manufactured from a custom assumption.\nconst L=require(${JSON.stringify(learnModule)});const original=L.leanFile;L.leanFile=id=>{const file=original(id);return id==='orthogonality'?{...file,source:'axiom sampleAssumption : False\\ntheorem sampleFalse : False := sampleAssumption\\n'}:file;};`);
    execFileSync(process.execPath,['--require',preload,'scripts/learn-worker.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,POSTGRES_URL:'',SITE_PROFILE:'extended',LEARN_OUT:out,LEAN:lean},encoding:'utf8',timeout:300000});
    const rejected=(await (await admin.get('/api/admin/learn/jobs/'+badId)).json()).job;
    check(rejected.status==='failed' && rejected.error.includes('Unapproved axiom') && rejected.output==='', 'Lean-accepted custom assumptions persist as failed jobs, never completed proofs');
    check(!fs.existsSync(path.join(out,String(badId),'proof-audit.json')) && rejected.status!=='published', 'rejected proof has no acceptance receipt or automatic publication');
    const manual = await admin.put('/api/admin/learn/jobs/'+badId,{data:{status:'done',output:'Sample unverified claim (test data)'}});
    check(manual.status()===400, 'admin API rejects manual proof completion');
    const edit = await admin.put('/api/admin/learn/jobs/'+done.id,{data:{output:'Sample replacement (test data)'}});
    check(edit.status()===400, 'admin API rejects overwriting an audited result');
    assert.throws(() => execFileSync(process.execPath,['scripts/learn-worker.js','complete',String(badId),proof],{cwd:path.join(__dirname,'..'),env:{...process.env,POSTGRES_URL:'',SITE_PROFILE:'extended'},stdio:'pipe'}), /requires the audited worker/);
    check((await (await admin.get('/api/admin/learn/jobs/'+badId)).json()).job.status==='failed', 'manual CLI completion leaves the rejected job failed');
    const recheck = () => execFileSync(process.execPath,['scripts/learn-worker.js','recheck',String(done.id)],{
      cwd:path.join(__dirname,'..'),
      env:{...process.env,POSTGRES_URL:'',SITE_PROFILE:'extended',LEARN_OUT:out,LEAN:lean},
      encoding:'utf8',timeout:300000
    });
    recheck();
    const checked=(await (await admin.get('/api/admin/learn/jobs/'+done.id)).json()).job;
    const checkedReceipt=checked.files.find(file=>file.endsWith('/proof-audit.json'));
    const currentFile=ref=>path.join(out,ref.slice('out/learn/'.length));
    check(checked.status==='done' && checkedReceipt?.includes('/recheck-')
      && JSON.parse(fs.readFileSync(currentFile(checkedReceipt),'utf8')).sourceSha256===receipt.sourceSha256
      && fs.existsSync(path.join(out,String(done.id),'proof-audit.json')), 'recheck saves fresh evidence and retains the original receipt');
    const checkedSource=currentFile(checked.files.find(file=>file.endsWith('/orthogonality.lean')));
    const checkedBytes=fs.readFileSync(checkedSource);
    fs.appendFileSync(checkedSource,'\n-- Sample mismatched historical source (test data)\n');
    recheck();
    const mismatch=(await (await admin.get('/api/admin/learn/jobs/'+done.id)).json()).job;
    check(mismatch.status==='needs-agent' && mismatch.files.length===0 && fs.existsSync(currentFile(checkedReceipt)),
      'mismatched saved source requires review and preserves historical artifacts');
    const queued=(await (await admin.put('/api/admin/learn/jobs/'+done.id,{data:{status:'queued',output:'Sample stale output (test data)'}})).json()).job;
    check(queued.status==='queued' && queued.output==='' && queued.files.length===0, 'requeue detaches the previous proof result and receipt');
    execFileSync(process.execPath,['--require',preload,'scripts/learn-worker.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,POSTGRES_URL:'',SITE_PROFILE:'extended',LEARN_OUT:out,LEAN:lean},encoding:'utf8',timeout:300000});
    const retried=(await (await admin.get('/api/admin/learn/jobs/'+done.id)).json()).job;
    check(retried.status==='failed' && !fs.existsSync(path.join(out,String(done.id),'proof-audit.json')), 'failed retry removes the previous acceptance receipt');
    // Reproduce the old CLI's mixed worker and manual references on this disposable row.
    fs.writeFileSync(checkedSource,checkedBytes);
    const legacyFiles=JSON.stringify([...checked.files,'sample-manual-proof.lean']);
    const legacySetup=`const db=require('./lib/db');db.ready().then(()=>db.run("UPDATE learn_jobs SET status = 'done', files = ? WHERE id = ?",process.argv[1],Number(process.argv[2]))).then(()=>process.exit(0),e=>{console.error(e);process.exit(1)});`;
    execFileSync(process.execPath,['-e',legacySetup,legacyFiles,String(done.id)],{
      cwd:path.join(__dirname,'..'),env:{...process.env,POSTGRES_URL:''},stdio:'pipe'
    });
    recheck();
    const mixed=(await (await admin.get('/api/admin/learn/jobs/'+done.id)).json()).job;
    check(mixed.status==='needs-agent' && mixed.files.length===0 && mixed.output.includes('ambiguous'),
      'mixed manual and worker references cannot qualify for a new receipt');
    console.log(`Lean worker E2E: ${n} passed, 0 failed.`);
  } finally {
    await Promise.all([admin.dispose(),reader.dispose(),guest.dispose()]);
    // The disposable database points to these diagnostic files; retain them for review.
    console.log('Proof worker artifacts: '+out);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
