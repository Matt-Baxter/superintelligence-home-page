// Review routes (docs/NAMING.md: /api/review/* for signed-in users, /api/admin/review/* for admins).
const R = require("./review");
const { saveReview } = require("./store");
const SAMPLES = require("./samples.json");
const { ontology } = require("../../lib/tagger");
const feeds = require("../../lib/feeds");

module.exports = function mountReview(app, { db, auth, admin, wrap, str, bad, notFound, labExamples = () => [], concepts = () => [] }) {
  // Learn's concept graph, when that module is on (module.js passes it through the learn.concepts point).
  const CONCEPTS = concepts();
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
    const x = input(req.body); let out; try { out = await saveReview(db, x, req.user.id); } catch (e) { if (e.status) throw e; bad(e.message); }
    return { doc: brief(out.row), review: out.review, ...(out.existing ? { existing: true } : {}) };
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
  // ---------- blind labels (REQ-027, REQ-029) ----------
  // A person says whether they'd rely on a piece without seeing the judge's verdict, its credibility or its source
  // (authors, links and organisation names are masked the way the model panel masks them). The first answer stands;
  // only then is the verdict shown. Agreement between people, and between the judge and people, is on /stats.
  const { mask } = require("./panel"), A = require("./agreement");
  app.get("/api/admin/review/blind/next", auth, admin, wrap(async (req) => {
    const skip = String(req.query.skip || "").split(",").map(Number).filter(Number.isInteger).slice(0, 50);
    const not = `id NOT IN (SELECT doc_id FROM review_blind WHERE user_id = ?)${skip.length ? ` AND id NOT IN (${skip.map(() => "?").join(",")})` : ""}`;
    // Pieces someone else has labelled come first, so labels overlap and agreement can be measured.
    const r = await db.get(`SELECT id, kind, title, excerpt FROM review_docs WHERE ${not} AND id IN (SELECT doc_id FROM review_blind) ORDER BY id DESC LIMIT 1`, req.user.id, ...skip)
      || await db.get(`SELECT id, kind, title, excerpt FROM review_docs WHERE ${not} ORDER BY id DESC LIMIT 1`, req.user.id, ...skip);
    const left = await db.get("SELECT COUNT(*) AS n FROM review_docs WHERE id NOT IN (SELECT doc_id FROM review_blind WHERE user_id = ?)", req.user.id);
    const mine = await db.get("SELECT COUNT(*) AS n FROM review_blind WHERE user_id = ?", req.user.id);
    return { doc: r ? { id: r.id, kind: r.kind, title: mask(r.title), excerpt: mask(r.excerpt) } : null, left: Number(left.n), mine: Number(mine.n) };
  }));
  // The unmasked source, for a person who needs it to decide; the label then records that the source was seen.
  app.get("/api/admin/review/blind/:id/source", auth, admin, wrap(async (req) => {
    const r = await db.get("SELECT title, authors, url, excerpt FROM review_docs WHERE id = ?", Number(req.params.id)); if (!r) notFound("That piece");
    return { title: r.title, authors: r.authors, url: r.url, excerpt: r.excerpt };
  }));
  app.post("/api/admin/review/blind/:id", auth, admin, wrap(async (req) => {
    const credible = str(req.body?.credible, 10); if (!["yes", "no", "unsure"].includes(credible)) bad("credible is yes, no or unsure.");
    const id = Number(req.params.id), r = await db.get("SELECT id, verdict, credibility FROM review_docs WHERE id = ?", id); if (!r) notFound("That piece");
    if (await db.get("SELECT id FROM review_blind WHERE doc_id = ? AND user_id = ?", id, req.user.id)) bad("You've already labelled this piece. First answers stand, so the labels stay blind.");
    await db.run("INSERT INTO review_blind (doc_id, user_id, credible, unmasked, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id, req.user.id, credible, req.body?.unmasked ? 1 : 0, str(req.body?.note || "", 300), db.now());
    const judge = A.judgeLabel(r.verdict);
    return { verdict: r.verdict, credibility: r.credibility, judge, agree: credible === "unsure" ? null : credible === judge };
  }));
  app.get("/api/admin/review/blind/stats", auth, admin, wrap(async () => {
    const rows = await db.all("SELECT b.doc_id AS doc, b.user_id AS user, u.display_name AS name, b.credible, d.verdict FROM review_blind b JOIN review_docs d ON d.id = b.doc_id JOIN users u ON u.id = b.user_id ORDER BY b.id");
    const unmasked = await db.get("SELECT COUNT(*) AS n FROM review_blind WHERE unmasked = 1");
    return { ...A.stats(rows), unmasked: Number(unmasked.n) };
  }));

  // A person agrees or disagrees with the verdict. Labels are the calibration data for the judges (see /metrics).
  app.post("/api/admin/review/docs/:id/label", auth, admin, wrap(async (req) => {
    const label = str(req.body?.label, 20); if (!["agree", "disagree"].includes(label)) bad("label is agree or disagree.");
    const r = await db.get("SELECT id FROM review_docs WHERE id = ?", Number(req.params.id)); if (!r) notFound("That review");
    await db.run("UPDATE review_docs SET label = ?, label_note = ?, labelled_by = ? WHERE id = ?", label, str(req.body?.note, 300), req.user.id, r.id);
    return { id: r.id, label };
  }));

  // Sources and forecasts: each outlet's grades and track record, and the dated forecasts waiting to be resolved.
  const SRC = require("./sources");
  app.get("/api/review/outlets", auth, wrap(async () => {
    const docs = await db.all("SELECT credibility, result FROM review_docs ORDER BY id DESC LIMIT 1000"), events = await db.all("SELECT outlet, status, probability FROM review_events");
    return { outlets: SRC.trackRecords(docs, events), grades: SRC.OUTLETS, minResolved: SRC.MIN_RESOLVED };
  }));
  app.get("/api/review/events", auth, wrap(async (req) => {
    const status = ["pending", "happened", "did-not", "unclear", "annulled"].includes(req.query.status) ? req.query.status : null;
    const rows = await db.all(`SELECT e.id, e.qid, e.doc_qid, e.outlet, e.outlet_label, e.sentence, e.due, e.status, e.note, e.resolved_at, d.id AS doc_id, d.title, d.url
      FROM review_events e LEFT JOIN review_docs d ON d.qid = e.doc_qid ${status ? "WHERE e.status = ?" : ""} ORDER BY e.due ASC LIMIT 300`, ...(status ? [status] : []));
    return { events: rows };
  }));
  app.post("/api/admin/review/events/:id", auth, admin, wrap(async (req) => {
    const status = String(req.body?.status || ""); if (!["pending", "happened", "did-not", "unclear", "annulled"].includes(status)) bad("Status must be pending, happened, did-not, unclear or annulled.");
    const e = await db.get("SELECT id FROM review_events WHERE id = ?", Number(req.params.id)); if (!e) notFound("That forecast");
    await db.run("UPDATE review_events SET status = ?, note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?", status, str(req.body?.note || "", 400), req.user.id, status === "pending" ? null : new Date().toISOString(), e.id);
    return { ok: true };
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

  // Topic dossiers: a traced analysis of everything on one topic, with a blog draft, short posts and a video storyboard.
  const D = require("./dossier");
  const dossierFor = async (topic) => { if (!ontology.topics.some((t) => t.id === topic)) notFound("That topic"); return D.analyse(await D.gather(db, topic), { examples: labExamples(), concepts: CONCEPTS }); };
  const site = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  app.get("/api/review/dossier/:topic", auth, wrap(async (req) => {
    const d = await dossierFor(str(req.params.topic, 60)), link = `${site(req)}/m/dossier#${d.topic}`;
    return { dossier: d, blog: D.blog(d, site(req)), posts: D.posts(d, link), storyboard: D.storyboard(d) };
  }));
  // The storyboard alone is public, like concept explainers, so the explainer player and its recorder can load it.
  app.get("/api/review/dossier/:topic/storyboard", wrap(async (req) => ({ storyboard: D.storyboard(await dossierFor(str(req.params.topic, 60))) })));

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
