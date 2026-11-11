// /research: plain-language write-ups and an RSS feed of them, built from the review desk and topic dossiers.
// Hidden by default: only a signed-in admin sees it, and nothing links to it from the nav. Set RESEARCH_PUBLIC=1 on
// the deployment that serves it (a research subdomain, say) to open it to everyone, still tagged "Research preview"
// and noindex. That public RSS URL is what another site's feed adds as a source; a person sets that up.
const V = require("./render");
const { ontology } = require("../../lib/tagger");
const D = require("../review/dossier");

const M = require("../../lib/metrics");
module.exports = function mountResearch(app, { db, wrap, auth, admin }) {
  const CONCEPTS = (() => { try { return require("../learn/data/concepts.json").concepts; } catch { return []; } })();
  const labExamples = () => { try { const L = require("../lab/lab"), pre = require("../lab/results.json").results; return L.EX.examples.filter((e) => pre[e.id]).map((e) => ({ ...e, verdict: pre[e.id].verdict })); } catch { return []; } };
  const base = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const gate = (req, res, next) => {
    res.set("X-Robots-Tag", "noindex, nofollow");
    if (process.env.RESEARCH_PUBLIC === "1" || req.user?.admin) return next();
    return res.status(404).type("text/plain").send("Not found");
  };
  const page = (fn) => wrap(async (req, res) => { const html = await fn(req); if (html == null) res.status(404).type("text/plain").send("Not found"); else res.type("text/html").send(html); });
  const papers = async () => (await db.all("SELECT id, qid, kind, title, authors, url, excerpt, score, naive, credibility, verdict, needs_person, label, result, created_at FROM review_docs ORDER BY id DESC LIMIT 200"))
    .filter(V.publishable).slice(0, 30);
  // Topic dossiers for the top-level topics that have something rated above "none yet".
  const topics = async () => {
    const ex = labExamples(), out = [];
    for (const t of ontology.topics.filter((x) => !x.parent)) {
      const d = D.analyse(await D.gather(db, t.id), { examples: ex, concepts: CONCEPTS });
      if (d.strength !== "none yet") out.push({ topic: d.topic, label: d.label, strength: d.strength, why: d.why, at: d.at });
    }
    return out;
  };

  // Research control room (admins): everything waiting on a person, the judging quality on real reviews, the panel's
  // set-up and links to every research page, in one call, so the layer is run from the web app rather than scripts.
  app.get("/api/admin/research/status", auth, admin, wrap(async () => {
    const { waiting, proposals } = require("../../scripts/checkin"), Q = require("../../scripts/quality"), CFG = require("../project/sync.json");
    const today = new Date().toISOString().slice(0, 10), W = await waiting(db, today);
    const rows = await db.all("SELECT kind, title, credibility, verdict, result FROM review_docs ORDER BY id DESC LIMIT 500");
    const due = await db.all(`SELECT e.id, e.sentence, e.due, e.status, e.probability, e.outlet_label, d.id AS doc_id, d.title FROM review_events e LEFT JOIN review_docs d ON d.qid = e.doc_qid
      WHERE e.status = 'pending' ORDER BY e.due ASC LIMIT 50`).catch(() => []);
    const flagged = (await db.all("SELECT id, title, verdict, credibility, result FROM review_docs WHERE needs_person = 1 AND label IS NULL ORDER BY id DESC LIMIT 50"))
      .map((d) => { const r = JSON.parse(d.result || "{}"); return { id: d.id, title: d.title, verdict: d.verdict, credibility: d.credibility, reasons: [...(r.reasons || []), ...(r.panel && r.panel.needsPerson && r.panel.status === "disagreed" ? ["the models disagreed"] : [])], advice: r.panel && r.panel.advice ? r.panel.advice.advice : null, judges: r.panel ? r.panel.judges.map((j) => `${j.id === "rules" ? "rules" : j.model} ${j.credibility}`) : [] }; });
    const models = (process.env.PANEL_MODELS || "").split(",").map((x) => x.trim()).filter(Boolean);
    return { today, waiting: W, proposals: proposals().reqs, specStatus: proposals().status, people: CFG.people, forecasts: due.map((e) => ({ ...e, overdue: e.due <= today })), flagged,
      quality: rows.length ? Q.analyse(rows).checks.map(({ id, label, value, ok, why, fix }) => ({ id, label, value, ok, why, fix })) : [],
      // Person-labelled verdicts through the accuracy paradox guard (lib/metrics.js).
      honesty: await (async () => { const lab = await db.all("SELECT verdict, label FROM review_docs WHERE label IS NOT NULL ORDER BY id DESC LIMIT 1000").catch(() => []); return lab.length ? M.brief(M.fromAgreement(lab, { predict: (r) => (["doubtful", "withdrawn"].includes(r.verdict) ? "not-credible" : "credible"), classes: ["credible", "not-credible"] })) : null; })(),
      panel: { models, ready: models.length >= 2, advisor: (process.env.ADVISOR_MODEL || "").trim() || null }, public: process.env.RESEARCH_PUBLIC === "1" };
  }));

  app.get("/research", gate, page(async (req) => V.indexPage({ papers: await papers(), topics: await topics() }, base(req))));
  app.get("/research/outlets", gate, page(async (req) => {
    const S = require("../review/sources");
    const docs = (await db.all("SELECT kind, credibility, verdict, needs_person, label, result FROM review_docs ORDER BY id DESC LIMIT 1000")).filter(V.publishable);
    const events = await db.all("SELECT outlet, status, probability FROM review_events").catch(() => []);
    return V.outletsPage(S.trackRecords(docs, events), S.MIN_RESOLVED, base(req));
  }));
  app.get("/research/criteria", gate, page(async (req) => V.criteriaPage(base(req))));
  app.get("/research/data.json", gate, wrap(async (req) => V.dataJson({ papers: await papers(), topics: await topics() }, base(req))));
  app.get("/research/feed.xml", gate, wrap(async (req, res) => { res.type("application/rss+xml").send(V.feedXml({ papers: await papers(), topics: await topics() }, base(req))); }));
  app.get("/research/paper/:id", gate, page(async (req) => {
    const row = await db.get("SELECT * FROM review_docs WHERE id = ?", Number(req.params.id) || 0);
    return row && V.publishable(row) ? V.paperPage(row, base(req)) : null;
  }));
  app.get("/research/topic/:topic", gate, page(async (req) => {
    const id = String(req.params.topic).slice(0, 60);
    if (!ontology.topics.some((t) => t.id === id)) return null;
    const d = D.analyse(await D.gather(db, id), { examples: labExamples(), concepts: CONCEPTS });
    return V.topicPage(d, D.blog(d, base(req)), base(req));
  }));
};
