// Two-user browser test against test/serve-fixtures.js (synthetic data). Run: node test/e2e.js
const { chromium } = require('playwright');
const B = process.env.BASE || 'http://localhost:3200';
let pass = 0, fail = 0; const errs = [];
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✓' : '  ✗', m); };
async function account(b, u, name) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(u + ' @ ' + p.url() + ': ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,3).join(' | ')));
  p.on('console', m => m.type() === 'error' && !/40[0-9]/.test(m.text()) && errs.push(u + ': ' + m.text()));
  await p.goto(B); await p.click('text=Create account'); await p.fill('#username', u); await p.fill('#displayName', name); await p.fill('#password', 'correct-horse-9');
  await p.click('#authBtn'); await p.waitForSelector('#feed .story'); return p;
}
const story = (p, text) => p.locator('#feed .story', { hasText: text });
(async () => {
  const b = await chromium.launch();
  console.log('Accounts');
  const john = await account(b, 'john', 'John'), matt = await account(b, 'matt', 'Matt');
  ok((await john.evaluate(async () => (await (await fetch('/api/me')).json()).user.admin)) === true, 'first account is the admin');
  ok((await matt.evaluate(async () => (await (await fetch('/api/me')).json()).user.admin)) === false, 'second account is not');
  ok((await fetch(B + '/api/stories')).status === 401, 'feed API needs a session');

  console.log('Feed, grouping and tags');
  ok((await john.$$('#feed .story')).length === 5, 'feed shows 5 stories from 3 sample sources');
  const grouped = story(john, 'Scaling Laws'); ok((await grouped.locator('.multi').textContent()).includes('2 more'), 'one paper from 3 sources is one story (“+ 2 more sources”)');
  const reasonTitle = await grouped.locator('.tag', { hasText: 'Reasoning' }).getAttribute('title'); ok(/test-time compute/.test(reasonTitle), 'tag explains itself (hover shows matched words)');
  await john.click('.topicbar a:has-text("Safety & alignment")'); await john.waitForLoadState('networkidle');
  const safety = await john.$$eval('#feed .title', x => x.map(t => t.textContent)); ok(safety.length === 2 && safety.some(t => /Sparse/.test(t)), 'topic filter: Safety includes the interpretability paper (child topic rolls up)');
  await john.goto(B + '/?topic=policy'); await john.waitForSelector('#feed .story'); ok((await john.$$('#feed .story')).length === 1, 'policy filter');
  await john.goto(B); await john.waitForSelector('#feed .story'); await john.selectOption('#kind', 'lab'); await john.waitForTimeout(400);
  ok((await john.$$('#feed .story')).length === 3, 'source-kind filter (lab: 3 stories incl. the grouped one)');
  await john.selectOption('#kind', ''); await john.fill('#q', 'robot'); await john.waitForTimeout(500); ok((await john.$$('#feed .story')).length === 1, 'search');
  await john.fill('#q', ''); await john.waitForTimeout(400);

  console.log('Votes, saves, ranking');
  await story(matt, 'Export controls').locator('.vote').click(); await matt.waitForTimeout(250);
  await story(john, 'Export controls').locator('.vote').click(); await john.waitForTimeout(250);
  await john.reload(); await john.waitForSelector('#feed .story');
  ok((await story(john, 'Export controls').locator('.vote b').textContent()) === '2', 'votes from two users add up and persist');
  ok((await john.$eval('#feed .story .title', t => t.textContent)).includes('Export controls'), 'voted story rises to the top');
  await story(john, 'Export controls').locator('.vote').click(); await john.waitForTimeout(250); await john.reload(); await john.waitForSelector('#feed .story');
  ok((await story(john, 'Export controls').locator('.vote b').textContent()) === '1', 'unvote toggles back');
  await story(matt, 'Sparse').locator('.save').click(); await matt.waitForTimeout(250); ok((await story(matt, 'Sparse').locator('.save').textContent()).includes('Saved'), 'save button confirms'); await matt.check('#savedOnly'); await matt.waitForTimeout(400);
  ok((await matt.$$('#feed .story')).length === 1, 'saved-for-later view'); await matt.uncheck('#savedOnly');
  await john.check('#savedOnly'); await john.waitForTimeout(400); ok((await john.$$('#feed .story')).length === 0, 'saves are per user'); await john.uncheck('#savedOnly');

  console.log('Story page, notes, lists');
  await john.goto(B + '/'); await john.waitForSelector('#feed .story'); await story(john, 'Scaling Laws').locator('.acts a').click(); await john.waitForSelector('#covered tr');
  ok((await john.$$('#covered tr')).length === 3, 'story page lists all 3 sources with their own headlines');
  ok((await john.textContent('#why')).includes('matched'), 'story page explains every tag');
  await john.fill('#noteText', 'Private: check whether the compute curve holds past 10x.'); await john.click('#noteForm button[type=submit]'); await john.waitForTimeout(300);
  await john.fill('#noteText', 'Shared: good pick for Thursday reading group.'); await john.check('#shareNote'); await john.click('#noteForm button[type=submit]'); await john.waitForTimeout(300);
  const sid = new URL(john.url()).searchParams.get('id');
  await matt.goto(B + '/story?id=' + sid); await matt.waitForSelector('#notes');
  const mn = await matt.textContent('#notes'); ok(mn.includes('reading group') && !mn.includes('compute curve'), 'shared notes visible to others, private notes are not');
  const del = await matt.evaluate(async () => { const d = await (await fetch(location.pathname.replace('/story', '/api/stories/') + location.search.split('=')[1])).json(); return d; });
  const otherNote = await matt.evaluate(async (id) => { const d = await (await fetch('/api/stories/' + id)).json(); const n = d.notes[0]; return (await fetch('/api/notes/' + n.id, { method: 'DELETE' })).status; }, sid);
  ok(otherNote === 403, "can't delete someone else's note");
  await john.fill('#newListTitle', 'Reading group: scaling'); await john.click('#newList button'); await john.waitForTimeout(400);
  ok(await john.isChecked('[data-list]'), 'create a list and add the story in one step');
  await matt.goto(B + '/lists'); await matt.waitForSelector('#lists a'); await matt.click('#lists a:has-text("Reading group")'); await matt.waitForSelector('#items .story');
  ok((await matt.$$('#items .story')).length === 1, 'public list visible to others'); await matt.click('#follow'); await matt.waitForTimeout(300); ok((await matt.textContent('#follow')).includes('Following'), 'follow a list');
  ok(await matt.isHidden('#del'), 'only the owner can delete a list');
  const lid = new URL(matt.url()).searchParams.get('id');
  ok((await matt.evaluate(async ([l, s]) => (await fetch(`/api/lists/${l}/items/${s}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"remove":true}' })).status, [lid, sid])) === 403, 'list edits refuse non-owners');

  console.log('Submitting links and sources');
  await matt.goto(B); await matt.waitForSelector('#feed .story'); await matt.click('#submitBtn');
  await matt.fill('#sUrl', 'https://x.com/someone/status/123'); await matt.fill('#sTitle', 'A thread about a new model'); await matt.click('#submitForm button[type=submit]'); await matt.waitForTimeout(300);
  ok((await matt.textContent('#sErr')).includes('Twitter/X'), 'Twitter/X links are refused');
  await matt.fill('#sUrl', 'https://arxiv.org/abs/2611.00002'); await matt.fill('#sTitle', 'Same SAE paper, submitted by hand'); await matt.click('#submitForm button[type=submit]'); await matt.waitForURL(/story\?id=/);
  ok((await matt.$$('#covered tr')).length === 2, 'a hand-submitted link joins the existing story (same arXiv id)');
  await matt.goto(B + '/sources'); await matt.waitForSelector('#rows tr');
  ok(await matt.isHidden('#fetchAll'), 'non-admins cannot trigger fetches');
  await matt.fill('#sName', 'Example research group'); await matt.fill('#sUrl', 'https://example.org/feed.xml'); await matt.click('#suggest button[type=submit]'); await matt.waitForTimeout(400);
  ok((await matt.textContent('#rows')).includes('pending'), 'suggested source waits for approval');
  await john.goto(B + '/sources'); await john.waitForSelector('[data-status]'); ok(await john.isVisible('#fetchAll'), 'admin sees fetch and approval controls');
  ok((await john.textContent('#sub')).includes('active sources'), 'sources page summarizes kinds and schedule');

  console.log('Weekly brief (json-render)');
  await john.goto(B + '/brief'); await john.waitForSelector('#brief .jr-metric');
  const br = await john.textContent('#brief'); ok(br.includes('Stories this week') && br.includes('Top stories'), 'brief renders from a server-built spec');
  ok(br.includes('Where the activity was'), 'topic activity bars render');
  await john.locator('#brief .jr-story button', { hasText: 'Discuss' }).first().click(); await john.waitForURL(/story\?id=/); ok(true, 'json-render action openStory navigates');
  await john.screenshot({ path: 'shots/story.png', fullPage: true });

  console.log('Agent log');
  await john.goto(B + '/agent-log'); await john.waitForSelector('#entries'); await john.click('#newBtn'); await john.waitForSelector('#editor:not([hidden])');
  await john.fill('#eAgent', 'Test agent'); await john.click('#f_went_wrong'); await john.keyboard.type('Test entry typed by the browser test, not a real log entry.', { delay: 5 });
  await john.click('#f_caught_how'); await john.keyboard.type('Typed during the automated test.', { delay: 5 });
  await john.evaluate(() => { const ta = document.querySelector('#f_fix'); ta.focus(); const dt = new DataTransfer(); dt.setData('text/plain', 'PASTED TEXT 12345'); ta.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: dt, bubbles: true, cancelable: true })); ta.value += 'PASTED TEXT 12345'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
  const live = await john.textContent('#liveRecord'); ok(/\d+ typed/.test(live) && live.includes('17 pasted'), 'editor counts typed vs pasted characters');
  const draftId = await john.evaluate(() => cur.id);
  ok((await matt.evaluate(async (id) => (await fetch('/api/agent-log/' + id)).status, draftId)) === 403, "drafts are private to their author");
  await john.click('#submitEntry'); await john.waitForSelector('.entry'); const ent = await john.textContent('#entries');
  ok(ent.includes('17 pasted') && ent.includes('Submitted'), 'submitted entry shows its writing record');
  await matt.goto(B + '/agent-log'); await matt.waitForSelector('.entry'); ok((await matt.textContent('#entries')).includes('Test entry typed'), 'partner (and instructor) can read submitted entries');
  ok(await matt.$('[data-edit]') === null, "can't edit someone else's entry from the page");
  ok((await matt.evaluate(async (id) => (await fetch('/api/agent-log/' + id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"went_wrong":"changed"}' })).status, draftId)) === 403, 'API refuses edits to others’ entries');
  const empty = await john.evaluate(async () => { const r = await (await fetch('/api/agent-log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json(); return (await fetch('/api/agent-log/' + r.entry.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"submit":true}' })).status; });
  ok(empty === 400, 'an empty entry cannot be submitted');
  const md = await john.evaluate(async () => (await fetch('/api/agent-log-export.md')).text()); ok(md.includes('# Agent log') && md.includes('Writing record'), 'Markdown export includes the writing record');
  ok((await john.textContent('#summary')).includes('Pasted text'), 'agent log summary (json-render) shows pasted share');
  await john.goto(B + '/agent-log'); await john.waitForSelector('.entry'); await john.screenshot({ path: 'shots/agent-log.png', fullPage: true });

  console.log('Phone width');
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await ph.goto(B); await ph.fill('#username', 'john'); await ph.fill('#password', 'correct-horse-9'); await ph.click('#authBtn'); await ph.waitForSelector('#feed .story');
  for (const path of ['/', '/story?id=' + sid, '/brief', '/lists', '/sources', '/agent-log']) { await ph.goto(B + path); await ph.waitForTimeout(600); ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'no sideways scroll: ' + path.split('?')[0]); }
  await ph.goto(B); await ph.waitForSelector('#feed .story'); await ph.screenshot({ path: 'shots/phone-feed.png' });
  await john.goto(B); await john.waitForSelector('#feed .story'); await john.screenshot({ path: 'shots/feed.png', fullPage: true });
  await john.goto(B + '/brief'); await john.waitForSelector('#brief .jr-metric'); await john.screenshot({ path: 'shots/brief.png', fullPage: true });
  console.log(`\n${pass} passed, ${fail} failed`); console.log('page errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
