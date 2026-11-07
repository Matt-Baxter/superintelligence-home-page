#!/usr/bin/env node
// End-to-end fidelity of every data lineage (docs/LINEAGE.md), on SYNTHETIC fixtures and a throwaway SQLite database.
// Method: push the fixtures through the real app (ingest, API, Review desk, watcher, knowledge build, Lab), then replay
// each operator independently in memory (parse -> group -> tag -> judge -> serve) and require every hop's stored and
// served value to equal the replay. A check fails on any item that is lost, duplicated, changed or re-derived
// differently along the way. Known, documented lossy steps (caps, first-source-wins) are asserted as such.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { execFileSync } = require("node:child_process");
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-lineage-"));
process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0"; process.env.ALLOW_FIXTURE_FEEDS = "1";
process.env.SOURCE_CATALOG = path.join(__dirname, "fixtures", "sample-catalog.json");
const root = path.join(__dirname, "..");
const { app, db, ingestItems, boot } = require("../server");
const feeds = require("../lib/feeds"), { tag } = require("../lib/tagger"), A = require("../lib/analysis");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (s) => console.log(`\n${s}`);

// The fixture sources (same set as the spec acceptance server), in ingest order.
const SOURCES = [
  ["Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml"], ["Sample lab blog (test data)", "lab", "rss", "sample-rss.xml"],
  ["Sample daily papers (test data)", "papers", "hf-daily", "sample-hf.json"], ["Sample mixed feed (test data)", "news", "rss", "sample-spec.xml"],
  ["Sample alignment forum (test data)", "forum", "rss", "spec/forum.xml"], ["Sample AI newsletter (test data)", "newsletter", "rss", "spec/newsletter.xml"],
  ["Sample forecasting org (test data)", "research-org", "rss", "spec/forecasting.xml"], ["Sample safety group (test data)", "research-org", "rss", "spec/safety.xml"],
  ["Sample governance group (test data)", "policy", "rss", "spec/policy.xml"],
];
const SOCIAL = /^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i;

