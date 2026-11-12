#!/usr/bin/env node
// Screenshots and short videos for the docs (REQ-068..REQ-075, proposed): the work board, two people on one response
// in the builder, the element catalog and the data page, on a throwaway server with SYNTHETIC sample data.
//   npm run demo:capture          writes docs/demo/*.png, *.mp4 and *.gif (needs Playwright's Chromium and ffmpeg)
// Every account and record is labelled Sample / test data. Nothing touches a real database.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawn, execFileSync } = require("node:child_process");
const root = path.join(__dirname, ".."), OUT = path.join(root, "docs", "demo"), PORT = Number(process.env.DEMO_PORT || 3290), B = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "si-capture-")), WORK = fs.mkdtempSync(path.join(os.tmpdir(), "si-capture-work-")), VID = fs.mkdtempSync(path.join(os.tmpdir(), "si-capture-vid-"));
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "content-type": "application/json" };

async function waitUp() { for (let i = 0; i < 60; i++) { try { if ((await fetch(B + "/api/me")).status < 500) return; } catch {} await sleep(500); } throw new Error("server did not start"); }
const signup = async (u) => (await fetch(B + "/api/signup", { method: "POST", headers: H, body: JSON.stringify({ username: u, password: "sample-only-123" }) })).headers.get("set-cookie").split(";")[0];
const act = async (c, id, input) => (await fetch(`${B}/api/data/actions/${id}`, { method: "POST", headers: { ...H, cookie: c }, body: JSON.stringify({ input }) })).json();
const cookieFor = (c) => { const [name, ...v] = c.split("="); return [{ name, value: v.join("="), url: B }]; };

// A caption at the bottom of the frame, so a silent video says what is happening.
async function caption(page, text) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) { el = document.createElement("div"); el.id = "demo-caption"; Object.assign(el.style, { position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)", maxWidth: "88%", padding: "10px 16px", background: "rgba(17,17,17,.88)", color: "#fff", font: "500 17px/1.35 system-ui, sans-serif", borderRadius: "8px", zIndex: 99999, textAlign: "center" }); document.body.append(el); }
    el.textContent = t;
  }, text);
}
async function slowType(locator, text) { await locator.click(); await locator.fill(""); await locator.type(text, { delay: 45 }); }

