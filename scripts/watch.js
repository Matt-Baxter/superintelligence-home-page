#!/usr/bin/env node
// Daily paper watcher: find new superintelligence, interpretability and self-improvement papers on arXiv, judge each
// with the Review desk (guarded score, credibility, verdict), catalog it in the knowledge graph as doc:<hash>, queue a
// paper-to-code job for the most credible on-topic ones, and write a dated digest. Runs once and exits (no polling).
//
//   node scripts/watch.js                     query arXiv (modules/review/watch.json); the schedule runs it once a day
//   node scripts/watch.js --from <file>       use entries someone already fetched: arXiv Atom XML, or JSON
//                                             [{title, url, summary, authors[], published?}] (how an agent without
//                                             direct network access, or a test, feeds it)
//   --people   also search the watchlist by author name      --dry   judge and write the digest, store nothing
//   --max N    store at most N new papers (default maxNewPerRun; the rest are listed as "over the cap")
//   --day YYYY-MM-DD  date the digest (default: the date in the --from file name, else today in UTC)
//
// Papers are keyed by arXiv id (version dropped, URL canonicalised to https://arxiv.org/abs/<id>): repeats across
// queries, papers already turned into Lab examples (modules/lab/examples.json) and papers already queued are skipped.
//
// Environment: DATABASE_URL or DATA_DIR, like the server. ARXIV_API overrides the API base (tests). Digest files go to
// out/watch/<date>.md and .json (gitignored). Free tier: one scheduled run a day, the configured queries (plus one per
// watchlist person with --people), 3 s apart.
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
  if (has("--people")) for (const p of ontology.people || []) qs.push({ id: `people-${p.id}`, q: `au:"${p.label}"` });
  for (const [i, q] of qs.entries()) {
    if (i) await sleep(Number(process.env.WATCH_DELAY_MS ?? 3100)); // arXiv: one request every 3 seconds
    const url = base.startsWith("fixture://") ? base : `${base}search_query=${encodeURIComponent(q.q)}&sortBy=submittedDate&sortOrder=descending&max_results=${CFG.maxPerQuery}`;
    try { const items = feeds.parseXml((await feeds.fetchText(url, { timeoutMs: 20000 })).body); out.push(...items.map((e) => ({ ...e, query: q.id }))); console.log(`  ${q.id}: ${items.length}`); }
    catch (e) { console.log(`  ${q.id}: failed (${e.message})`); }
  }
  return out;
}
// Only real arXiv links count (arxiv.org/abs|pdf/<id>[vN] or "arXiv:<id>"), so a DOI with digits isn't taken for one.
const arxivId = (u) => (String(u || "").match(/(?:arxiv\.org\/(?:abs|pdf)\/|\barxiv:\s*)(\d{4}\.\d{4,5})(?:v\d+)?/i) || [])[1] || null;
const absUrl = (id) => `https://arxiv.org/abs/${id}`;
// Papers already turned into Lab examples (their source link), so the watcher doesn't queue them again.
const inLab = () => { try { return new Set(require("../modules/lab/examples.json").examples.map((e) => arxivId(e.source && e.source.url)).filter(Boolean)); } catch { return new Set(); } };

