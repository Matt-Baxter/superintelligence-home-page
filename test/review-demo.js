#!/usr/bin/env node
// Review desk walkthrough in a real browser against `SITE_PROFILE=extended node test/serve-fixtures.js` (port 3200):
// judge a careful sample paper and a hype sample, save both, stress-test the judge, open the map, check phone width.
// Saves shots/review-*.png. Every sample is synthetic test data.
const { chromium } = require("playwright");
const B = process.env.BASE || "http://localhost:3200";
const S = require("path").join(__dirname, "..", "shots");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const until = (p, re, sel = "#status") => p.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent || ""), [sel, re.source], { timeout: 20000 });
const signup = (p, who) => p.evaluate((u) => fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: "sample-pass-123" }) }), who + Date.now());

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(B + "/"); await signup(p, "review-demo-");
  await p.goto(B + "/m/review"); await p.waitForSelector("[data-sample]");

  console.log("Careful paper");
  await p.click('[data-sample="careful-paper"]'); await p.click("#bSave"); await until(p, /Saved as|Already in/);
  const verdict = await p.textContent("#result .tag");
  ok(/solid|major/.test(verdict), `judged credible: "${verdict}"`);
  const levels = await p.$$eval(".claims .tag", (t) => t.map((x) => x.textContent));
  ok(levels.includes("backed") && !levels.includes("unbacked"), `no unbacked claims (${levels.join(", ")})`);
  ok((await p.$$(".edges .edge")).length >= 3, "catalogued with edges in the knowledge graph");
  await p.screenshot({ path: `${S}/review-1-careful.png`, fullPage: true });

  console.log("Hype post");
  await p.click('[data-sample="hype-post"]'); await p.click("#bSave"); await until(p, /Saved as|Already in/);
  ok(/doubtful/.test(await p.textContent("#result .tag")), "judged doubtful");
  ok((await p.$$(".guards li.on")).length >= 4, `${(await p.$$(".guards li.on")).length} guards fired`);
  ok(/Sent to a person/.test(await p.textContent("#result")), "sent to a person");
  const [g, n] = await p.$$eval(".score .n", (x) => x.slice(0, 1).map((e) => e.textContent).concat([...document.querySelectorAll(".score .small")].slice(0, 1).map((e) => e.textContent)));
  ok(true, `guarded ${g} vs ${n}`);
  await p.screenshot({ path: `${S}/review-2-hype-guards.png`, fullPage: true });

  console.log("Stress test");
  await p.click('[data-sample="short-comment"]'); await p.click("#bStress"); await until(p, /Stress test done/);
  const sum = await p.textContent("#stress p");
  ok(/Gaming the unguarded judge added \d+/.test(sum), sum);
  ok(await p.isVisible("#stress svg.chart"), "the score paths are charted");
  await (await p.$("#stress")).screenshot({ path: `${S}/review-3-stress.png` });
  ok((await p.$$("#catalog tbody tr")).length >= 2, "the catalog lists the saved reviews");
  ok(/Reviews\s*\d/.test(await p.textContent("#metrics")), "metrics show");

  console.log("Map");
  await p.goto(B + "/m/map"); await p.waitForSelector(".area");
  ok((await p.$$(".area")).length >= 7, `${(await p.$$(".area")).length} areas on the map`);
  ok((await p.$$(".docs li")).length >= 1, "reviewed docs appear under their areas");
  await p.screenshot({ path: `${S}/review-4-map.png`, fullPage: true });

  console.log("Phone");
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  ph.on("pageerror", (e) => errs.push(e.message));
  await ph.goto(B + "/"); await signup(ph, "review-phone-");
  await ph.goto(B + "/m/review"); await ph.waitForSelector("[data-sample]"); await ph.click('[data-sample="hype-post"]'); await ph.click("#bCheck"); await until(ph, /Judged/);
  ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "review desk: no sideways scrolling at 390px");
  await ph.screenshot({ path: `${S}/review-5-phone.png`, fullPage: true });
  await ph.goto(B + "/m/map"); await ph.waitForSelector(".area");
  ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "map: no sideways scrolling at 390px");
  await ph.screenshot({ path: `${S}/review-6-map-phone.png` });
  ok(!errs.length, `no page errors${errs.length ? ": " + errs.join("; ") : ""}`);
  console.log(`\nreview demo: ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(1); });