function encode(webms, name) {
  const list = path.join(VID, `${name}.txt`); fs.writeFileSync(list, webms.map((w) => `file '${w}'`).join("\n"));
  const mp4 = path.join(OUT, `${name}.mp4`), gif = path.join(OUT, `${name}.gif`), pal = path.join(VID, `${name}-pal.png`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=1280:-2,fps=24", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-movflags", "+faststart", mp4]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=6,scale=860:-1:flags=lanczos,palettegen=max_colors=96", pal]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-i", pal, "-lavfi", "fps=6,scale=860:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", gif]);
  return { mp4: (fs.statSync(mp4).size / 1024).toFixed(0), gif: (fs.statSync(gif).size / 1024).toFixed(0) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, ["--no-warnings", path.join(root, "test", "serve-fixtures.js")], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, WORK_OUT: WORK, SITE_PROFILE: "extended", DATABASE_URL: "" }, stdio: "ignore" });
  try {
    await waitUp();
    const john = await signup("sample-john"), matt = await signup("sample-matt");
    const { DatabaseSync } = require("node:sqlite"); const dbf = fs.readdirSync(DATA).find((f) => /\.db$/.test(f)); new DatabaseSync(path.join(DATA, dbf)).prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run("sample-matt");
    const html = fs.readFileSync(path.join(root, "test", "fixtures", "papers", "sample-paper.html"), "utf8");
    const slug = (await act(john, "responses.build", { title: "Gated Self-Repair: Sample paper for the paper reader (test data)", url: "https://example.test/sample-paper", text: html })).result.slug;
    // Sample votes and saves, so the catalog's data check has rows to check.
    const stories = ((await (await fetch(B + "/api/stories", { headers: { cookie: matt } })).json()).stories || []).slice(0, 4);
    for (const s of stories) for (const c of [john, matt]) { await fetch(`${B}/api/stories/${s.id}/vote`, { method: "POST", headers: { ...H, cookie: c }, body: "{}" }); await fetch(`${B}/api/stories/${s.id}/save`, { method: "POST", headers: { ...H, cookie: c }, body: "{}" }); }
    await act(john, "work.claim", { task: "spec:006/T673", files: ["modules/lab/production.js"], actor: "agent:sample-helper", intent: "Sample claim (test data)" });
    const browser = await chromium.launch(), report = [];

    // --- still screenshots ---
    for (const [name, url, vp, who] of [["work-board", "/m/work", { width: 1280, height: 900 }, john], ["work-board-phone", "/m/work", { width: 390, height: 844 }, john],
      ["elements", "/m/elements?e=table:votes", { width: 1280, height: 900 }, john], ["elements-phone", "/m/elements?e=table:votes", { width: 390, height: 844 }, john],
      ["data-and-graph", "/m/data", { width: 1280, height: 900 }, john], ["builder", `/m/builder?r=${slug}`, { width: 1280, height: 900 }, john]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 }); await ctx.addCookies(cookieFor(who));
      const p = await ctx.newPage(); await p.goto(B + url); await p.waitForTimeout(2500);
      await p.screenshot({ path: path.join(OUT, `${name}.png`) }); report.push(`${name}.png`); await ctx.close();
    }

    // --- video 1: the work board: claim, a collision refused, release ---
    const v1 = [];
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: VID, size: { width: 1280, height: 800 } } }); await ctx.addCookies(cookieFor(john));
      const p = await ctx.newPage(); await p.goto(B + "/m/work"); await p.waitForTimeout(1500);
      await caption(p, "John's work board: open tasks ranked for him, each score shown as the points behind it"); await p.waitForTimeout(3200);
      await caption(p, "An agent already holds a task and its files (Who holds what)"); await p.locator("#wkClaims").scrollIntoViewIfNeeded(); await p.waitForTimeout(2800);
      await p.locator("#wkNext").scrollIntoViewIfNeeded(); await p.selectOption("#wkNext select", "agent"); await p.waitForTimeout(1500);
      await caption(p, "Ranked for an agent instead: people's decisions drop out"); await p.waitForTimeout(2600);
      await caption(p, "John claims the top task for the agent"); await p.locator("#wkNext .btn.primary").first().click(); await p.waitForTimeout(2600);
      await p.evaluate(() => window.scrollTo(0, 0)); await caption(p, "The claim is a lease: it runs out on its own; anyone else's claim on the same files is refused"); await p.waitForTimeout(3600);
      await p.close(); v1.push(await p.video().path()); await ctx.close(); }
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: VID, size: { width: 1280, height: 800 } } }); await ctx.addCookies(cookieFor(matt));
      const p = await ctx.newPage(); await p.goto(B + "/m/work"); await p.waitForTimeout(1500);
      await caption(p, "Matt, on his own board, tries a task whose files the agent holds"); await p.waitForTimeout(2600);
      const r = await act(matt, "work.claim", { task: "sample:matt-edit", files: ["modules/lab/production.js"], intent: "Sample (test data)" }); void r;
      await p.evaluate(async () => { const box = document.getElementById("wkStatus"); try { await api("/api/data/actions/work.claim", { body: { input: { task: "sample:matt-edit", files: ["modules/lab/production.js"] } } }); } catch (e) { box.className = "err"; box.textContent = e.message; } });
      await caption(p, "Refused, naming who holds the file and until when; nothing was overwritten"); await p.waitForTimeout(4200);
      await p.locator("#wkConflicts").scrollIntoViewIfNeeded(); await caption(p, "Collisions lists tasks that will touch the same files, in the order to do them"); await p.waitForTimeout(3600);
      await p.close(); v1.push(await p.video().path()); await ctx.close(); }
    report.push(`work-board video ${JSON.stringify(encode(v1, "work-board"))} KB`);

    // --- video 2: two people on one response in the builder ---
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: VID, size: { width: 1280, height: 800 } } }); await ctx.addCookies(cookieFor(matt));
      await act(john, "work.claim", { task: `response:${slug}`, soft: true, minutes: 30 });
      const p = await ctx.newPage(); await p.goto(`${B}/m/builder?r=${slug}`); await p.waitForTimeout(2000);
      await caption(p, "Matt opens a paper response. The builder says John has it open too"); await p.waitForTimeout(3600);
      const ta = p.locator("textarea").nth(1); await ta.scrollIntoViewIfNeeded(); await slowType(ta, "Does the gate really help?"); await p.waitForTimeout(600);
      await caption(p, "Meanwhile John saves an edit (version 2) in his window"); await act(john, "responses.edit-line", { slug, beat: 0, line: 2, text: "We read every section to find out.", expectVersion: 1 }); await p.waitForTimeout(2600);
      await caption(p, "Matt saves his edit, made against version 1"); await p.locator(".bd-line .btn").nth(1).click(); await p.waitForTimeout(1200);
      await p.evaluate(() => window.scrollTo(0, 0)); await caption(p, "Refused: it names who saved in between. The page reloads John's version"); await p.waitForTimeout(4200);
      const ta2 = p.locator("textarea").nth(1); await ta2.scrollIntoViewIfNeeded(); await slowType(ta2, "Does the gate really help?"); await p.locator(".bd-line .btn").nth(1).click(); await p.waitForTimeout(1500);
      await p.evaluate(() => window.scrollTo(0, 0)); await caption(p, "Saved again on top of John's version: version 3, both edits kept"); await p.waitForTimeout(3600);
      await p.close(); report.push(`builder video ${JSON.stringify(encode([await p.video().path()], "builder-two-editors"))} KB`); await ctx.close(); }

    // --- video 3: the element catalog ---
    { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: VID, size: { width: 1280, height: 800 } } }); await ctx.addCookies(cookieFor(john));
      const p = await ctx.newPage(); await p.goto(B + "/m/elements"); await p.waitForTimeout(2200);
      await caption(p, "Every table, type, operation, module, requirement, task and learning, described the same way"); await p.waitForTimeout(3400);
      await slowType(p.locator('#elNav input[type="search"]'), "bookmark"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
      await caption(p, "Search by the words people use: 'bookmark' finds table:saves"); await p.locator("#elNav ul a").first().click(); await p.waitForTimeout(2600);
      await caption(p, "Its grain, keys, lifecycle, series, aliases and tags; then its properties and relationships"); await p.locator("#elOne").scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
      await p.mouse.wheel(0, 600); await p.waitForTimeout(2200);
      const check = p.getByText("Check its data here"); await check.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -260)); await check.click();
      await p.waitForFunction(() => { const b = [...document.querySelectorAll("#elOne button")].find((x) => /Check its data/.test(x.textContent)); return b && b.nextElementSibling && b.nextElementSibling.textContent.length > 5; }, null, { timeout: 15000 });
      await caption(p, "Its rows are checked against the keys and the SHACL shape generated from the description"); await p.waitForTimeout(4200);
      await p.close(); report.push(`elements video ${JSON.stringify(encode([await p.video().path()], "elements"))} KB`); await ctx.close(); }

    await browser.close();
    console.log(`demo: wrote to docs/demo/\n  ${report.join("\n  ")}`);
  } finally { srv.kill(); }
})().catch((e) => { console.error(`demo: ${e.message}`); process.exit(1); });
