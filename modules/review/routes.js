// Review routes (docs/NAMING.md: /api/review/* for signed-in users, /api/admin/review/* for admins).
const fs = require("fs"), path = require("path");
const R = require("./review");
const SAMPLES = require("./samples.json");
const { ontology } = require("../../lib/tagger");
const feeds = require("../../lib/feeds");

const CONCEPTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "learn", "data", "concepts.json"), "utf8")).concepts; } catch { return []; } })();
const iso = () => new Date().toISOString();

module.exports = function mountReview(app, { db, auth, admin, wrap, str, bad, notFound }) {
  const input = (b = {}) => {
    const x = { kind: str(b.kind, 20), title: str(b.title, 300), text: String(b.text || "").slice(0, 20000), authors: str(b.authors, 600), url: str(b.url, 500) };
    if (!x.title && !x.text.trim()) bad("Give a title or paste some text.");
    if (/(^|\/\/|\.)(twitter\.com|x\.com)(\/|$)/i.test(x.url)) bad("Twitter/X links aren't accepted on this site.");
    return x;
  };
  const brief = (r) => ({ id: r.id, qid: r.qid, kind: r.kind, title: r.title, score: r.score, naive: r.naive, credibility: r.credibility, verdict: r.verdict, needs_person: !!r.needs_person, label: r.label, created_at: r.created_at });

  app.get("/api/review/samples", auth, wrap(async () => SAMPLES));
  // Judge without saving.
  app.post("/api/review/check", auth, wrap(async (req) => { try { return R.review(input(req.body)); } catch (e) { if (e.status) throw e; bad(e.message); } }));
  // Two adversaries try to game the judge (bounded: 6 steps, 6,000 characters).
  app.post("/api/review/stress", auth, wrap(async (req) => {
    const x = input(req.body); x.text = x.text.slice(0, 6000);
    return R.stress(x, Math.max(1, Math.min(6, Number(req.body?.steps) || 5)));
  }));
  // Fill the form from arXiv's free API (title, abstract, authors). ARXIV_API can point at a fixture in tests.
  app.post("/api/review/arxiv", auth, wrap(async (req) => {
    const id = (String(req.body?.id || "").match(/\d{4}\.\d{4,5}/) || [])[0]; if (!id) bad("Give an arXiv id like 2501.01234.");
    const base = process.env.ARXIV_API || "https://export.arxiv.org/api/query?id_list=";
    let items; try { items = feeds.parseXml((await feeds.fetchText(base.startsWith("fixture://") ? base : base + id, { timeoutMs: 10000 })).body); } catch (e) { bad(`arXiv didn't answer: ${e.message}`); }
    const it = items.find((i) => i.url.includes(id)) || (base.startsWith("fixture://") ? items[0] : null); if (!it) notFound("That arXiv paper");
    return { kind: "paper", title: it.title, text: it.summary, authors: (it.authors || []).join(", "), url: it.url };
  }));

  // Save: judge, store (an excerpt, never the full text: REQ-007), and add the doc's edges to the knowledge graph.
  app.post("/api/review/docs", auth, wrap(async (req) => {
    const x = input(req.body); let r; try { r = R.review(x); } catch (e) { bad(e.message); }
    const have = await db.get("SELECT * FROM review_docs WHERE qid = ?", r.qid);
    if (have) return { doc: brief(have), existing: true, review: JSON.parse(have.result) };
    const keep = { ...r, trace: r.trace.map(({ id, ms }) => ({ id, ms })) };
    const id = await db.tx(async (t) => {
      const id = await t.insert("INSERT INTO review_docs (qid, kind, title, authors, url, excerpt, score, naive, credibility, verdict, needs_person, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        r.qid, r.kind, r.title || x.text.slice(0, 120), r.authors, x.url, x.text.slice(0, 400), r.score, r.naive, r.credibility, r.verdict, r.needsPerson ? 1 : 0, JSON.stringify(keep), req.user.id, iso());
      for (const e of r.edges) await t.run("INSERT INTO knowledge_edges (src, rel, dst, weight, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (src, rel, dst) DO UPDATE SET weight = excluded.weight",
        e.src, e.rel, e.dst, e.weight, JSON.stringify(e.evidence), iso());
      return id;
    });
    return { doc: brief(await db.get("SELECT * FROM review_docs WHERE id = ?", id)), review: keep };
  }));
  app.get("/api/review/docs", auth, wrap(async (req) => {
    const topic = str(req.query.topic, 60), verdict = str(req.query.verdict, 40);
    let rows;
    if (topic) rows = await db.all("SELECT d.* FROM review_docs d JOIN knowledge_edges e ON e.src = d.qid AND e.rel = 'about' AND e.dst = ? ORDER BY d.id DESC LIMIT 100", `topic:${topic}`);
    else rows = await db.all("SELECT * FROM review_docs ORDER BY id DESC LIMIT 100");
    return { docs: rows.filter((r) => !verdict || r.verdict === verdict).map(brief) };
  }));
  app.get("/api/review/docs/:id", auth, wrap(async (req) => {
    const r = await db.get("SELECT * FROM review_docs WHERE id = ?", Number(req.params.id)); if (!r) notFound("That review");
    const edges = await db.all("SELECT rel, dst FROM knowledge_edges WHERE src = ? ORDER BY rel, dst", r.qid);
    return { doc: { ...brief(r), authors: r.authors, url: r.url, excerpt: r.excerpt, label_note: r.label_note }, review: JSON.parse(r.result), edges };
  }));
  // A person agrees or disagrees with the verdict. Labels are the calibration data for the judges (see /metrics).
  app.post("/api/admin/review/docs/:id/label", auth, admin, wrap(async (req) => {
    const label = str(req.body?.label, 20); if (!["agree", "disagree"].includes(label)) bad("label is agree or disagree.");
    const r = await db.get("SELECT id FROM review_docs WHERE id = ?", Number(req.params.id)); if (!r) notFound("That review");
    await db.run("UPDATE review_docs SET label = ?, label_note = ?, labelled_by = ? WHERE id = ?", label, str(req.body?.note, 300), req.user.id, r.id);
    return { id: r.id, label };
  }));

  // How the judges are doing: guard fire rates, the naive-vs-guarded gap, and agreement with people.
  app.get("/api/review/metrics", auth, wrap(async () => {
    const rows = await db.all("SELECT score, naive, credibility, verdict, needs_person, label, result FROM review_docs ORDER BY id DESC LIMIT 1000");
    const n = rows.length, fires = {}, verdicts = {};
    let gap = 0, flagged = 0;
    for (const r of rows) {
      const res = JSON.parse(r.result || "{}"); gap += r.naive - r.score; flagged += r.needs_person ? 1 : 0;
      verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;
      for (const g of res.guards || []) if (g.fired) fires[g.id] = (fires[g.id] || 0) + 1;
    }
    const labelled = rows.filter((r) => r.label), agree = labelled.filter((r) => r.label === "agree").length;
    return { reviews: n, verdicts, sentToPeople: flagged, meanGapNaiveMinusGuarded: n ? +(gap / n).toFixed(1) : 0,
      guardFires: Object.fromEntries(Object.entries(fires).map(([k, v]) => [k, { count: v, rate: +(v / n).toFixed(2) }])),
      people: { labelled: labelled.length, agree, agreement: labelled.length ? +(agree / labelled.length).toFixed(2) : null,
        note: "Agreement between a person and the judge's verdict. Below about 0.8 on 20+ labels, the rules need tuning (tune-significance)." } };
  }));

  // The superintelligence map: the ontology's top-level topics, their finer topics, the Learn concepts under each, watched
  // people and organisations, with how many stories and reviewed docs touch each. Counts only: no claims about anyone.
  app.get("/api/review/map", auth, wrap(async () => {
    const stories = await db.all("SELECT topics FROM stories WHERE COALESCE(in_scope, 1) = 1 AND COALESCE(hidden, 0) = 0 ORDER BY id DESC LIMIT 2000");
    const sCount = {}; for (const s of stories) for (const t of JSON.parse(s.topics || "[]")) sCount[t.id] = (sCount[t.id] || 0) + 1;
    const edges = await db.all("SELECT src, rel, dst FROM knowledge_edges WHERE src LIKE 'doc:%' LIMIT 20000");
    const dCount = {}; for (const e of edges) dCount[e.dst] = (dCount[e.dst] || 0) + 1;
    const ents = await db.all("SELECT kind, entity, COUNT(*) AS n FROM story_entities GROUP BY kind, entity");
    const eCount = Object.fromEntries(ents.map((e) => [`${e.kind}:${e.entity}`, Number(e.n)]));
    const topics = ontology.topics, roots = topics.filter((t) => !t.parent);
    const under = (id) => topics.filter((t) => t.parent === id);
    const descendants = (id) => under(id).flatMap((c) => [c, ...descendants(c.id)]);
    const node = (t) => ({ id: t.id, qid: `topic:${t.id}`, label: t.label, stories: sCount[t.id] || 0, docs: dCount[`topic:${t.id}`] || 0 });
    const conceptTopic = (c) => { let x = c.topic, guard = 0; while (x && !roots.some((r) => r.id === x) && guard++ < 10) x = topics.find((t) => t.id === x)?.parent; return x; };
    const recent = await db.all("SELECT d.id, d.title, d.verdict, d.score, d.credibility, e.dst FROM review_docs d JOIN knowledge_edges e ON e.src = d.qid AND e.rel = 'about' ORDER BY d.id DESC LIMIT 400");
    return {
      about: "The top-level topics of the ontology, what sits under each, and how much the feed and the review desk have on each.",
      topics: roots.map((r) => ({ ...node(r), children: descendants(r.id).map(node),
        concepts: CONCEPTS.filter((c) => conceptTopic(c) === r.id).map((c) => ({ id: c.id, qid: `concept:${c.id}`, name: c.name, level: c.level, docs: dCount[`concept:${c.id}`] || 0 })),
        docs_recent: recent.filter((d) => d.dst === `topic:${r.id}`).slice(0, 4).map(({ id, title, verdict, score, credibility }) => ({ id, title, verdict, score, credibility })) })),
      people: (ontology.people || []).map((p) => ({ id: p.id, qid: `person:${p.id}`, label: p.label, stories: eCount[`person:${p.id}`] || 0, docs: dCount[`person:${p.id}`] || 0 })),
      orgs: (ontology.organizations || []).map((o) => ({ id: o.id, qid: `org:${o.id}`, label: o.label, docs: dCount[`org:${o.id}`] || 0 })),
      totals: { stories: stories.length, docs: new Set(edges.map((e) => e.src)).size, concepts: CONCEPTS.length },
    };
  }));
};
