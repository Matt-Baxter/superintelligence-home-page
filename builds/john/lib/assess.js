// Assessment cascade: is a story on-topic for the superintelligence feed, and which ontology topics does it carry?
// Cheapest first, and every step is grounded in lib/ontology.json:
//   tier 0  deterministic checks (tagger terms, scope rule, hard rejects). Free; decides most stories.
//   tier 1  a cheap "System 1" model, only when tier 0 is unsure. Its answer is checked against the ontology:
//           unknown topic ids are dropped, and disagreeing with tier 0's grounded topics escalates.
//   tier 2  a larger model, only when tier 1 is unsure or disagrees. Its answer is final (still ontology-checked).
// Models never run on the web request path: scripts/assess.js (or a cron) calls run(). Results are cached in the
// `assessments` table per story and rules version, so an unchanged story is never paid for twice. Raw model replies
// go to private Blob storage when BLOB_READ_WRITE_TOKEN is set, so a verdict can be audited later.
//
//   const A = require("./lib/assess");
//   A.ground(story)                          -> tier-0 result, sync and free
//   await A.assess(story, { tier1, tier2 })  -> final result (tiers are { chat() } from lib/providers)
//   await A.run(db, { limit: 50 })           -> assesses stories without a current assessment
const crypto = require("node:crypto");
const tagger = require("./tagger");
const analysis = require("./analysis");
const { parseJson } = require("./providers");

const RULES_VERSION = "assess-1";
const ACCEPT = 0.75; // a model answer below this confidence escalates
const TOPIC_IDS = new Set(tagger.topicList().map((t) => t.id));
const SOCIAL = /^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i;
const DAY = 86400000;

// Default models (Vercel AI Gateway ids; override with ASSESS_TIER1_MODEL / ASSESS_TIER2_MODEL).
const DEFAULT_MODELS = { tier1: "nvidia/nemotron-3.5-lightning-free", tier2: "google/gemini-2.5-flash-lite" };

const inputHash = (s) => crypto.createHash("sha256").update(`${RULES_VERSION}\n${s.title || ""}\n${s.summary || ""}\n${s.url || ""}`).digest("hex").slice(0, 32);
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

function ground(story) {
  const title = String(story.title || "").trim(), summary = String(story.summary || "");
  const { topics } = tagger.tag(title, summary);
  const direct = topics.filter((t) => t.matched.length);
  const sc = analysis.scope(`${title}\n${summary}\n${story.authors || ""}`, topics);
  const published = Date.parse(story.published_at || "");
  const checks = [
    { id: "has_title", pass: title.length >= 8, detail: `${title.length} characters` },
    { id: "not_social", pass: !SOCIAL.test(story.url || ""), detail: "Twitter/X links are refused (REQ-006)" },
    { id: "date_sane", pass: !Number.isFinite(published) || published <= Date.now() + 2 * DAY, detail: story.published_at || "no date" },
    { id: "grounded_topics", pass: direct.length > 0, detail: direct.map((t) => `${t.id} (${t.matched.join(", ")})`).join("; ") || "no ontology term matched" },
    { id: "in_scope", pass: !!sc.in, detail: sc.reason || (sc.in ? "in scope" : "out of scope") },
  ];
  const base = { tier: 0, model: null, topics: direct.map((t) => t.id), checks, scope: !!sc.in };
  const hardFail = checks.find((c) => ["has_title", "not_social", "date_sane"].includes(c.id) && !c.pass);
  if (hardFail) return { ...base, verdict: "reject", confidence: 1, reason: `Failed ${hardFail.id}` };
  if (sc.in && direct.length >= 2) return { ...base, verdict: "relevant", confidence: 0.9, reason: "In scope with two or more grounded topics" };
  if (!sc.in && direct.length === 0) return { ...base, verdict: "irrelevant", confidence: 0.85, reason: "No ontology term matched and out of scope" };
  return { ...base, verdict: "unsure", confidence: 0.5, reason: "Thin grounding; needs a model" };
}

function prompt(story, tier0) {
  const ids = [...TOPIC_IDS].join(", ");
  return [
    { role: "system", content: "You classify AI news for a feed about progress toward superintelligence. Reply with one JSON object only." },
    { role: "user", content:
      `Allowed topic ids: ${ids}\n` +
      `Deterministic checks found topics: ${tier0.topics.join(", ") || "none"}\n\n` +
      `Title: ${String(story.title).slice(0, 300)}\nSummary: ${String(story.summary || "").slice(0, 1500)}\n\n` +
      `Return {"relevant": true|false, "topics": [allowed ids only], "confidence": 0..1, "reason": "one short sentence"}` },
  ];
}

// Check a model reply against the ontology. Unknown ids are dropped and cost confidence.
function checkReply(raw, tier0) {
  let d; try { d = parseJson(raw); } catch { return { ok: false, reason: "Reply was not JSON" }; }
  const asked = Array.isArray(d.topics) ? d.topics.map(String) : [];
  const topics = [...new Set(asked.filter((id) => TOPIC_IDS.has(id)))];
  const dropped = asked.length - topics.length;
  let confidence = clamp01(d.confidence) * (dropped ? 0.8 : 1);
  const disagrees = tier0.topics.length > 0 && topics.length > 0 && !topics.some((t) => tier0.topics.includes(t));
  if (typeof d.relevant !== "boolean") return { ok: false, reason: "Missing 'relevant'" };
  return { ok: true, verdict: d.relevant ? "relevant" : "irrelevant", topics, confidence, dropped, disagrees, reason: String(d.reason || "").slice(0, 240) };
}