(async () => {
  await boot();
  await db.run("UPDATE sources SET status = 'paused'"); // the real default sources are never fetched here
  const srcIds = [];
  for (const [name, kind, format, file] of SOURCES) {
    const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, "fixture://" + file);
    srcIds.push(id); await ingestItems(id, feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8")));
  }
  const server = app.listen(0); const B = `http://localhost:${server.address().port}`;
  const jar = {}; const call = async (who, p, body, method) => {
    const r = await fetch(B + p, { method: method || (body ? "POST" : "GET"), headers: { "content-type": "application/json", ...(jar[who] ? { cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const c = r.headers.get("set-cookie"); if (c) jar[who] = c.split(";")[0];
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  await call("ana", "/api/signup", { username: "sample-ana", password: "correct-horse-9", displayName: "Sample Ana" }); // first user: admin
  await call("ben", "/api/signup", { username: "sample-ben", password: "correct-horse-9", displayName: "Sample Ben" });

  // ---------- A. feed item -> story -> API ----------
  section("A. Feed item -> parsed item -> story -> tags -> score -> API");
  // Replay: parse every fixture and group by key exactly as addItem does, without the database.
  const replay = { byKey: new Map(), stories: [] };
  let parsed = 0, social = 0;
  SOURCES.forEach(([, kind, format, file], si) => {
    const items = feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8")).slice(0, 50);
    for (const it of items) {
      parsed++;
      if (SOCIAL.test(it.url || "")) { social++; continue; }
      const keys = feeds.storyKeys(it); if (!keys.length) continue;
      let s = keys.map((k) => replay.byKey.get(k)).find(Boolean);
      if (!s) { s = { first: it, links: [], keys: new Set() }; replay.stories.push(s); }
      if (it.score) s.ext = Math.max(s.ext || 0, it.score);
      keys.forEach((k) => { if (!replay.byKey.has(k)) replay.byKey.set(k, s); s.keys.add(k); });
      const lk = `${srcIds[si]}|${it.url}`; if (!s.links.some((l) => l.k === lk)) s.links.push({ k: lk, kind, sid: srcIds[si] });
    }
  });
  const rows = await db.all("SELECT * FROM stories ORDER BY id");
  ok(parsed >= 20 && social >= 1, `parsed ${parsed} fixture items (${social} Twitter/X links dropped at ingest)`);
  ok(rows.length === replay.stories.length, `grouping: ${replay.stories.length} stories replayed, ${rows.length} stored (no item lost or split)`);
  // Map each replayed story to its stored row through its keys.
  const keyRows = await db.all("SELECT key, story_id FROM story_keys"), keyToId = new Map(keyRows.map((r) => [r.key, r.story_id]));
  const idOf = (s) => keyToId.get([...s.keys][0]);
  ok(replay.stories.every((s) => [...s.keys].every((k) => keyToId.get(k) === idOf(s))), `every key of a story points at that story (${keyRows.length} keys)`);
  ok(new Set(replay.stories.map(idOf)).size === rows.length, "each stored story is exactly one replayed group");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const fieldBad = [], tagBad = [], scoreBad = [], linkBad = [], entBad = [];
  for (const s of replay.stories) {
    const r = byId.get(idOf(s)), it = s.first;
    // Stored fields: the first source's item (first-source-wins), with the documented caps.
    const want = { title: it.title.slice(0, 500), url: feeds.canonicalUrl(it), summary: (it.summary || "").slice(0, 1500), authors: (it.authors || []).join(", "), published_at: it.published, ext_score: s.ext || 0 };
    for (const [k, v] of Object.entries(want)) if ((r[k] ?? null) !== (v ?? null) && !(k === "ext_score" && Number(r[k]) === Number(v))) fieldBad.push(`#${r.id}.${k}`);
    // Tags: what the tagger gives for the stored text, in stories.topics and story_topics.
    const tg = tag(r.title, r.summary), topicIds = (await db.all("SELECT topic FROM story_topics WHERE story_id = ? ORDER BY topic", r.id)).map((x) => x.topic);
    if (!same(JSON.parse(r.topics), tg.topics) || !same(JSON.parse(r.orgs), tg.orgs) || !same(topicIds, tg.topics.map((t) => t.id).sort())) tagBad.push(`#${r.id}`);
    // Links: one per (source, url).
    const links = await db.all("SELECT source_id, url FROM story_links WHERE story_id = ?", r.id);
    if (links.length !== s.links.length) linkBad.push(`#${r.id} (${links.length} vs ${s.links.length})`);
    // Judging: analyze() on the stored row with the replayed source kinds and coverage.
    const a = A.analyze({ ...r, topics: tg.topics }, { kinds: [...new Set(s.links.map((l) => l.kind))], nsources: new Set(s.links.map((l) => l.sid)).size });
    if (r.significance !== a.significance || !same(JSON.parse(r.analysis), JSON.parse(JSON.stringify(a))) || r.in_scope !== (a.scope.in ? 1 : 0)) scoreBad.push(`#${r.id}`);
    const ents = (await db.all("SELECT kind, entity, value FROM story_entities WHERE story_id = ? ORDER BY kind, entity", r.id)).map((e) => `${e.kind}:${e.entity}:${e.value ?? ""}`);
    const wantE = [...a.benchmarks.map((b) => `benchmark:${b.id}:${b.score?.value ?? ""}`), ...a.people.map((p) => `person:${p.id}:`)].sort();
    if (!same(ents, wantE)) entBad.push(`#${r.id}`);
  }
  ok(!fieldBad.length, `stored title, url, summary, authors, date and outside score equal the first source's item${fieldBad.length ? ": " + fieldBad.join(", ") : ""}`);
  ok(!tagBad.length, `stories.topics, stories.orgs and story_topics equal the tagger on the stored text${tagBad.length ? ": " + tagBad.join(", ") : ""}`);
  ok(!linkBad.length, `one story_links row per (source, url)${linkBad.length ? ": " + linkBad.join(", ") : ""}`);
  ok(!scoreBad.length, `significance, analysis and in_scope equal analyze() replayed with the links' kinds and coverage${scoreBad.length ? ": " + scoreBad.join(", ") : ""}`);
  ok(!entBad.length, `story_entities equal the analysis's benchmarks and people${entBad.length ? ": " + entBad.join(", ") : ""}`);
  ok(rows.every((r) => (r.summary || "").length <= 701 && r.title.length <= 300), "documented cap: titles <= 300 and summaries <= 700 characters (+ ellipsis) after parsing");

  // Serving: every in-scope, visible story comes back once through the paged API, with the stored values.
  const served = []; for (let off = 0; ; off += 40) { const r = await call("ana", `/api/stories?offset=${off}`); served.push(...r.json.stories); if (r.json.stories.length < 40) break; }
  const visible = rows.filter((r) => !r.hidden && r.in_scope !== 0);
  ok(served.length === visible.length && same(served.map((s) => s.id).sort((a, b) => a - b), visible.map((r) => r.id)), `API serves each of the ${visible.length} in-scope stories once (${rows.length - visible.length} out of scope left out)`);
  const serveBad = served.filter((s) => { const r = byId.get(s.id); return s.title !== r.title || s.url !== r.url || s.significance !== r.significance || !same(s.topics, JSON.parse(r.topics)) || !same(s.analysis, JSON.parse(r.analysis)) || s.sources.length !== replay.stories.find((x) => idOf(x) === s.id).links.length || s.nsources !== new Set(replay.stories.find((x) => idOf(x) === s.id).links.map((l) => l.sid)).size; });
  ok(!serveBad.length, `served title, url, significance, topics, analysis, links and coverage equal the stored row${serveBad.length ? ": " + serveBad.map((s) => "#" + s.id).join(", ") : ""}`);
  const one = served[0], detail = await call("ana", `/api/stories/${one.id}`);
  ok(detail.status === 200 && same(Object.fromEntries(Object.keys(one).map((k) => [k, detail.json.story[k]])), one), "GET /api/stories/:id equals the list entry");
  const out = rows.find((r) => r.in_scope === 0);
  ok(!out || (await call("ana", `/api/stories/${out.id}`)).status === 404, "an out-of-scope story is stored but not served");
  // Filters agree with the tables they read.
  const anyTopic = JSON.parse(visible.find((r) => JSON.parse(r.topics).length).topics)[0].id;
  const viaApi = []; for (let off = 0; ; off += 40) { const r = await call("ana", `/api/stories?topic=${anyTopic}&offset=${off}`); viaApi.push(...r.json.stories.map((s) => s.id)); if (r.json.stories.length < 40) break; }
  const viaDb = (await db.all("SELECT t.story_id FROM story_topics t JOIN stories s ON s.id = t.story_id WHERE t.topic = ? AND s.hidden = 0 AND (s.in_scope IS NULL OR s.in_scope <> 0)", anyTopic)).map((x) => x.story_id);
  ok(same(viaApi.sort((a, b) => a - b), viaDb.sort((a, b) => a - b)), `?topic=${anyTopic} returns exactly the story_topics rows (${viaDb.length})`);

  // ---------- B. user actions ----------
  section("B. User actions -> tables -> API");
  const sid = served[0].id;
  await call("ana", `/api/stories/${sid}/vote`, {}); await call("ben", `/api/stories/${sid}/vote`, {}); await call("ben", `/api/stories/${sid}/save`, {});
  await call("ben", `/api/stories/${sid}/notes`, { text: "Sample private note (test data)" });
  const v = (await db.get("SELECT COUNT(*) AS n FROM votes WHERE story_id = ?", sid)).n, sv = (await db.get("SELECT COUNT(*) AS n FROM saves WHERE story_id = ?", sid)).n;
  const asBen = (await call("ben", `/api/stories/${sid}`)).json.story, asAna = (await call("ana", `/api/stories/${sid}`)).json.story;
  ok(v === 2 && asBen.votes === 2 && asAna.votes === 2 && asBen.voted && asAna.voted, "two votes: two rows, and both readers see 2 and their own vote");
  ok(sv === 1 && asBen.saved && !asAna.saved, "a save is one row and only its owner sees it saved");
  ok(asBen.notes === 1 && asAna.notes === 0, "a private note counts for its owner only");
  await call("ana", `/api/stories/${sid}/vote`, {});
  ok((await db.get("SELECT COUNT(*) AS n FROM votes WHERE story_id = ?", sid)).n === 1 && (await call("ben", `/api/stories/${sid}`)).json.story.votes === 1, "un-voting removes the row and the served count follows");

  // ---------- C. Review desk -> review_docs -> knowledge_edges ----------
  section("C. Paper -> Review desk -> review_docs -> knowledge graph");
  const R = require("../modules/review/review");
  const papers = feeds.parse("arxiv", fs.readFileSync(path.join(__dirname, "fixtures", "sample-atom.xml"), "utf8"));
  const x = { kind: "paper", title: papers[0].title, text: papers[0].summary, authors: papers[0].authors.join(", "), url: papers[0].url };
  const posted = await call("ana", "/api/review/docs", x), want = R.review(x);
  const doc = await db.get("SELECT * FROM review_docs WHERE qid = ?", want.qid);
  ok(posted.status === 200 && doc && doc.score === want.score && doc.credibility === want.credibility && doc.verdict === want.verdict, `stored score ${doc?.score}, credibility ${doc?.credibility} and verdict "${doc?.verdict}" equal review() replayed`);
  const edges = (await db.all("SELECT src, rel, dst FROM knowledge_edges WHERE src = ? ORDER BY rel, dst", want.qid)).map((e) => `${e.rel}>${e.dst}`);
  ok(same(edges, want.edges.map((e) => `${e.rel}>${e.dst}`).sort()), `knowledge_edges for ${want.qid} equal the review's catalog edges (${edges.length})`);
  const served2 = await call("ana", `/api/review/docs/${doc.id}`);
  ok(served2.status === 200 && JSON.stringify(served2.json).includes(want.qid) && JSON.stringify(served2.json).includes(String(want.score)), "GET /api/review/docs/:id serves the stored doc");
  ok((await call("ana", "/api/review/docs", x)).status === 200 && (await db.get("SELECT COUNT(*) AS n FROM review_docs WHERE qid = ?", want.qid)).n === 1, "posting the same paper again stores nothing new (one row per doc id)");

  // ---------- D. Paper watcher -> review_docs, learn_jobs, digest ----------
  section("D. Paper watcher -> catalogue -> paper-to-code queue -> digest");
  const W = fs.mkdtempSync(path.join(os.tmpdir(), "si-lineage-w-")), WO = fs.mkdtempSync(path.join(os.tmpdir(), "si-lineage-wo-"));
  execFileSync(process.execPath, ["--no-warnings", "scripts/watch.js", "--from", "test/fixtures/sample-atom.xml", "--day", "2026-01-01"], { cwd: root, env: { ...process.env, DATA_DIR: W, WATCH_OUT: WO }, stdio: "pipe" });
  const dig = JSON.parse(fs.readFileSync(path.join(WO, "2026-01-01.json"), "utf8"));
  const { DatabaseSync } = require("node:sqlite"), wdb = new DatabaseSync(path.join(W, fs.readdirSync(W).find((f) => /\.(db|sqlite)$/.test(f))));
  const wdocs = wdb.prepare("SELECT qid, score, credibility, verdict FROM review_docs").all(), wjobs = wdb.prepare("SELECT note FROM learn_jobs WHERE kind = 'paper-to-code'").all();
  ok(dig.found === papers.length && dig.papers.length === papers.length && wdocs.length === dig.stored, `every entry is in the digest (${dig.papers.length}) and each stored one in review_docs (${wdocs.length})`);
  ok(dig.papers.every((p) => { const d = wdocs.find((w) => w.qid === p.qid), e = papers.find((q) => feeds.arxivId(q.url) === p.arxiv), r = R.review({ kind: "paper", title: e.title, text: e.summary, authors: e.authors.join(", "), url: p.url });
    return d && d.score === p.score && p.score === r.score && d.credibility === r.credibility && d.verdict === r.verdict && same(p.topics, r.edges.filter((x) => x.rel === "about").map((x) => x.dst)); }), "digest rows, review_docs and review() replayed agree on score, credibility, verdict and topics");
  ok(wjobs.length === dig.queued.length && dig.queued.every((q) => wjobs.some((j) => j.note.includes(q.url) && j.note.includes(dig.papers.find((p) => p.url === q.url).qid))), `each queued paper is one learn_jobs row that names its link and doc id (${wjobs.length})`);
  wdb.close();

  // ---------- E. Stories -> knowledge chunks and co-occurrence ----------
  section("E. Stories -> knowledge chunks -> co-occurrence edges");
  const K = require("../modules/knowledge/knowledge"), taggers = require("../lib/taggers");
  const built = await call("ana", "/api/admin/knowledge/build", { limit: 2000 });
  const chunks = await db.all("SELECT story_id, ord, text, tags FROM knowledge_chunks ORDER BY story_id, ord");
  const chunkBad = chunks.filter((c) => !same(JSON.parse(c.tags).map((t) => t.qid).sort(), taggers.tagAll(c.text).map((t) => t.qid).sort()));
  ok(built.status === 200 && chunks.length > 0 && new Set(chunks.map((c) => c.story_id)).size === visible.length, `chunks cover every in-scope story (${new Set(chunks.map((c) => c.story_id)).size} stories, ${chunks.length} chunks)`);
  ok(!chunkBad.length, `each chunk's stored tags equal the taggers on its text${chunkBad.length ? `: ${chunkBad.length} differ` : ""}`);
  const co = K.coOccurrence(chunks.map((c) => ({ ...c, tags: JSON.parse(c.tags) })));
  const coDb = await db.all("SELECT src, dst, weight FROM knowledge_edges WHERE rel = 'co-occurs'");
  ok(co.length === coDb.length && co.every((e) => coDb.some((d) => d.src === e.src && d.dst === e.dst && Number(d.weight) === e.weight)), `co-occurrence edges equal a replay over the stored chunks (${coDb.length})`);

  // ---------- F. Lab examples -> runners -> API -> lab_runs ----------
  section("F. Lab example -> runner -> verdict -> API -> lab_runs");
  // Every example with LINEAGE_FULL=1 (about 15 s: the interpretability toys train small networks); by default the
  // paper-to-code examples plus one per other runner that runs fast, so preflight stays quick.
  const L = require("../modules/lab/lab"), full = process.env.LINEAGE_FULL === "1";
  const chosen = full ? L.EX.examples : L.EX.examples.filter((e) => e.source || ["compounding", "goodhart", "weak-to-strong"].includes(e.reproduce.runner));
  const labBad = [];
  for (const e of chosen) { const got = (await call("ana", `/api/lab/examples/${e.id}`)).json, r = L.runExample(e.id);
    if (got.verdict.supported !== r.verdict.supported || got.verdict.baseline !== r.verdict.baseline || got.verdict.variant !== r.verdict.variant || !same(got.baseline.metrics, r.baseline.metrics) || !same(got.variant.metrics, r.variant.metrics)) labBad.push(e.id); }
  ok(chosen.length >= 5 && !labBad.length, `${chosen.length} of ${L.EX.examples.length} examples${full ? "" : " (LINEAGE_FULL=1 for all)"} are served with the metrics and verdict a fresh run gives${labBad.length ? ": " + labBad.join(", ") : ""}`);
  const pick = L.EX.examples.find((e) => e.source) || L.EX.examples[0], ran = await call("ana", `/api/lab/examples/${pick.id}/run`, {});
  const lr = await db.get("SELECT metric, value FROM lab_runs WHERE kind = 'run' ORDER BY id DESC LIMIT 1"), fresh = L.runExample(pick.id);
  ok(ran.status === 200 && lr && lr.metric === pick.hypothesis.predict.metric && Number(lr.value) === fresh.variant.metrics[lr.metric], `a run of ${pick.id} stores the variant's ${lr?.metric} (${lr?.value}) exactly`);

  server.close();
  console.log(`\nlineage unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("lineage:", e); process.exit(1); });
