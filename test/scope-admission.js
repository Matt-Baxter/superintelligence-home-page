// REQ-003: only explicitly classified on-topic rows may appear through real story APIs. Synthetic test data.
// SQLite by default. TEST_DATABASE_URL must name an empty disposable Postgres database when supplied.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
process.env.SITE_PROFILE = 'spec'; process.env.FETCH_MINUTES = '0';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'si-scope-'));
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || ''; delete process.env.POSTGRES_URL;
const { app, boot, db } = require('../server');
(async () => {
  await boot(); const at = db.now();
  const ids = [];
  for (const [title, scope] of [['Unclassified sample (test data)', null], ['Off-topic sample (test data)', 0], ['Superintelligence sample (test data)', 1]]) ids.push(await db.insert('INSERT INTO stories (title, url, summary, published_at, first_seen, in_scope, analysis) VALUES (?, ?, ?, ?, ?, ?, ?)', title, `https://example.test/scope-${ids.length}`, 'Sample summary (test data)', at, at, scope, '{}'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const signup = await fetch(base + '/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'sample-scope-reader', password: 'sample-only-123' }) });
    assert.equal(signup.status, 200); const cookie = signup.headers.get('set-cookie').split(';')[0];
    const get = (p) => fetch(base + p, { headers: { cookie } });
    const feed = await (await get('/api/stories')).json(); assert.ok(feed.stories.some((s) => s.id === ids[2])); assert.ok(feed.stories.every((s) => !ids.slice(0, 2).includes(s.id)));
    for (const id of ids.slice(0, 2)) assert.equal((await get(`/api/stories/${id}`)).status, 404);
    assert.equal((await get(`/api/stories/${ids[2]}`)).status, 200);
    console.log(`scope admission (${db.engine}): 4 passed, 0 failed`);
  } finally { await new Promise((r) => server.close(r)); if (db.end) await db.end(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