async function main() {
  const from = val("--from"), dry = has("--dry"), max = val("--max") != null ? Math.max(0, Number(val("--max")) || 0) : CFG.maxNewPerRun;
  console.log(`Paper watcher ${dry ? "(dry run) " : ""}${from ? `reading ${from}` : "asking arXiv"}`);
  let entries = from ? parseEntries(fs.readFileSync(from, "utf8")) : await fetchArxiv();
  // One entry per arXiv id (several queries can find the same paper); no Twitter/X links.
  const seen = new Set(); entries = entries.filter((e) => e && e.title && !/(^|\/\/|\.)(twitter\.com|x\.com)\//i.test(e.url || "")).filter((e) => { const k = arxivId(e.url) || e.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((e) => { const id = arxivId(e.url); return { ...e, arxiv: id, url: id ? absUrl(id) : e.url }; });
  const lab = inLab();

  let db = null, saveReview = null, R = require("../modules/review/review");
  if (!dry) {
    db = require("../lib/db"); const { createKernel } = require("../kernel/kernel"); const k = createKernel();
    db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
    saveReview = require("../modules/review/store").saveReview;
  }
  const rows = []; let stored = 0, already = 0, overCap = 0;
  for (const e of entries) {
    const x = { kind: "paper", title: e.title, text: e.summary, authors: (e.authors || []).join(", "), url: e.url };
    if (dry) { const r = R.review(x); rows.push({ e, r, isNew: true }); continue; }
    if (stored >= max) { overCap++; continue; } // listed in the count, not stored; the next run picks them up
    const out = await saveReview(db, x, null);
    if (out.existing) already++; else stored++;
    rows.push({ e, r: out.review, isNew: !out.existing, docId: out.row.id });
  }
  // Paper-to-code: the most credible new papers on the watched topics become Learn studio jobs (an agent does them).
  const P = CFG.paperToCode, queued = [];
  // Surveys have no single method to implement, so they are catalogued but not queued.
  // Papers already in the Lab, or already queued (matched by arXiv id), are dropped before the per-run limit is applied.
  const cands = [];
  for (const c of rows.filter((x) => x.isNew && !x.r.survey && x.r.credibility >= P.minCredibility && x.r.edges.some((ed) => P.topics.includes(ed.dst)))
    .sort((a, b) => b.r.credibility + b.r.score - (a.r.credibility + a.r.score))) {
    if (cands.length >= P.maxPerRun) break;
    if (c.e.arxiv && lab.has(c.e.arxiv)) continue;
    if (!dry && await db.get("SELECT id FROM learn_jobs WHERE kind = 'paper-to-code' AND (note LIKE ? OR note LIKE ?)", `%${c.e.url}%`, `%${c.r.qid}%`)) continue;
    cands.push(c);
  }
  for (const c of cands) {
    if (!dry) {
      const note = `Paper: ${c.e.title}\n${c.e.url}\nFrom the daily watcher (${c.r.qid}, review #${c.docId}: ${c.r.verdict}, score ${c.r.score}, credibility ${c.r.credibility}). Build a CPU toy of the core method with a test, and a Lab example (idea, reproduction, our hypothesis).`;
      const id = await db.insert("INSERT INTO learn_jobs (kind, note, updated_at) VALUES ('paper-to-code', ?, ?)", note, new Date().toISOString());
      queued.push({ id, title: c.e.title, url: c.e.url });
    } else queued.push({ id: null, title: c.e.title, url: c.e.url });
  }

  const day = val("--day") || (from && (path.basename(from).match(/\d{4}-\d{2}-\d{2}/) || [])[0]) || new Date().toISOString().slice(0, 10);
  fs.mkdirSync(OUT, { recursive: true });
  const topicIds = (r) => r.edges.filter((ed) => ed.rel === "about").map((ed) => ed.dst), topicsOf = (r) => topicIds(r).map((q) => q.slice(6)).join(", ");
  const md = [`# Paper watch, ${day}`, "", `${entries.length} papers found, ${stored} new${dry ? " (dry run: nothing stored)" : ""}, ${already} already in the catalog${overCap ? `, ${overCap} over the cap of ${max} (left for the next run)` : ""}, ${queued.length} queued for paper-to-code. Scores come from the Review desk's guarded judges; people are matched by name only.`, "",
    "| Paper | Verdict | Score | Credibility | Topics | New |", "| --- | --- | --- | --- | --- | --- |",
    ...rows.sort((a, b) => b.r.credibility - a.r.credibility).map(({ e, r, isNew }) => `| [${e.title.replace(/\|/g, "/")}](${e.url}) | ${r.verdict} | ${r.score} | ${r.credibility} | ${topicsOf(r)} | ${isNew ? "yes" : ""} |`), "",
    "## Queued for paper-to-code", "", ...(queued.length ? queued.map((q) => `- ${q.id ? `job #${q.id}: ` : ""}[${q.title}](${q.url})`) : ["- nothing new qualified today"]), ""];
  fs.writeFileSync(path.join(OUT, `${day}.md`), md.join("\n"));
  fs.writeFileSync(path.join(OUT, `${day}.json`), JSON.stringify({ day, found: entries.length, stored, already, overCap, queued, papers: rows.map(({ e, r, isNew }) => ({ title: e.title, url: e.url, arxiv: e.arxiv, query: e.query || null, verdict: r.verdict, score: r.score, credibility: r.credibility, topics: topicIds(r), isNew, inLab: !!(e.arxiv && lab.has(e.arxiv)), qid: r.qid })) }, null, 2));
  console.log(`watch: ${entries.length} found, ${stored} new, ${already} already catalogued, ${overCap ? `${overCap} over the cap, ` : ""}${queued.length} queued for paper-to-code -> ${path.relative(root, path.join(OUT, `${day}.md`))}`);
}
main().then(() => process.exit(0), (e) => { console.error("watch:", e.message); process.exit(1); });