async function askTier(name, llm, story, tier0, ctx) {
  if (!llm) return null;
  if (ctx.budget && (ctx.budget[name] ?? Infinity) <= 0) return { skipped: "budget" };
  if (ctx.budget && ctx.budget[name] != null) ctx.budget[name]--;
  let raw;
  try { raw = await llm.chat(prompt(story, tier0), { json: true, max_tokens: 300 }); }
  catch (e) { return { skipped: `error: ${String(e.message).slice(0, 120)}` }; }
  const archived = ctx.archive ? await ctx.archive(`assessments/${RULES_VERSION}/${story.id ?? "x"}-${name}-${Date.now()}.json`, JSON.stringify({ model: llm.model, raw })).catch(() => null) : null;
  return { ...checkReply(raw, tier0), model: llm.model, archived };
}

async function assess(story, { tier1, tier2, budget, archive } = {}) {
  const t0 = ground(story);
  const out = { ...t0, hash: inputHash(story), rules_version: RULES_VERSION, blob: null, trail: [{ tier: 0, verdict: t0.verdict, confidence: t0.confidence }] };
  if (t0.verdict !== "unsure") return out;
  const ctx = { budget, archive };
  for (const [tier, name, llm] of [[1, "tier1", tier1], [2, "tier2", tier2]]) {
    const r = await askTier(name, llm, story, t0, ctx);
    if (!r) continue;
    out.trail.push({ tier, model: r.model || null, ...(r.skipped ? { skipped: r.skipped } : { verdict: r.verdict, confidence: r.confidence, dropped: r.dropped, disagrees: r.disagrees }) });
    if (r.skipped || !r.ok) continue;
    if (r.archived) out.blob = r.archived;
    const final = tier === 2 || (r.confidence >= ACCEPT && !r.disagrees);
    if (final) return { ...out, tier, model: r.model, verdict: r.verdict, confidence: r.confidence, topics: r.topics, reason: r.reason || out.reason };
  }
  return out; // still "unsure": no model configured, budget spent, or every reply failed its checks
}

// Private Blob archive for raw model replies; null when Blob isn't configured.
function blobArchive() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { put } = require("@vercel/blob");
  return async (key, body) => (await put(key, body, { access: "private", contentType: "application/json", addRandomSuffix: true })).pathname;
}

// Gateway-backed tiers from lib/providers; a tier is null when its provider has no credentials.
function defaultTiers() {
  const P = require("./providers");
  const make = (model) => { try { return P.create(process.env.ASSESS_PROVIDER || "vercel-ai-gateway", { model }); } catch { return null; } };
  return { tier1: make(process.env.ASSESS_TIER1_MODEL || DEFAULT_MODELS.tier1), tier2: make(process.env.ASSESS_TIER2_MODEL || DEFAULT_MODELS.tier2) };
}

async function save(db, storyId, r) {
  await db.tx(async (t) => {
    await t.run("DELETE FROM assessments WHERE story_id = ?", storyId);
    await t.run(`INSERT INTO assessments (story_id, rules_version, input_hash, tier, verdict, confidence, topics, checks, trail, model, reason, blob_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, storyId, r.rules_version, r.hash, r.tier, r.verdict, r.confidence,
      JSON.stringify(r.topics), JSON.stringify(r.checks), JSON.stringify(r.trail), r.model, r.reason || "", r.blob);
  });
}

// Assess up to `limit` stories that have no assessment for this rules version or whose text changed.
async function run(db, { limit = 50, tiers = defaultTiers(), budget = { tier1: limit, tier2: Math.ceil(limit / 5) }, archive = blobArchive() } = {}) {
  await db.ready();
  const rows = await db.all(`SELECT s.id, s.title, s.summary, s.url, s.authors, s.published_at, a.input_hash
    FROM stories s LEFT JOIN assessments a ON a.story_id = s.id AND a.rules_version = ?
    WHERE s.hidden = 0 ORDER BY s.id DESC LIMIT ?`, RULES_VERSION, limit * 4);
  const todo = rows.filter((s) => s.input_hash !== inputHash(s)).slice(0, limit);
  const tally = { assessed: 0, byTier: { 0: 0, 1: 0, 2: 0 }, byVerdict: {}, budgetLeft: budget };
  for (const s of todo) {
    const r = await assess(s, { ...tiers, budget, archive });
    await save(db, s.id, r);
    tally.assessed++; tally.byTier[r.tier]++; tally.byVerdict[r.verdict] = (tally.byVerdict[r.verdict] || 0) + 1;
  }
  return tally;
}

async function summary(db) {
  await db.ready();
  const rows = await db.all("SELECT tier, verdict, COUNT(*) AS n FROM assessments WHERE rules_version = ? GROUP BY tier, verdict", RULES_VERSION);
  const total = (await db.get("SELECT COUNT(*) AS n FROM stories WHERE hidden = 0")).n;
  return { rules_version: RULES_VERSION, stories: total, assessed: rows.reduce((a, r) => a + r.n, 0), rows, models: DEFAULT_MODELS };
}

module.exports = { ground, assess, run, summary, checkReply, inputHash, RULES_VERSION, DEFAULT_MODELS, ACCEPT };
