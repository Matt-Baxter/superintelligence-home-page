#!/usr/bin/env node
// Design screenshots: the same pages at 1280 px and 390 px, light and dark, saved to shots/design/<label>-<page>-<w>[-dark].png.
// Run against `SITE_PROFILE=extended node test/serve-fixtures.js` (port 3200), once before and once after a design change:
//   node test/design-shots.js before      node test/design-shots.js after
// Checks: no sideways scroll at 390 px, no page errors.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const B = process.env.BASE || "http://localhost:3200", label = process.argv[2] || "now";
const DIR = path.join(__dirname, "..", "shots", "design"); fs.mkdirSync(DIR, { recursive: true });
const PAGES = [
  ["signin", "/", { out: true }], ["feed", "/"], ["story", "/story?id=FIRST"], ["sources", "/sources"],
  ["review", "/m/review", { act: async (p) => { await p.click('[data-sample="hype-post"]'); await p.click("#bCheck"); await p.waitForFunction(() => /Judged/.test(document.querySelector("#status").textContent)); } }],
  ["map", "/m/map"], ["lab", "/m/lab#/x/toy-superposition"],
];
(async () => {
  const b = await chromium.launch(); let errs = [], overflow = [];
  for (const [w, h] of [[1280, 900], [390, 844]]) for (const scheme of w === 1280 ? ["light", "dark"] : ["light"]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(B + "/"); const out = await ctx.newPage(); await out.goto(B + "/"); await out.waitForTimeout(400);
    await out.screenshot({ path: path.join(DIR, `${label}-signin-${w}${scheme === "dark" ? "-dark" : ""}.png`) }); await out.close();
    await p.evaluate(() => fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "design-" + Date.now() + Math.floor(Math.random() * 1e4), password: "sample-pass-123" }) }));
    const first = await p.evaluate(async () => ((await (await fetch("/api/stories")).json()).stories || [])[0]?.id);
    for (const [name, url, opt = {}] of PAGES) {
      if (opt.out) continue;
      await p.goto(B + url.replace("FIRST", first)); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
      if (opt.act) { await opt.act(p); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); }
      if (w === 390 && (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))) overflow.push(name);
      await p.screenshot({ path: path.join(DIR, `${label}-${name}-${w}${scheme === "dark" ? "-dark" : ""}.png`), fullPage: w === 390 ? false : name !== "lab" });
    }
    await ctx.close();
  }
  console.log(`design shots (${label}): ${fs.readdirSync(DIR).filter((f) => f.startsWith(label + "-")).length} files; sideways scroll at 390px: ${overflow.join(", ") || "none"}; page errors: ${errs.length ? errs.join("; ") : "none"}`);
  await b.close(); process.exit(errs.length || overflow.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(1); });
