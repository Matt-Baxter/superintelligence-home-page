// Against npm run demo on port 3250. Every account and source is synthetic.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const B = process.env.DEMO_BASE || 'http://127.0.0.1:3250';
(async () => {
  const metadata = await (await fetch(B + '/api/me')).json();
  assert.equal(metadata.user, null); assert.equal(metadata.demo.accounts.length, 2);
  for (const account of metadata.demo.accounts) {
    const response = await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(account) });
    assert.equal(response.status, 200); const user = (await response.json()).user;
    assert.equal(user.admin, account.role === 'admin');
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(B + '/api/stories', { headers: { cookie } })).status, 200);
    assert.equal((await fetch(B + '/api/admin/project/meta', { headers: { cookie } })).status, account.role === 'admin' ? 200 : 403);
    await fetch(B + '/api/logout', { method: 'POST', headers: { cookie } });
    assert.equal((await fetch(B + '/api/stories?saved=1', { headers: { cookie } })).status, 401);
  }
  const refusal = spawnSync(process.execPath, ['test/serve-demo.js'], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });
  assert.notEqual(refusal.status, 0); assert.match(refusal.stderr, /only for local testing/);
  console.log('Demo access: metadata, both roles, protected routes, logout and production refusal passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
