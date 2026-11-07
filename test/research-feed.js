#!/usr/bin/env node
// "The research site feeds the feed", end to end on synthetic data (test data):
//   1. a research-profile server, seeded with reviews, serves /research and /research/feed.xml only when RESEARCH_PUBLIC=1
//      (otherwise 404, with noindex either way), and leaves out doubtful reviews and comments;
//   2. the spec version takes that RSS as one more source: it parses, the items are judged in scope, and a write-up
//      about a paper already in the feed joins that paper's story instead of making a second one.
// The spec version refuses to fetch localhost (lib/feeds.js assertPublicUrl), so step 2 hands it the fetched body:
// the same parse and ingest a scheduled harvest runs after its fetch.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawn } = require("node:child_process");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

const PAPER = { kind: "paper", title: "Sample paper: Scaling Laws for Test-Time Compute in Reasoning Agents", url: "http://arxiv.org/abs/2611.00001v1", authors: "Sample Author C (test data)",
  text: "We evaluated 4 reasoning agents on 800 planning tasks from a held-out test set. Compared with the baseline that uses a fixed budget, adaptive test-time compute solved 52.4% of tasks versus 47.1%, a gain of 5.3 points (95% confidence interval 3.1 to 7.5, across 5 seeds). Limitations: the tasks are synthetic and short. Code and data are available at github.com/sample-org/sample-tt. (Synthetic test record.)" };

// Child mode: a research-profile server on a throwaway SQLite database, seeded through the review desk's own saveReview.
if (process.argv[2] === "--serve") {
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-research-")); process.env.SITE_PROFILE = "research"; process.env.FETCH_MINUTES = "0";
  const { app, db, boot } = require("../server"), { saveReview } = require("../modules/review/store"), S = require("../modules/review/samples.json");
  (async () => {
    await boot();
    for (const s of S.samples || S) await saveReview(db, s);
    await saveReview(db, PAPER);
    app.listen(Number(process.env.PORT), () => console.log("ready"));
  })().catch((e) => { console.error(e); process.exit(1); });
  return;
}

const serve = (port, env) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ["--no-warnings", __filename, "--serve"], { env: { ...process.env, PORT: String(port), ...env }, stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (b) => { if (/ready/.test(String(b))) resolve(p); });
  p.on("exit", (c) => reject(new Error(`research server exited ${c}`)));
});

(async () => {
  const open = await serve(3291, { RESEARCH_PUBLIC: "1" }), closed = await serve(3292, { RESEARCH_PUBLIC: "" });
  try {
    console.log("Research site (SITE_PROFILE=research)");
    const hidden = await fetch("http://localhost:3292/research/feed.xml");
    ok(hidden.status === 404 && /noindex/.test(hidden.headers.get("x-robots-tag") || ""), "without RESEARCH_PUBLIC=1 the feed is hidden (404, noindex) from anyone not signed in as admin");
    const r = await fetch("http://localhost:3291/research/feed.xml"), xml = await r.text();
    ok(r.ok && /rss\+xml/.test(r.headers.get("content-type")) && /noindex/.test(r.headers.get("x-robots-tag") || ""), "with RESEARCH_PUBLIC=1 the feed is served as RSS, still noindex");
    ok(xml.includes("Measuring self-improvement in coding agents") && xml.includes("Scaling Laws for Test-Time Compute"), "credible reviewed papers are in the feed");
    ok(!xml.includes("Superintelligence is here and everything changes") && !xml.includes("comment on an interpretability result"), "the doubtful hype post and the comment are left out");
    const link = (xml.match(/<link>(http:\/\/localhost:3291\/research\/paper\/\d+)<\/link>/) || [])[1];
    const pg = link ? await fetch(link) : null, html = pg ? await pg.text() : "";
    ok(pg && pg.ok && /Research preview/.test(html) && /name="robots" content="noindex/.test(html), "each item links to a write-up page tagged Research preview, noindex");
    ok(/Our verdict from the abstract/.test(html) && /What it claims/.test(html) && /doc:[0-9a-f]{12}/.test(html), "the write-up explains the verdict in plain words, lists claims and names its trace");
    ok(/How it was judged/.test(html) && /½ × \d+ \+ ½ × \(100 − \d+\) = <b>\d+<\/b>/.test(html) && /because credibility/.test(html), "the write-up shows its scorecard: each criterion met or not, the credibility arithmetic and the verdict rule");
    const crit = await (await fetch("http://localhost:3291/research/criteria")).text();
    ok(/How we judge a paper/.test(crit) && /Shares code, data or weights/.test(crit) && /none of the rules above applied/.test(crit), "the criteria page publishes the rigor checks and the verdict rules");
    const idx = await (await fetch("http://localhost:3291/research")).text();
    ok(/Superintelligence research, explained/.test(idx) && /\/research\/topic\//.test(idx), "the index lists papers and topic dossiers");
    const doubt = await fetch("http://localhost:3291/research/paper/2");
    ok(doubt.status === 404, "a doubtful review has no public write-up");

    console.log("Spec version takes the research feed as a source (SITE_PROFILE=spec)");
    delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-spec-")); process.env.SITE_PROFILE = "spec"; process.env.FETCH_MINUTES = "0";
    const { db, ingestItems, boot } = require("../server"), feeds = require("../lib/feeds");
    await boot();
    const add = async (name, kind, format, url, body) => {
      const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, url);
      const items = feeds.parse(format, body); await ingestItems(id, items); return { id, items };
    };
    await add("Sample arXiv feed (test data)", "papers", "arxiv", "fixture://sample-atom.xml", fs.readFileSync(path.join(__dirname, "fixtures", "sample-atom.xml"), "utf8"));
    const rs = await add("Research write-ups (Sample, test data)", "research-org", "rss", "https://research.example.test/research/feed.xml", xml);
    ok(rs.items.length >= 2 && rs.items.every((i) => /\/research\/(paper|topic)\//.test(i.url) && i.summary), "the spec version's RSS parser reads every item with its plain-language summary");
    const links = await db.all("SELECT l.story_id, s.in_scope, s.title FROM story_links l JOIN stories s ON s.id = l.story_id WHERE l.source_id = ?", rs.id);
    ok(links.length === rs.items.length, `every research item became a story link (${links.length})`);
    ok(links.every((l) => Number(l.in_scope) === 1), "the spec version's own scope rule keeps every research item (about superintelligence)");
    const joined = await db.get("SELECT COUNT(DISTINCT l.source_id) AS n FROM stories s JOIN story_links l ON l.story_id = s.id WHERE s.title LIKE '%Scaling Laws for Test-Time Compute%'");
    ok(Number(joined.n) === 2, "the write-up about an arXiv paper joins that paper's story as a second source, not a duplicate story");
  } finally { open.kill(); closed.kill(); }
  console.log(`\nresearch feed: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
