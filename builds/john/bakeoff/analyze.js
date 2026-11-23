// Recorded black-box analysis of both deployed builds against CONTRACT.md's acceptance tests.
// Read-only: no sign-ups, votes or saves on production. Per build it writes, under bakeoff/runs/<stamp>/<id>/:
//   video.webm  - the whole session
//   trace.zip   - Playwright trace (open with `npx playwright show-trace trace.zip`)
//   shots/*.png - one screenshot per step, tagged in analysis.json with claim, observation and reasoning
// Then a critique pass rechecks every verdict against its own evidence and corrects it until nothing changes.
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { tag } = require("../lib/tagger");
const criteria = require("./criteria.json");
const { critique } = require("./critique");
const { clear, clef } = require("./metrics");

const SOCIAL = /(^|\.)(twitter\.com|x\.com)$/i;
const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

function stamp() { return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); }

async function snap(page, dir, name) {
  const file = path.join(dir, "shots", `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return path.relative(path.join(dir, ".."), file);
}

async function storyTitles(page, need = 20) {
  return page.evaluate((need) => {
    // Story titles live in headings on both builds; topic chips, source links and banner copy do not.
    const firstLinks = () => {
      const out = [...document.querySelectorAll("h2 a[href], h3 a[href], h4 a[href]")];
      if (out.length >= 5) return out;
      for (const item of document.querySelectorAll("li, article")) {
        if (item.querySelector("li, article")) continue;
        const a = [...item.querySelectorAll("a[href]")].find((x) => (x.innerText || "").trim().length >= 12);
        if (a && !out.includes(a)) out.push(a);
      }
      return out.sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    };
    const collect = (selector, min) => {
      const seen = new Set(); const out = [];
      const nodes = selector === "story" ? firstLinks() : document.querySelectorAll(selector);
      for (const a of nodes) {
        if (a.closest("nav, header, footer, [role=banner], [role=navigation]")) continue;
        const t = (a.innerText || "").replace(/\(opens in a new tab\)/i, "").replace(/\s+/g, " ").trim();
        if (t.length < min || t.length > 220 || seen.has(t)) continue;
        seen.add(t); out.push(t);
        if (out.length >= need) break;
      }
      return out;
    };
    const headed = collect("story", 12);
    return headed.length >= 5 ? headed : collect("a[href]", 25);
  }, need);
}

// Story titles often contain topic words ("...alignment...") and link off-site, so links only count
// when they stay on the build's origin and their accessible name is short, like a filter chip.
async function findControl(page, name) {
  for (const role of ["button", "tab", "checkbox", "option", "link"]) {
    const all = page.getByRole(role, { name, exact: false });
    const n = Math.min(await all.count().catch(() => 0), 30);
    for (let i = 0; i < n; i++) {
      const loc = all.nth(i);
      const ok = await loc.evaluate((el) => {
        const label = (el.innerText || el.getAttribute("aria-label") || "").trim();
        if (label.length > 40) return false;
        if (el.tagName !== "A") return true;
        try { return new URL(el.href, location.href).origin === location.origin; } catch { return false; }
      }).catch(() => false);
      if (ok && await loc.isVisible().catch(() => false)) return { loc, role };
    }
  }
  return null;
}

async function runBuild(build, browser, root) {
  const dir = path.join(root, build.id);
  fs.mkdirSync(path.join(dir, "shots"), { recursive: true });
  const ctx = await browser.newContext({ viewport: DESKTOP, recordVideo: { dir, size: DESKTOP } });
  await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  const steps = [];
  const t0 = Date.now();
  const origin = new URL(build.url).origin;
  const step = (s) => {
    const url = page.url();
    let sameOrigin = false; try { sameOrigin = new URL(url).origin === origin; } catch {}
    steps.push({ n: steps.length + 1, ms: Date.now() - t0, url, ...s, evidence: s.evidence && { ...s.evidence, sameOrigin } });
  };

  const started = Date.now();
  const res = await page.goto(build.url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => ({ error: e.message }));
  const loadMs = Date.now() - started;
  const status = res && res.status ? res.status() : null;
  const titles = status && status < 400 ? await storyTitles(page) : [];
  step({
    at: "AT-14", action: `Open ${build.url}`, shot: await snap(page, dir, "01-front"),
    claim: "The public URL loads a feed a newcomer can read without help.",
    observation: `HTTP ${status ?? "none"} in ${(loadMs / 1000).toFixed(1)}s; ${titles.length} story links visible.`,
    evidence: { status, loadMs, storyCount: titles.length, kind: "probe" },
    verdict: status && status < 400 && titles.length >= 5 ? "pass" : "fail",
    reasoning: "A 2xx response with at least five story links means the feed rendered. Timing the classmate sign-up is a human step this cannot do.",
  });

  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href)).catch(() => []);
  const social = hrefs.filter((h) => { try { return SOCIAL.test(new URL(h).hostname); } catch { return false; } });
  step({
    at: "AT-05", action: "Count links to twitter.com / x.com on the live feed", shot: null,
    claim: "No Twitter/X items appear.",
    observation: `${social.length} Twitter/X links among ${hrefs.length} links.`,
    evidence: { social: social.slice(0, 5), linkCount: hrefs.length, kind: "probe" },
    verdict: social.length === 0 ? "pass" : "fail",
    reasoning: "Zero X links on the live feed agrees with the rule. AT-05 itself is defined on the shared sample data, not live data.",
  });

  const ctl = await findControl(page, /alignment/i);
  let filtered = [];
  if (ctl) {
    await ctl.loc.click({ timeout: 8000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    filtered = await storyTitles(page);
  }
  const onTopic = filtered.filter((t) => (tag(t, "").topics || []).some((x) => /align/i.test(x.id + x.label)));
  step({
    at: "AT-13", action: ctl ? `Click the "${(await ctl.loc.innerText().catch(() => "Alignment")).trim().slice(0, 40)}" ${ctl.role}` : "Look for an Alignment filter",
    shot: await snap(page, dir, "02-alignment"),
    claim: "The Alignment filter shows only Alignment stories.",
    observation: ctl ? `${filtered.length} stories after filtering; the rule tagger tags ${onTopic.length} of their titles as alignment.` : "No Alignment control found.",
    evidence: { found: !!ctl, filtered: filtered.length, ruleAlignment: onTopic.length, titles: filtered.slice(0, 8), kind: "probe" },
    verdict: !ctl ? "fail" : filtered.length > 0 && onTopic.length / filtered.length >= 0.5 ? "pass" : "unknown",
    reasoning: "The rule tagger only sees titles, so a low match rate may mean the build classifies from the abstract. It can contradict the filter but cannot confirm it alone.",
  });

  await page.setViewportSize(PHONE);
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => null);
  step({
    at: "AT-13", action: "Resize the filtered view to a 390px phone", shot: await snap(page, dir, "03-phone"),
    claim: "No sideways scroll on a phone.",
    observation: `Horizontal overflow ${overflow}px at 390px.`,
    evidence: { overflow, kind: "measure" },
    verdict: overflow === 0 ? "pass" : overflow == null ? "unknown" : "fail",
    reasoning: "scrollWidth − innerWidth is the exact sideways scroll a user gets. 0 means none.",
  });
  await page.setViewportSize(DESKTOP);

  await page.goto(build.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  const firstStory = page.locator("main a[href], article a[href]").filter({ hasText: /\w{4,}.{20,}/ }).first();
  let detail = { opened: false, topicWords: false, sourceCount: 0 };
  if (await firstStory.count().catch(() => 0)) {
    const internal = await firstStory.evaluate((a) => new URL(a.href).origin === location.origin).catch(() => false);
    if (internal) {
      await firstStory.click({ timeout: 8000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 20000);
      detail = { opened: true, topicWords: /matched|because|topic|why/i.test(text), sourceCount: (text.match(/source/gi) || []).length };
    }
  }
  step({
    at: "AT-04", action: "Open the first story", shot: await snap(page, dir, "04-story"),
    claim: "A story shows its topic and the words that matched.",
    observation: detail.opened ? `Story page opened; explanation words present: ${detail.topicWords}.` : "First story links off-site or could not be opened.",
    evidence: { ...detail, kind: "probe" },
    verdict: detail.opened && detail.topicWords ? "pass" : "unknown",
    reasoning: "AT-04 needs the specific sample item about AGI timelines. A generic explanation on a live story suggests support but does not prove it.",
  });

  await page.goto(build.url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  const signup = await findControl(page, /sign ?up|create (an )?account|register/i) || await findControl(page, /sign ?in|log ?in/i);
  if (signup) {
    await signup.loc.click({ timeout: 8000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
  const hasForm = await page.locator("input[type=password]").count().catch(() => 0);
  step({
    at: "AT-07", action: signup ? "Open sign-up (not submitted)" : "Look for sign-up",
    shot: await snap(page, dir, "05-signup"),
    claim: "Sign-up with an unused username creates the account and signs in.",
    observation: hasForm ? "A form with a password field is reachable." : "No password form reached.",
    evidence: { reachable: !!signup, passwordField: hasForm > 0, kind: "probe" },
    verdict: "unknown",
    reasoning: "This run does not create accounts on production on purpose, so AT-07 to AT-12 stay with the human pass.",
  });

  await ctx.tracing.stop({ path: path.join(dir, "trace.zip") });
  const video = page.video();
  await ctx.close();
  if (video) { const v = await video.path(); fs.renameSync(v, path.join(dir, "video.webm")); }

  const sample = titles.map((t) => ({ title: t, rel: (tag(t, "").topics || []).length > 0 ? 1 : 0 }));
  return { id: build.id, name: build.name, url: build.url, durationMs: Date.now() - t0, consoleErrors: consoleErrors.slice(0, 10), steps, sample };
}

async function main() {
  const root = path.join(__dirname, "runs", stamp());
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch();
  const builds = [];
  try {
    for (const b of criteria.builds) {
      const first = await runBuild(b, browser, root);
      builds.push(first);
    }
  } finally { await browser.close(); }

  for (const b of builds) {
    const { steps, trace } = critique(b.steps);
    b.initialSteps = b.steps; b.steps = steps; b.critiqueTrace = trace;
    b.clear = clear(b);
    b.clef = clef(b.sample);
  }
  const out = { generated: new Date().toISOString(), contract: "CONTRACT.md", builds };
  fs.writeFileSync(path.join(root, "analysis.json"), JSON.stringify(out, null, 2) + "\n");
  fs.writeFileSync(path.join(__dirname, "runs", "LATEST"), path.basename(root) + "\n");
  for (const b of builds) {
    const v = b.steps.map((s) => `${s.at}:${s.verdict}`).join(" ");
    console.log(`${b.id} ${b.url} ${(b.durationMs / 1000).toFixed(1)}s  ${v}  corrections=${b.critiqueTrace.filter((t) => t.changed).length}  P@k=${b.clef.precisionAtK}`);
  }
  console.log("wrote", path.relative(process.cwd(), root));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
