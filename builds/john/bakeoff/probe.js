// Black-box probe of both deployed builds. It only reads public pages: no sign-ups, no votes.
// Output goes into evidence.json as (a) a 20-story relevance sample per build with a rule pre-check
// and empty judge slots, and (b) "probe" notes on ATs. Probe notes never count as AT results.
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { tag } = require("../lib/tagger");
const criteria = require("./criteria.json");

const FILE = path.join(__dirname, "evidence.json");
const SOCIAL = /(^|\.)(twitter\.com|x\.com)$/i;

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return { acceptance: [], relevance: {}, manual: {} }; }
}

async function sampleTitles(page, base, need) {
  const origin = new URL(base).origin;
  return page.evaluate(({ origin, need }) => {
    const seen = new Set(); const out = [];
    for (const a of document.querySelectorAll("main a[href], article a[href], a[href]")) {
      const text = (a.innerText || "").replace(/\s+/g, " ").trim();
      if (text.length < 25 || text.length > 220 || seen.has(text)) continue;
      const href = new URL(a.getAttribute("href"), location.href);
      const nav = a.closest("nav, header, footer");
      if (nav) continue;
      seen.add(text); out.push({ title: text, href: href.origin === origin ? href.pathname + href.search : href.href });
      if (out.length >= need) break;
    }
    return out;
  }, { origin, need });
}

async function probe(build, browser, need) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const started = Date.now();
  const res = await page.goto(build.url, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => ({ error: e.message }));
  const loadMs = Date.now() - started;
  const status = res && res.status ? res.status() : null;
  const stories = status && status < 400 ? await sampleTitles(page, build.url, need) : [];
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.href)).catch(() => []);
  const social = hrefs.filter((h) => { try { return SOCIAL.test(new URL(h).hostname); } catch { return false; } });
  await page.close();

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(build.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => null);
  await phone.close();

  return { status, loadMs, stories, social, overflow, error: res && res.error };
}

async function main() {
  const evidence = load();
  const need = criteria.rules.relevanceSample;
  const date = new Date().toISOString().slice(0, 10);
  const browser = await chromium.launch();
  const summary = [];
  try {
    for (const build of criteria.builds) {
      const r = await probe(build, browser, need);
      const prior = new Map(((evidence.relevance[build.id] || {}).stories || []).map((s) => [s.title, s]));
      evidence.relevance[build.id] = {
        sampledFrom: build.url, date,
        stories: r.stories.map((s) => {
          const old = prior.get(s.title);
          const ruleTopics = (tag(s.title, "").topics || []).map((t) => t.label);
          return { title: s.title, href: s.href, ruleTopics, judges: old ? old.judges : { john: null, matt: null } };
        }),
      };
      evidence.acceptance = evidence.acceptance.filter((e) => !(e.build === build.id && e.on === "probe"));
      evidence.acceptance.push(
        { build: build.id, at: "AT-05", on: "probe", date, note: `Live front page links to Twitter/X: ${r.social.length}. Proxy only; AT-05 uses the shared sample data.` },
        { build: build.id, at: "AT-13", on: "probe", date, note: `Front page at 390px: sideways overflow ${r.overflow}px. Proxy only; AT-13 needs the Alignment filter.` },
        { build: build.id, at: "AT-14", on: "probe", date, note: `Public URL answered ${r.status ?? "no response"} in ${(r.loadMs / 1000).toFixed(1)}s.${r.error ? " " + r.error : ""}` },
      );
      summary.push(`${build.id} ${build.url}: HTTP ${r.status ?? "-"}, ${(r.loadMs / 1000).toFixed(1)}s, ${r.stories.length} stories sampled, ${r.social.length} X links, phone overflow ${r.overflow}px`);
    }
  } finally { await browser.close(); }
  fs.writeFileSync(FILE, JSON.stringify(evidence, null, 2) + "\n");
  console.log(summary.join("\n"));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
