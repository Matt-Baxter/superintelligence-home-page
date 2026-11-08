// Run against a disposable npm run demo server. Emulates roles and screen sizes, not production integrations.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const B = process.env.DEMO_BASE || 'http://localhost:3200';
(async () => {
  const metadata = await (await fetch(B + '/api/me')).json();
  assert.ok(metadata.demo?.accounts?.length === 2, 'Use npm run demo: this test requires disposable demo accounts.');
  require('node:fs').mkdirSync('out', { recursive: true });
  const browser = await chromium.launch(); let passed = 0;
  try {
    for (const width of [390, 1280]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(B); await page.waitForSelector('#demoWorkspace:not([hidden])');
      assert.match(await page.textContent('#demoWorkspace'), /Guest view/); passed++;
      for (const role of ['reader', 'admin']) {
        await page.click(`a[href="/?signin=1&demoRole=${role}"]`);
        await page.waitForFunction(() => document.querySelector('#username').value.startsWith('demo-'));
        assert.equal(await page.inputValue('#username'), `demo-${role}`);
        await page.click('#authBtn'); await page.waitForSelector('#feed .story');
        const me = await page.evaluate(async () => (await (await fetch('/api/me')).json()).user);
        assert.equal(me.admin, role === 'admin');
        const adminStatus = await page.evaluate(async () => (await fetch('/api/admin/project/meta')).status);
        assert.equal(adminStatus, role === 'admin' ? 200 : 403);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await page.screenshot({ path: `out/demo-${role}-${colorScheme}-${width}.png`, animations: 'disabled' });
        passed++;
        await page.click('#logout'); await page.waitForSelector('#auth:not([hidden])');
        await page.goto(B); await page.waitForSelector('#demoWorkspace:not([hidden])');
        assert.equal(await page.evaluate(async () => (await fetch('/api/stories?saved=1')).status), 401);
        passed++;
      }
      assert.deepEqual(errors, []); passed++; await context.close();
    }
    console.log(`Demo emulations: ${passed} passed, 0 failed; roles: guest, reader, admin; widths: 390, 1280; themes: light, dark; page errors: none.`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
