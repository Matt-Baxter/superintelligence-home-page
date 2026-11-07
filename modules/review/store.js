// Save a review: judge it, store an excerpt (never the full text: REQ-007) and add its edges to the knowledge graph.
// Shared by POST /api/review/docs and the daily paper watcher (scripts/watch.js), so both store reviews the same way.
const R = require("./review");
const iso = () => new Date().toISOString();

async function saveReview(db, x, userId = null) {
  const r = R.review(x);
  const have = await db.get("SELECT * FROM review_docs WHERE qid = ?", r.qid);
  if (have) return { existing: true, row: have, review: JSON.parse(have.result) };
  const keep = { ...r, trace: r.trace.map(({ id, ms }) => ({ id, ms })) };
  const id = await db.tx(async (t) => {
    const id = await t.insert("INSERT INTO review_docs (qid, kind, title, authors, url, excerpt, score, naive, credibility, verdict, needs_person, result, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      r.qid, r.kind, r.title || String(x.text || "").slice(0, 120), r.authors, x.url || "", String(x.text || "").slice(0, 400), r.score, r.naive, r.credibility, r.verdict, r.needsPerson ? 1 : 0, JSON.stringify(keep), userId, iso());
    for (const e of r.edges) await t.run("INSERT INTO knowledge_edges (src, rel, dst, weight, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (src, rel, dst) DO UPDATE SET weight = excluded.weight",
      e.src, e.rel, e.dst, e.weight, JSON.stringify(e.evidence), iso());
    // Dated forecasts become events a person can later mark as happened or not, pooled by outlet.
    for (const f of r.forecasts || []) await t.run("INSERT INTO review_events (qid, doc_qid, outlet, outlet_label, sentence, due, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?) ON CONFLICT (qid) DO NOTHING",
      f.qid, r.qid, r.source.outlet.id, r.source.outlet.label, f.sentence, f.due, iso());
    return id;
  });
  return { existing: false, row: await db.get("SELECT * FROM review_docs WHERE id = ?", id), review: keep };
}

module.exports = { saveReview };
