#!/usr/bin/env node
// Daily paper watcher: find new superintelligence, interpretability and self-improvement papers on arXiv, judge each
// with the Review desk (guarded score, credibility, verdict), catalog it in the knowledge graph as doc:<hash>, queue a
// paper-to-code job for the most credible on-topic ones, and write a dated digest. Runs once and exits (no polling).
//
//   node scripts/watch.js                     query arXiv (modules/review/watch.json), at most once a day
//   node scripts/watch.js --from <file>       use entries someone already fetched: arXiv Atom XML, or JSON
//                                             [{title, url, summary, authors[], published?}] (how an agent without
//                                             direct network access, or a test, feeds it)
//   --people   also search the watchlist by author name      --dry   judge and write the digest, store nothing
//   --max N    store at most N new papers (default maxNewPerRun)
//
// Environment: DATABASE_URL or DATA_DIR, like the server. ARXIV_API overrides the API base (tests). Digest files go to
// out/watch/<date>.md and .json (gitignored). Free tier: one run a day, <= 5 queries plus people, 3 s apart.
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, "..");
const args = process.argv.slice(2), has = (f) => args.includes(f), val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const CFG = require("../modules/review/watch.json");
const feeds = require("../lib/feeds");
const { ontology } = require("../lib/tagger");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.WATCH_OUT || path.join(root, "out", "watch");

function parseEntries(text) {
  const t = String(text).trim();
  if (t.startsWith("[") || t.startsWith("{")) { const j = JSON.parse(t); return (Array.isArray(j) ? j : j.entries || []).map((e) => ({ title: e.title, url: e.url, summary: e.summary || e.abstract || "", authors: e.authors || [], published: e.published || "" })); }
  return feeds.parseXml(t);
}
async function fetchArxiv() {
  const base = process.env.ARXIV_API || "https://export.arxiv.org/api/query?", out = [];
  const qs = [...CFG.queries.map((q) => ({ id: q.id, q: q.q }))];
  if (has("--people")) for (const p of ontology.people || []) qs.push({ id: `person:${p.id}`, q: `au:"${p.label}"` });
  for (const [i, q] of qs.entries()) {
    if (i) await sleep(Number(process.env.WATCH_DELAY_MS ?? 3100)); // arXiv: one request every 3 seconds
    const url = base.startsWith("fixture://") ? base : `${base}search_query=${encodeURIComponent(q.q)}&sortBy=submittedDate&sortOrder=descending&max_results=${CFG.maxPerQuery}`;
    try { const items = feeds.parseXml((await feeds.fetchText(url, { timeoutMs: 20000 })).body); out.push(...items.map((e) => ({ ...e, query: q.id }))); console.log(`  ${q.id}: ${items.length}`); }
    catch (e) { console.log(`  ${q.id}: failed (${e.message})`); }
  }
  return out;
}
const arxivId = (u) => (String(u).match(/(\d{4}\.\d{4,5})/) || [])[1] || null;

async function main() {
  const from = val("--from"), dry = has("--dry"), max = Number(val("--max")) || CFG.maxNewPerRun;
  console.log(`Paper watcher ${dry ? "(dry run) " : ""}${from ? `reading ${from}` : "asking arXiv"}`);
  let entries = from ? parseEntries(fs.readFileSync(from, "utf8")) : await fetchArxiv();
  // One entry per arXiv id (several queries can find the same paper); no Twitter/X links.
  const seen = new Set(); entries = entries.filter((e) => e && e.title && !/(^|\/\/|\.)(twitter\.com|x\.com)\//i.test(e.url || "")).filter((e) => { const k = arxivId(e.url) || e.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

  let db = null, saveReview = null, R = require("../modules/review/review");
  if (!dry) {
    db = require("../lib/db"); const { createKernel } = require("../kernel/kernel"); const k = createKernel();
    db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
    saveReview = require("../modules/review/store").saveReview;
  }
  const rows = []; let stored = 0, already = 0;
  for (const e of entries) {
    const x = { kind: "paper", title: e.title, text: e.summary, authors: (e.authors || []).join(", "), url: e.url };
    if (dry) { const r = R.review(x); rows.push({ e, r, isNew: true }); continue; }
    if (stored >= max) break;
    const out = await saveReview(db, x, null);
    if (out.existing) already++; else stored++;
    rows.push({ e, r: out.review, isNew: !out.existing, docId: out.row.id });
  }
  // Paper-to-code: the most credible new papers on the watched topics become Learn studio jobs (an agent does them).
  const P = CFG.paperToCode, queued = [];
  // Surveys have no single method to implement, so they are catalogued but not queued.
  const cands = rows.filter((x) => x.isNew && !x.r.survey && x.r.credibility >= P.minCredibility && x.r.edges.some((ed) => P.topics.includes(ed.dst)))
    .sort((a, b) => b.r.credibility + b.r.score - (a.r.credibility + a.r.score)).slice(0, P.maxPerRun);
  for (const c of cands) {
    if (!dry) {
      const note = `Paper: ${c.e.title}\n${c.e.url}\nFrom the daily watcher (review #${c.docId}: ${c.r.verdict}, score ${c.r.score}, credibility ${c.r.credibility}). Build a CPU toy of the core method with a test, and a Lab example (idea, reproduction, our hypothesis).`;
      const dup = await db.get("SELECT id FROM learn_jobs WHERE kind = 'paper-to-code' AND note LIKE ?", `%${c.e.url}%`);
      if (dup) continue;
      const id = await db.insert("INSERT INTO learn_jobs (kind, note, updated_at) VALUES ('paper-to-code', ?, ?)", note, new Date().toISOString());
      queued.push({ id, title: c.e.title, url: c.e.url });
    } else queued.push({ id: null, title: c.e.title, url: c.e.url });
  }

  const day = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(OUT, { recursive: true });
  const topicsOf = (r) => r.edges.filter((ed) => ed.rel === "about").map((ed) => ed.dst.slice(6)).join(", ");
  const md = [`# Paper watch, ${day}`, "", `${entries.length} papers found, ${stored} new${dry ? " (dry run: nothing stored)" : ""}, ${already} already in the catalog, ${queued.length} queued for paper-to-code. Scores come from the Review desk's guarded judges; people are matched by name only.`, "",
    "| Paper | Verdict | Score | Credibility | Band | Topics | New |", "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.sort((a, b) => b.r.credibility - a.r.credibility).map(({ e, r, isNew }) => `| [${e.title.replace(/\|/g, "/")}](${e.url}) | ${r.verdict} | ${r.score} | ${r.credibility} | ${require("../modules/review/bands").digest(r)} | ${topicsOf(r)} | ${isNew ? "yes" : ""} |`), "",
    "## Queued for paper-to-code", "", ...(queued.length ? queued.map((q) => `- ${q.id ? `job #${q.id}: ` : ""}[${q.title}](${q.url})`) : ["- nothing new qualified today"]), ""];
  fs.writeFileSync(path.join(OUT, `${day}.md`), md.join("\n"));
  fs.writeFileSync(path.join(OUT, `${day}.json`), JSON.stringify({ day, found: entries.length, stored, already, queued, papers: rows.map(({ e, r, isNew }) => ({ title: e.title, url: e.url, arxiv: arxivId(e.url), verdict: r.verdict, score: r.score, credibility: r.credibility, topics: topicsOf(r), isNew, qid: r.qid })) }, null, 2));
  console.log(`watch: ${entries.length} found, ${stored} new, ${already} already catalogued, ${queued.length} queued for paper-to-code -> out/watch/${day}.md`);
}
main().then(() => process.exit(0), (e) => { console.error("watch:", e.message); process.exit(1); });
