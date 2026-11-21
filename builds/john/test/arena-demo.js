#!/usr/bin/env node
// Arena walkthrough: drives the Arena in a real browser against `SITE_PROFILE=extended npm run dev:sample` (port 3200),
// checks each step and saves screenshots to shots/arena-*.png. Proves the sandbox, the head-to-head arena, the
// server-checked "apply" (unsafe policy refused, improved policy applied, live router changes) and phone layout.
//   SITE_PROFILE=extended node test/serve-fixtures.js &  node test/arena-demo.js
const { chromium } = require("playwright");
const B = process.env.BASE || "http://localhost:3200";
const S = require("path").join(__dirname, "..", "shots");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const step = async (name, fn) => { try { return await fn(); } catch (e) { throw new Error(`${name}: ${e.message.split("\n")[0]}`); } };
const until = (p, re, sel = "#status") => p.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s).textContent), [sel, re.source], { timeout: 20000 });

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(B + "/"); await p.evaluate(() => fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "arena-demo-" + Date.now(), password: "sample-pass-123" }) }));
  const me = await p.evaluate(async () => (await (await fetch("/api/me")).json()).user);
  const set = async (obj) => { const cur = JSON.parse(await p.inputValue("#code")); await p.fill("#code", JSON.stringify({ ...cur, ...obj }, null, 2)); };

  console.log("Experiment arena (sandboxed in the browser)");
  await step("open", async () => { await p.goto(B + "/m/arena#/ex/rsi-decision-gym"); await until(p, /Done in/); });
  ok(/in your browser/.test(await p.textContent("#status")), "the experiment ran in the browser sandbox");
  await step("pin 1", async () => { await set({ rounds: 12, self_tests: 80 }); await p.click("#bPin"); await until(p, /variant 1/, ".results"); });
  await step("pin 2", async () => { await set({ rounds: 2 }); await p.click("#bPin"); await until(p, /variant 2/, ".results"); });
  const table = await p.$$eval(".results .mt tbody tr", (rs) => rs.map((r) => r.textContent.replace(/\s+/g, " ").trim()));
  ok(table.length === 3 && /variant 1/.test(table[0]), `three contenders ranked; 12 rounds leads: ${table[0]}`);
  await step("save", async () => { await p.click("#bSave"); await until(p, /Saved/); });
  ok(/server re-ran it/.test(await p.textContent("#status")), "saving a variant re-runs it on the server");
  await p.screenshot({ path: `${S}/arena-1-experiment.png` });

  console.log("Policy arena (edit the live decision maker)");
  await step("policy", async () => { await p.click('[data-open="policy"]'); await p.waitForSelector("#tryText"); });
  await step("try", async () => { await p.fill("#tryText", "make a heatmap of compute trends"); await p.click("#bTry"); await until(p, /Yours:/, "#tryOut"); });
  ok(/Live: <?c?o?d?e?>?\s*\S+/.test(await p.textContent("#tryOut")), `a request is decided by both policies: ${await p.textContent("#tryOut")}`);
  await p.screenshot({ path: `${S}/arena-2-policy.png` });
  const pol = JSON.parse(await p.inputValue("#code"));
  if (me.admin) {
    await step("break", async () => { await p.fill("#code", JSON.stringify(pol.if[2])); await p.$eval("#results", (el) => (el.innerHTML = "")); await p.click("#bRun"); await until(p, /Would be refused/, "#results"); });
    ok((await p.textContent("#results")).includes("fails"), "removing the hard refusal rules breaks safety properties in the sandbox");
    await step("refuse", async () => { await p.click("#bApply"); await until(p, /Refused/); });
    ok(/safety properties/.test(await p.textContent("#status")), `the server refuses to apply it: ${(await p.textContent("#status")).slice(0, 90)}`);
    await p.screenshot({ path: `${S}/arena-3-unsafe-refused.png` });
    const improved = JSON.parse(JSON.stringify(pol)); improved.if[2].if.unshift({ "si.match": [{ var: "words" }, "heatmap"] }, "build-dashboard");
    await step("improve", async () => { await p.fill("#code", JSON.stringify(improved)); await p.$eval("#results", (el) => (el.innerHTML = "")); await p.click("#bRun"); await until(p, /Ready to apply|Would be refused/, "#results"); });
    ok(/Ready to apply/.test(await p.textContent("#results")), "a hand-improved policy passes in the sandbox");
    await step("apply", async () => { await p.click("#bApply"); await until(p, /Applied as|Refused/); });
    ok(/Applied as/.test(await p.textContent("#status")), "the server re-checks it and applies it");
    const live = await p.evaluate(async () => (await (await fetch("/api/lab/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "make a heatmap of compute trends" }) })).json()));
    ok(live.action === "build-dashboard" && /applied/.test(live.policy), `the live router now uses it: ${live.action} (${live.policy})`);
    await p.screenshot({ path: `${S}/arena-4-applied.png` });
    await p.evaluate(() => fetch("/api/admin/lab/policy/reset", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  } else console.log("  (not an admin on this server: skipped apply)");

  console.log("Rule playground");
  await step("rule", async () => { await p.click('[data-open="rule"]'); await p.click("#bRun"); await until(p, /Evaluated/); });
  ok((await p.textContent("#results")).includes("In scope: matched agi"), "an si-expr rule evaluates in the sandbox");
  await p.screenshot({ path: `${S}/arena-5-rule.png` });

  console.log("Phone");
  const ph = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await ph.goto(B + "/"); await ph.evaluate(() => fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "arena-phone-" + Date.now(), password: "sample-pass-123" }) }));
  await step("phone", async () => { await ph.goto(B + "/m/arena#/ex/weak-to-strong"); await until(ph, /Done in/); });
  ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "no sideways scrolling at 390px");
  await ph.screenshot({ path: `${S}/arena-6-phone.png`, fullPage: true });
  ok(!errs.length, `no page errors${errs.length ? ": " + errs.join("; ") : ""}`);
  console.log(`\narena demo: ${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(1); });
