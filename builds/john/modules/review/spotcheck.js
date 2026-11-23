// Spot checks: the final safety loop. Everyday judging stays on the rules judge and small free-tier models; once a
// day a larger model re-reads a few saved reviews and says whether the text supports the verdict. It never scores.
//   Cost guard: at most SPOTCHECK_DAILY_MAX checks a day (default 5, hard cap 20), SPOTCHECK_SAMPLE per run (default 3),
//   each on the stored 400-character excerpt only. With no model configured nothing is called and the run says so.
//   Honesty guard: a "disagree" only counts when it quotes the excerpt word for word; otherwise it is recorded as
//   unsupported and changes nothing. A supported disagreement sends the review to a person (needs_person = 1).
//   Sampling: reviews nobody is already looking at come first, spread across verdicts, newest first within each.
const { mask } = require("./panel");

const HARD_CAP = 20;
const dailyMax = (env = process.env) => Math.max(0, Math.min(HARD_CAP, Number(env.SPOTCHECK_DAILY_MAX ?? 5) || 0));
const sampleSize = (env = process.env) => Math.max(1, Math.min(HARD_CAP, Number(env.SPOTCHECK_SAMPLE ?? 3) || 3));

function pick(rows, n) {
  const byVerdict = new Map();
  for (const r of [...rows].sort((a, b) => (a.needs_person ? 1 : 0) - (b.needs_person ? 1 : 0) || b.id - a.id)) {
    if (!byVerdict.has(r.verdict)) byVerdict.set(r.verdict, []);
    byVerdict.get(r.verdict).push(r);
  }
  const queues = [...byVerdict.values()], out = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift());
  return out;
}

function messages(doc) {
  const guards = (() => { try { return (JSON.parse(doc.result || "{}").guards || []).filter((g) => g.fired).map((g) => g.id); } catch { return []; } })();
  return [
    { role: "system", content: "You are the final safety check on a rule-based reviewer of texts about AI progress. Read the excerpt and the reviewer's verdict. Say whether the excerpt supports the verdict and credibility. If you disagree, quote the exact sentences from the excerpt that show the problem. Who wrote it and where it appeared are hidden on purpose. Reply with JSON only: {\"agree\": true|false, \"problem\": \"one sentence\", \"quotes\": [\"...\"]}." },
    { role: "user", content: JSON.stringify({ excerpt: mask(doc.excerpt || doc.title || ""), verdict: doc.verdict, credibility: doc.credibility, guardsFired: guards }) },
  ];
}

const parseReply = (s) => { if (s && typeof s === "object") return s; const m = String(s || "").match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
function judgeReply(reply, doc) {
  if (!reply || typeof reply !== "object") return { status: "unreadable", agree: null, problem: "The model's reply was not readable JSON.", quotes: [], quotesDropped: 0 };
  const text = norm(mask(doc.excerpt || doc.title || ""));
  const quotes = (Array.isArray(reply?.quotes) ? reply.quotes : []).map(String).filter((q) => norm(q).length >= 12);
  const kept = quotes.filter((q) => text.includes(norm(q))).slice(0, 3);
  const agree = reply?.agree !== false;
  const status = agree ? "agreed" : kept.length ? "flagged" : "unsupported";
  return { status, agree, problem: String(reply?.problem || "").slice(0, 300), quotes: kept, quotesDropped: quotes.length - kept.length };
}

async function run(db, { model, now = new Date(), env = process.env } = {}) {
  const max = dailyMax(env), day = now.toISOString().slice(0, 10);
  if (!model) return { day, skipped: "No larger model is configured (SPOTCHECK_MODEL), so nothing was called.", checked: 0, budget: { max, used: 0 } };
  const used = Number((await db.get("SELECT COUNT(*) AS n FROM review_spotchecks WHERE day = ?", day))?.n || 0);
  const left = Math.max(0, max - used);
  if (!left) return { day, skipped: "Today's spot-check budget is used up.", checked: 0, budget: { max, used } };
  const rows = await db.all("SELECT id, qid, title, excerpt, verdict, credibility, needs_person, result FROM review_docs WHERE qid NOT IN (SELECT doc_qid FROM review_spotchecks) ORDER BY id DESC LIMIT 200");
  const picked = pick(rows, Math.min(left, sampleSize(env))), results = [];
  for (const doc of picked) {
    let r;
    try { r = judgeReply(parseReply(await model.chat(messages(doc), { temperature: 0, json: true, max_tokens: 400 })), doc); }
    catch (e) { r = { status: "error", agree: null, problem: String(e.message).slice(0, 200), quotes: [], quotesDropped: 0 }; }
    await db.run("INSERT INTO review_spotchecks (doc_qid, day, model, status, problem, quotes, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      doc.qid, day, `${model.id}:${model.model}`, r.status, r.problem, JSON.stringify(r.quotes), now.toISOString());
    if (r.status === "flagged") await db.run("UPDATE review_docs SET needs_person = 1 WHERE qid = ?", doc.qid);
    results.push({ doc: doc.id, title: doc.title, verdict: doc.verdict, ...r });
  }
  return { day, checked: results.length, flagged: results.filter((r) => r.status === "flagged").length, results, budget: { max, used: used + results.length } };
}

function modelFromEnv(env = process.env) {
  const spec = (env.SPOTCHECK_MODEL || "").trim(); if (!spec) return null;
  const P = require("../../lib/providers"), i = spec.indexOf(":");
  return P.create(i < 0 ? spec : spec.slice(0, i), i < 0 ? {} : { model: spec.slice(i + 1) });
}

module.exports = { run, pick, messages, judgeReply, modelFromEnv, dailyMax, sampleSize, HARD_CAP };
