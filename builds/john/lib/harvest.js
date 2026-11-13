// Harvesting: fetch due sources, store new items as (grouped) stories, and log every run.
//  - Each source has its own interval (default 6 h); failing sources back off exponentially (up to 32x).
//  - Conditional GET (ETag / Last-Modified) skips unchanged feeds cheaply.
//  - A time budget keeps one run inside a serverless function's limit; sources not reached stay due for the next run.
const db = require("./db");
const feeds = require("./feeds");
const publicationIdentity = require("./publication-identity");
const tagger = require("./tagger");
const { attention, publication } = require("./story-values");
const { rescore } = require("./analysis");

const now = () => db.now();

const SOCIAL = /^https?:\/\/([^/]*\.)?(twitter\.com|x\.com|nitter\.[^/]+)(\/|$)/i;
async function addItem(t, item, sourceId, submittedBy = null) {
  if (SOCIAL.test(item.url || "")) return null; // REQ-006: never show or accept Twitter/X links
  item = { ...item, score: attention(item.score), published: publication(item.published) };
  const keys = feeds.storyKeys(item);
  if (!keys.length) return null;
  // SQLite serializes transactions in lib/db. PostgreSQL needs the same
  // grouping admission boundary across workers. The transaction-level lock is
  // intentionally coarse: a whole ingest transaction is serialized, avoiding
  // per-key/title-bridge races and multi-item lock-order deadlocks.
  if (t.engine === "pg") await t.get("SELECT pg_advisory_xact_lock(606, 4)");
  let sid = null, isNew = false, attentionChanged = false;
  const strong = publicationIdentity.resolve(item.url);
  const strongKey = strong.kind === "arxiv" || strong.kind === "doi" ? strong.key : null;
  // An existing authoritative key wins, including legacy mappings. This does not
  // silently split, merge or rewrite historical records whose keys need review.
  if (strongKey) sid = (await t.get("SELECT story_id FROM story_keys WHERE key = ?", strongKey))?.story_id || null;
  // Replay an exact previously stored URL even when an older key normalizer or
  // a changed headline would otherwise miss. Never trust a legacy case-folded key.
  if (!sid && typeof item.url === "string") sid = (await t.get("SELECT story_id FROM story_links WHERE url = ? ORDER BY id LIMIT 1", item.url))?.story_id || null;
  if (!sid) for (const k of keys) {
    if (k === strongKey) continue;
    const candidate = await t.get("SELECT story_id FROM story_keys WHERE key = ?", k);
    if (!candidate) continue;
    if (strongKey) {
      const existingKeys = await t.all("SELECT key FROM story_keys WHERE story_id = ?", candidate.story_id);
      const known = new Set(existingKeys.map(r=>r.key).filter(key=>/^(arxiv|doi):/.test(key)));
      // Older stories may predate strong keys. Inspect their canonical and linked
      // URLs as well before allowing a weak title to join conflicting identities.
      const urls = await t.all("SELECT url FROM story_links WHERE story_id = ?", candidate.story_id);
      const story = await t.get("SELECT url FROM stories WHERE id = ?", candidate.story_id);
      for (const url of [story?.url,...urls.map(r=>r.url)]) {
        const identity = publicationIdentity.resolve(url);
        if ((identity.kind === "arxiv" || identity.kind === "doi") && identity.key) known.add(identity.key);
      }
      if (known.size && !known.has(strongKey)) continue;
    }
    sid = candidate.story_id; break;
  }
  if (!sid) {
    const tg = tagger.tag(item.title, item.summary);
    sid = await t.insert(`INSERT INTO stories (title, url, summary, authors, published_at, first_seen, topics, orgs, ext_score, submitted_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      item.title.slice(0, 500), feeds.canonicalUrl(item), (item.summary || "").slice(0, 1500), (item.authors || []).join(", "), item.published, now(), JSON.stringify(tg.topics), JSON.stringify(tg.orgs), item.score || 0, submittedBy);
    for (const x of tg.topics) await t.run("INSERT OR IGNORE INTO story_topics (story_id, topic) VALUES (?, ?)", sid, x.id);
    isNew = true;
  } else if (item.score) attentionChanged = !!(await t.run("UPDATE stories SET ext_score = ? WHERE id = ? AND COALESCE(ext_score, 0) < ?", item.score, sid, item.score)).changes;
  for (const k of keys) await t.run("INSERT OR IGNORE INTO story_keys (key, story_id) VALUES (?, ?)", k, sid);
  const linked = await t.run("INSERT OR IGNORE INTO story_links (story_id, source_id, url, title, published_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)", sid, sourceId, item.url, item.title, item.published, now());
  if (item.rigor) await t.run("UPDATE story_links SET rigor = ? WHERE story_id = ? AND url = ?", JSON.stringify(item.rigor), sid, item.url);
  // Score new stories, and re-score old ones when another source picks them up (coverage counts).
  if (isNew || linked.changes || attentionChanged) await rescore(t, sid);
  return { sid, isNew };
}
async function ingestItems(sourceId, items) {
  return db.tx(async (t) => { let n = 0; for (const it of items) { const r = await addItem(t, it, sourceId); if (r?.isNew) n++; } return n; });
}

const MAX_BACKOFF = 32;
function nextDue(src, ok) {
  const base = Math.max(15, Number(src.interval_minutes) || 360);
  const mult = ok ? 1 : Math.min(MAX_BACKOFF, 2 ** Math.min(5, (Number(src.failures) || 0) + 1));
  return new Date(Date.now() + base * mult * 60e3).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Fetch one source and record the run. Never throws; returns a run summary.
async function harvestSource(src, { trigger = "cron", conditional = true } = {}) {
  const started = Date.now(), startedAt = now();
  let status = "ok", items = 0, stored = 0, error = null;
  try {
    const res = await feeds.fetchSource(src, { conditional });
    if (res.notModified) status = "not_modified";
    else {
      items = res.length;
      stored = await ingestItems(src.id, res);
      await db.run("UPDATE sources SET etag = ?, last_modified = ? WHERE id = ?", res.etag || null, res.lastModified || null, src.id);
    }
    await db.run(`UPDATE sources SET last_fetched = ?, last_ok = ?, last_error = NULL, last_count = CASE WHEN ? = 'not_modified' THEN last_count ELSE ? END,
      failures = 0, verified = 1, next_due_at = ? WHERE id = ?`, startedAt, now(), status, items, nextDue(src, true), src.id);
  } catch (e) {
    status = "error"; error = String(e.cause?.code || e.message).slice(0, 300);
    await db.run("UPDATE sources SET last_fetched = ?, last_error = ?, failures = COALESCE(failures, 0) + 1, next_due_at = ? WHERE id = ?", startedAt, error, nextDue(src, false), src.id);
  }
  const duration = Date.now() - started;
  await db.run("INSERT INTO fetch_runs (source_id, trigger, started_at, finished_at, status, items, stored, error, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    src.id, trigger, startedAt, now(), status, items, stored, error, duration);
  return { source: src.name, sourceId: src.id, status, items, stored, error, ms: duration };
}

// Keep the database small (free tier): bounded logs, no expired sessions.
const PRUNES = [];
const addPrune = (fn) => PRUNES.push(fn); // modules keep their own tables small ("db.schema" addPrune)
async function prune() {
  for (const fn of PRUNES) { try { await fn(db); } catch (e) { console.error("module prune failed:", e.message); } }
  await db.run("DELETE FROM fetch_runs WHERE id NOT IN (SELECT id FROM fetch_runs ORDER BY id DESC LIMIT 2000)");
  await db.run("DELETE FROM admin_audit WHERE id NOT IN (SELECT id FROM admin_audit ORDER BY id DESC LIMIT 5000)");
  await db.run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
}

let running = null;
// Harvest every due active source (or all active ones with force, or one by id), a few at a time, within a time budget.
async function harvest({ trigger = "cron", force = false, sourceId = null, budgetMs = Number(process.env.HARVEST_BUDGET_MS || 45000), concurrency = 5 } = {}) {
  if (running) return { skipped: true, reason: "A harvest is already running." };
  running = (async () => {
    const t0 = Date.now();
    const list = sourceId
      ? await db.all("SELECT * FROM sources WHERE id = ?", sourceId)
      : await db.all(`SELECT * FROM sources WHERE status = 'active' ${force ? "" : "AND (next_due_at IS NULL OR next_due_at <= ?)"} ORDER BY next_due_at IS NULL DESC, next_due_at`, ...(force ? [] : [now()]));
    const queue = [...list], report = []; let skipped = 0;
    const worker = async () => {
      while (queue.length) {
        if (Date.now() - t0 > budgetMs) { skipped = queue.length; queue.length = 0; break; }
        report.push(await harvestSource(queue.shift(), { trigger, conditional: !force }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    const totals = report.reduce((a, r) => ({ ok: a.ok + (r.status !== "error"), errors: a.errors + (r.status === "error"), stored: a.stored + r.stored }), { ok: 0, errors: 0, stored: 0 });
    // Keep the run log bounded.
    await prune();
    return { trigger, sources: list.length, ...totals, notReached: skipped, ms: Date.now() - t0, report };
  })();
  try { return await running; } finally { running = null; }
}
const isRunning = () => !!running;

// Re-apply the ontology to every story (after editing lib/ontology.json).
async function retagAll() {
  const rows = await db.all("SELECT id, title, summary FROM stories");
  await db.tx(async (t) => {
    for (const r of rows) {
      const tg = tagger.tag(r.title, r.summary);
      await t.run("UPDATE stories SET topics = ?, orgs = ? WHERE id = ?", JSON.stringify(tg.topics), JSON.stringify(tg.orgs), r.id);
      await t.run("DELETE FROM story_topics WHERE story_id = ?", r.id);
      for (const x of tg.topics) await t.run("INSERT OR IGNORE INTO story_topics (story_id, topic) VALUES (?, ?)", r.id, x.id);
      await rescore(t, r.id);
    }
  });
  return { stories: rows.length };
}

// Score stories stored before analysis existed (runs at boot; a few hundred at a time keeps cold starts short).
async function backfill(limit = 300) {
  const rows = await db.all("SELECT id FROM stories WHERE analysis IS NULL OR analysis = '{}' OR in_scope IS NULL ORDER BY id DESC LIMIT ?", limit);
  for (const r of rows) await rescore(db, r.id);
  return rows.length;
}
module.exports = { addPrune, backfill, prune, addItem, ingestItems, harvest, harvestSource, isRunning, retagAll, nextDue };
