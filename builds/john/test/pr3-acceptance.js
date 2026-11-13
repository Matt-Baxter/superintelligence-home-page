// Local acceptance for the shared spec 1.1 / contract 1.2 proposal in PR #3.
// Synthetic input only. Start no external fetches or persistent services.
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, readdirSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const directory = mkdtempSync(path.join(tmpdir(), "si-pr3-"));
process.env.DATA_DIR = directory;
process.env.DATABASE_URL = "";
delete process.env.POSTGRES_URL;
process.env.SITE_PROFILE = "extended";
process.env.FETCH_MINUTES = "0";
const { app, boot, db, ingestItems } = require("../server");
const { parseXml } = require("../lib/feeds");

async function keyboardTo(page, selector) {
  const target = page.locator(selector);
  for (let step = 0; step < 80; step++) {
    if (await target.evaluate(el => el === document.activeElement)) {
      assert.ok(await target.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).outlineStyle !== "none"), selector);
      return;
    }
    await page.keyboard.press("Tab");
  }
  assert.fail(`Keyboard did not reach ${selector}`);
}

async function main() {
  await boot();
  const source = await db.get("SELECT id FROM sources LIMIT 1");
  const payload = '<script>window.feedPayloadRan=true</script><img src="/at15-probe.png">';
  const items = parseXml(`<rss><channel><item><title>AGI alignment sample (test data)</title><link>https://example.test/at15</link><description><![CDATA[AGI alignment. ${payload}]]></description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
  await ingestItems(source.id, items);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const errors = [];
  let passed = 0;
  async function check(id, run) {
    try { await run(); passed++; console.log(`${id}: PASS`); }
    catch (error) { errors.push(id); console.error(`${id}: FAIL — ${error.message}`); }
  }
  try {
    browser = await chromium.launch();
    const response = await fetch(base + "/api/signup", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "sample-keyboard", password: "sample-only-123" }),
    });
    assert.equal(response.status, 200);
    const { stories: [story] } = await (await fetch(base + "/api/stories")).json();
    const page = await browser.newPage();
    let imageRequests = 0;
    page.on("request", request => { if (request.url().endsWith("/at15-probe.png")) imageRequests++; });
    await page.route("**/at15-probe.png", route => route.abort());
    await check("AT-15", async () => {
      for (const route of ["/", `/story?id=${story.id}`]) {
        await page.goto(base + route);
        const summary = page.locator(".story .sum");
        await summary.waitFor();
        assert.ok((await summary.textContent()).includes(payload), `literal summary on ${route}`);
        assert.equal(await summary.locator("script, img").count(), 0);
        assert.equal(await page.evaluate(() => window.feedPayloadRan), undefined);
      }
      assert.equal(imageRequests, 0);
    });
    await check("AT-16", async () => {
      const signedIn = await browser.newContext({ extraHTTPHeaders: { cookie: response.headers.get("set-cookie").split(";")[0] } });
      const reader = await signedIn.newPage();
      const routes = ["/", "/?signin=1", "/welcome", `/story?id=${story.id}`, "/lists", "/sources", "/brief"];
      for (const module of readdirSync(path.join(__dirname, "../modules"), { withFileTypes: true })) {
        const pages = path.join(__dirname, "../modules", module.name, "pages");
        if (!existsSync(pages)) continue;
        for (const file of readdirSync(pages).filter(name => name.endsWith(".html"))) routes.push("/m/" + file.slice(0, -5));
      }
      let verified = 0;
      for (const route of new Set(routes)) {
        const current = ["/", "/?signin=1", "/welcome"].includes(route) || route.startsWith("/story?") ? page : reader;
        const result = await current.goto(base + route);
        if (route.startsWith("/m/") && result.status() === 404) continue;
        assert.equal(result.status(), 200, route);
        const notice = current.getByText("For information only, not investment advice.", { exact: true });
        assert.ok(await notice.isVisible(), route);
        verified++;
      }
      console.log(`  Notice verified on ${verified} page entries.`);
      await signedIn.close();
    });
    await check("AT-17", async () => {
      for (const [width, theme] of [[1280, "light"], [390, "dark"]]) {
        const keyboard = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
        await keyboard.goto(base);
        await keyboardTo(keyboard, '[data-topic="alignment"]');
        await keyboard.keyboard.press("Enter");
        await keyboard.waitForURL("**/*topic=alignment*");
        await keyboardTo(keyboard, "#guestNotice a[href='/?signin=1']");
        await keyboard.keyboard.press("Enter");
        await keyboard.waitForSelector("#username");
        await keyboardTo(keyboard, "#username");
        await keyboard.keyboard.type("sample-keyboard");
        await keyboardTo(keyboard, "#password");
        await keyboard.keyboard.type("sample-only-123");
        await keyboard.keyboard.press("Enter");
        await keyboard.waitForSelector(".story .vote");
        for (const control of [".story .vote", ".story .save"]) {
          const button = keyboard.locator(control);
          const pressed = await button.getAttribute("aria-pressed");
          await keyboardTo(keyboard, control);
          await keyboard.keyboard.press("Space");
          await keyboard.locator(`${control}[aria-pressed="${pressed === "true" ? "false" : "true"}"]`).waitFor();
          assert.ok(await button.evaluate(el => el === document.activeElement), `focus remains on ${control}`);
        }
        await keyboard.close();
      }
    });
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    await db.end?.();
  }
  console.log(`PR #3 local browser acceptance: ${passed} passed, ${errors.length} failed`);
  if (errors.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => rmSync(directory, { recursive: true, force: true }));
