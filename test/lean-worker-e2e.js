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
    check(done.status!=='published' && incomplete.status!=='published' && worker.includes('needs-agent'), 'checking a proof never publishes it');
    console.log(`Lean worker E2E: ${n} passed, 0 failed.`);
  } finally {
    await Promise.all([admin.dispose(),reader.dispose(),guest.dispose()]);
    // The disposable database points to these diagnostic files; retain them for review.
    console.log('Proof worker artifacts: '+out);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
