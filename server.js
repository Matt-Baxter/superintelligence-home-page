// Superintelligence Homepage: multi-source AI-progress feed with accounts, curation, a weekly brief and an agent log.
// Runs as a normal Node server (`npm start`) or as a Vercel function (api/index.js imports `app`).
// Env: PORT, DATABASE_URL/POSTGRES_URL (Postgres) or DATA_DIR (SQLite), FETCH_MINUTES, CRON_SECRET, APP_TZ, NODE_ENV
const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const db = require("./lib/db");
const feeds = require("./lib/feeds");
const tagger = require("./lib/tagger");
const audit = require("./lib/audit");
const analysis = require("./lib/analysis");

/* ---------------------------------------------------------------- modules */
// Features beyond the core are modules (modules/<id>/module.js, enabled in modules/modules.json) that plug into
// extension points. Their headless contributions are applied here, before anything reads them.
const { createKernel } = require("./kernel/kernel");
const kernel = createKernel();
for (const f of kernel.store.formats) feeds.FORMATS[f.id] = f.format;
for (const sig of kernel.store.signals) analysis.registerSignal(sig);
db.extend({ sql: kernel.store.schema.join("\n"), columns: kernel.store.columns });

const FETCH_MINUTES = Number(process.env.FETCH_MINUTES ?? 30);
const APP_TZ = process.env.APP_TZ || "America/Chicago";

/* ------------------------------------------------------------------ helpers */
const str = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => { throw new HttpError(400, m); };
const forbid = (m = "You don't have access to this.") => { throw new HttpError(403, m); };
const notFound = (w = "That item") => { throw new HttpError(404, `${w} wasn't found.`); };
const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).then((o) => o !== undefined && !res.headersSent && res.json(o)).catch(next);
const now = () => db.now();
const bool = (v) => v === true || v === 1 || v === "1" || v === "t";

function hashPassword(pw) { const salt = crypto.randomBytes(16).toString("hex"); return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`; }
function checkPassword(pw, stored) { const [s, h] = stored.split(":"); return crypto.timingSafeEqual(crypto.scryptSync(pw, s, 64), Buffer.from(h, "hex")); }
const SESSION_DAYS = 30;
async function startSession(res, uid) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.run("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, uid, Date.now() + SESSION_DAYS * 864e5);
  res.cookie("sid", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL, maxAge: SESSION_DAYS * 864e5 });
}
const cookie = (req, n) => { const m = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(n + "=")); return m ? decodeURIComponent(m.slice(n.length + 1)) : null; };

/* ---------------------------------------------------------------- ingestion */
const harvester = require("./lib/harvest");
const { addItem, ingestItems } = harvester;
for (const fn of kernel.store.prune) harvester.addPrune(fn);
const fetchAll = (only = null) => harvester.harvest({ trigger: "admin", force: true, sourceId: only });
async function seedSources() {
  if ((await db.get("SELECT COUNT(*) AS n FROM sources")).n) return;
  const { sources } = require("./lib/sources.json");
  await db.tx(async (t) => { for (const s of sources) await t.run("INSERT OR IGNORE INTO sources (name, kind, format, url, home, created_at) VALUES (?, ?, ?, ?, ?, ?)", s.name, s.kind, s.format, s.url, s.home || "", now()); });
}
let bootP;
const boot = () => (bootP ||= db.ready().then(seedSources).then(() => harvester.backfill()).then(() => kernel.start(moduleDeps())).catch((e) => { bootP = null; throw e; }));

/* ------------------------------------------------------------------- app */
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => (req.path.startsWith("/api/") ? boot().then(() => next(), next) : next()));
app.use(async (req, res, next) => {
  const t = req.path.startsWith("/api/") && cookie(req, "sid");
  if (!t) return next();
  try {
    const r = await db.get("SELECT u.id, u.username, u.display_name, u.is_admin, u.disabled, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?", t);
    if (r && Number(r.expires_at) > Date.now() && !bool(r.disabled)) req.user = { id: r.id, username: r.username, name: r.display_name, admin: bool(r.is_admin) };
    else if (r) await db.run("DELETE FROM sessions WHERE token = ?", t);
    next();
  } catch (e) { next(e); }
});
const auth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please sign in first." }));
const admin = (req, res, next) => (req.user?.admin ? next() : res.status(403).json({ error: "Only an admin can do this." }));
const hits = new Map();
const limit = (n, ms) => (req, res, next) => {
  const k = req.path + req.ip, t = Date.now(), l = (hits.get(k) || []).filter((x) => t - x < ms);
  if (l.length >= n) return res.status(429).json({ error: "Too many requests. Wait a few minutes and try again." });
  l.push(t); hits.set(k, l); next();
};

/* accounts — the first account becomes the admin */
app.post("/api/signup", limit(30, 6e5), wrap(async (req, res) => {
  const u = str(req.body.username, 40), name = str(req.body.displayName, 60) || u, pw = req.body.password || "";
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(u)) bad("Usernames are 3–40 letters, numbers, dots, dashes or underscores.");
  if (typeof pw !== "string" || pw.length < 8) bad("Passwords need at least 8 characters.");
  if (await db.get("SELECT 1 AS x FROM users WHERE LOWER(username) = LOWER(?)", u)) bad("That username is taken.");
  const first = (await db.get("SELECT COUNT(*) AS n FROM users")).n === 0;
  const id = await db.insert("INSERT INTO users (username, display_name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)", u, name, hashPassword(pw), first ? 1 : 0, now());
  await startSession(res, id); return { user: { id, username: u, name, admin: first } };
}));
app.post("/api/login", limit(30, 6e5), wrap(async (req, res) => {
  const u = await db.get("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", str(req.body.username, 40));
  if (!u || !checkPassword(String(req.body.password || ""), u.pass_hash)) throw new HttpError(401, "Wrong username or password.");
  if (bool(u.disabled)) throw new HttpError(403, "This account has been disabled. Contact the site admin.");
  await startSession(res, u.id); return { user: { id: u.id, username: u.username, name: u.display_name, admin: bool(u.is_admin) } };
}));
app.post("/api/logout", wrap(async (req, res) => { const t = cookie(req, "sid"); if (t) await db.run("DELETE FROM sessions WHERE token = ?", t); res.clearCookie("sid"); return { ok: true }; }));
app.get("/api/me", wrap((req) => ({ user: req.user ? { ...req.user, nav: kernel.nav(req.user) } : null })));
app.get("/api/ontology", wrap(() => ({ topics: tagger.topicList(), orgs: tagger.orgList(), about: tagger.ontology.about,
  benchmarks: (tagger.ontology.benchmarks || []).map(({ id, label, measures }) => ({ id, label, measures })), people: (tagger.ontology.people || []).map(({ id, label }) => ({ id, label })) })));

/* ------------------------------------------------------------------ stories */
const KINDS = ["papers", "journal", "lab", "research-org", "forum", "newsletter", "people", "academic", "community", "news", "policy", "submitted"];
const FORMAT_IDS = Object.keys(feeds.FORMATS);
const parseTime = (t) => Date.parse(t && !t.includes("T") ? t.replace(" ", "T") + "Z" : t);
async function storyRows(where, args, uid, { sort = "top", limit = 40, offset = 0 } = {}) {
  const rows = await db.all(`SELECT s.*, (SELECT COUNT(*) FROM votes v WHERE v.story_id = s.id) AS votes,
      (SELECT COUNT(DISTINCT COALESCE(l.source_id, -l.id)) FROM story_links l WHERE l.story_id = s.id) AS nsources,
      EXISTS(SELECT 1 FROM votes v WHERE v.story_id = s.id AND v.user_id = ?) AS voted,
      EXISTS(SELECT 1 FROM saves v WHERE v.story_id = s.id AND v.user_id = ?) AS saved,
      (SELECT COUNT(*) FROM notes n WHERE n.story_id = s.id AND (n.private = 0 OR n.user_id = ?)) AS nnotes,
      COALESCE(s.published_at, s.first_seen) AS t
    FROM stories s WHERE COALESCE(s.hidden, 0) = 0 AND COALESCE(s.in_scope, 1) = 1 AND (${where})`, uid, uid, uid, ...args);
  const t0 = Date.now();
  rows.forEach((r) => {
    const hours = Math.max(0, (t0 - parseTime(r.t)) / 36e5);
    // Votes count most; being covered by several independent sources is a strong signal; older stories sink.
    r.rank = (1 + r.votes * 3 + (r.nsources - 1) * 2 + Math.log10(1 + (r.ext_score || 0)) + (r.significance || 0) / 25) / Math.pow(hours + 2, 1.15);
  });
  rows.sort(sort === "new" ? (a, b) => (a.t < b.t ? 1 : -1) : sort === "votes" ? (a, b) => b.votes - a.votes || (a.t < b.t ? 1 : -1)
    : sort === "signal" ? (a, b) => (b.significance || 0) - (a.significance || 0) || (a.t < b.t ? 1 : -1) : (a, b) => b.rank - a.rank);
  const page = rows.slice(offset, offset + limit);
  if (!page.length) return [];
  const links = await db.all(`SELECT l.story_id, l.url, l.title, src.name AS source, src.kind FROM story_links l LEFT JOIN sources src ON src.id = l.source_id
    WHERE l.story_id IN (${page.map(() => "?").join(",")}) ORDER BY l.id`, ...page.map((r) => r.id));
  return page.map((r) => shapeStory(r, links.filter((l) => l.story_id === r.id)));
}
function shapeStory(r, links) {
  return {
    id: r.id, title: r.title, url: r.url, summary: r.summary, authors: r.authors, published_at: r.published_at, first_seen: r.first_seen,
    topics: JSON.parse(r.topics || "[]"), orgs: JSON.parse(r.orgs || "[]"), votes: r.votes, voted: bool(r.voted), saved: bool(r.saved), notes: r.nnotes,
    sources: links.map((l) => ({ name: l.source || "Submitted by a reader", kind: l.kind || "submitted", url: l.url, title: l.title })),
    nsources: r.nsources, significance: r.significance || 0, analysis: JSON.parse(r.analysis || "{}"),
  };
}
app.get("/api/stories", auth, wrap(async (req) => {
  const w = ["1=1"], a = [];
  const topic = str(req.query.topic, 40), kind = str(req.query.kind, 30), org = str(req.query.org, 40), qtext = str(req.query.q, 100).toLowerCase();
  const days = Math.min(365, Number(req.query.days) || 0);
  if (topic) { w.push("s.id IN (SELECT story_id FROM story_topics WHERE topic = ?)"); a.push(topic); }
  if (kind) { w.push("s.id IN (SELECT l.story_id FROM story_links l LEFT JOIN sources src ON src.id = l.source_id WHERE COALESCE(src.kind, 'submitted') = ?)"); a.push(kind); }
  if (org) { w.push("s.orgs LIKE ?"); a.push(`%"id":"${org.replace(/[%_"]/g, "")}"%`); }
  if (qtext) { w.push("(LOWER(s.title) LIKE ? OR LOWER(s.summary) LIKE ?)"); a.push(`%${qtext}%`, `%${qtext}%`); }
  if (days) { w.push("COALESCE(s.published_at, s.first_seen) >= ?"); a.push(new Date(Date.now() - days * 864e5).toISOString()); }
  if (req.query.benchmark) { w.push("s.id IN (SELECT story_id FROM story_entities WHERE kind = 'benchmark' AND entity = ?)"); a.push(str(req.query.benchmark, 40)); }
  if (req.query.person) { w.push("s.id IN (SELECT story_id FROM story_entities WHERE kind = 'person' AND entity = ?)"); a.push(str(req.query.person, 60)); }
  if (Number(req.query.min)) { w.push("COALESCE(s.significance, 0) >= ?"); a.push(Math.min(100, Number(req.query.min))); }
  if (req.query.saved === "1") { w.push("s.id IN (SELECT story_id FROM saves WHERE user_id = ?)"); a.push(req.user.id); }
  const sort = ["top", "new", "votes", "signal"].includes(req.query.sort) ? req.query.sort : "new"; // REQ-002: newest first
  const offset = Math.max(0, Number(req.query.offset) || 0);
  return { stories: await storyRows(w.join(" AND "), a, req.user.id, { sort, offset, limit: 40 }), sort };
}));
app.get("/api/stories/:id", auth, wrap(async (req) => {
  const id = Number(req.params.id); const rows = await storyRows("s.id = ?", [id], req.user.id); if (!rows.length) notFound("That story");
  return {
    story: rows[0],
    notes: (await db.all(`SELECT n.id, n.text, n.private, n.created_at, u.display_name AS name, n.user_id FROM notes n JOIN users u ON u.id = n.user_id
      WHERE n.story_id = ? AND (n.private = 0 OR n.user_id = ?) ORDER BY n.id`, id, req.user.id)).map(({ user_id, ...n }) => ({ ...n, mine: user_id === req.user.id, private: bool(n.private) })),
    lists: (await db.all("SELECT l.id, l.title, EXISTS(SELECT 1 FROM list_items i WHERE i.list_id = l.id AND i.story_id = ?) AS has FROM lists l WHERE l.owner_id = ? ORDER BY l.title", id, req.user.id)).map((l) => ({ ...l, has: bool(l.has) })),
    inPublicLists: await db.all("SELECT l.id, l.title, u.display_name AS owner FROM list_items i JOIN lists l ON l.id = i.list_id JOIN users u ON u.id = l.owner_id WHERE i.story_id = ? AND l.public = 1", id),
  };
}));
const storyExists = async (id) => (await db.get("SELECT id FROM stories WHERE id = ?", id)) || notFound("That story");
async function toggle(table, uid, sid) {
  await storyExists(sid);
  if (await db.get(`SELECT 1 AS x FROM ${table} WHERE user_id = ? AND story_id = ?`, uid, sid)) { await db.run(`DELETE FROM ${table} WHERE user_id = ? AND story_id = ?`, uid, sid); return false; }
  await db.run(`INSERT OR IGNORE INTO ${table} (user_id, story_id, created_at) VALUES (?, ?, ?)`, uid, sid, now()); return true;
}
app.post("/api/stories/:id/vote", auth, wrap(async (req) => {
  const sid = Number(req.params.id); const voted = await toggle("votes", req.user.id, sid);
  return { voted, votes: (await db.get("SELECT COUNT(*) AS n FROM votes WHERE story_id = ?", sid)).n };
}));
app.post("/api/stories/:id/save", auth, wrap(async (req) => ({ saved: await toggle("saves", req.user.id, Number(req.params.id)) })));
app.post("/api/stories/:id/notes", auth, wrap(async (req) => {
  const sid = Number(req.params.id); await storyExists(sid);
  const text = str(req.body.text, 2000); if (!text) bad("Write the note first.");
  await db.run("INSERT INTO notes (user_id, story_id, text, private, created_at) VALUES (?, ?, ?, ?, ?)", req.user.id, sid, text, req.body.private === false ? 0 : 1, now());
  return { ok: true };
}));
app.delete("/api/notes/:id", auth, wrap(async (req) => {
  const n = await db.get("SELECT * FROM notes WHERE id = ?", Number(req.params.id)); if (!n) notFound("That note");
  if (n.user_id !== req.user.id) forbid("You can only delete your own notes.");
  await db.run("DELETE FROM notes WHERE id = ?", n.id); return { ok: true };
}));
// Submit a link by hand (anything worth tracking that no source carries).
app.post("/api/stories", auth, limit(20, 36e5), wrap(async (req) => {
  const url = str(req.body.url, 600), title = str(req.body.title, 300);
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) bad("Enter a full link starting with https://");
  if (title.length < 8) bad("Give it a descriptive title (8+ characters).");
  if (/(^|\.)(twitter\.com|x\.com)\//i.test(url.replace(/^https?:\/\//, ""))) bad("This homepage doesn't track Twitter/X posts. Link to the paper, post or article itself.");
  const r = await db.tx((t) => addItem(t, { url, title, summary: str(req.body.summary, 700), published: now() }, null, req.user.id));
  return { id: r?.sid };
}));

/* -------------------------------------------------------------------- lists */
const listRow = async (id) => (await db.get("SELECT * FROM lists WHERE id = ?", id)) || notFound("That list");
app.get("/api/lists", auth, wrap(async (req) => {
  const rows = await db.all(`SELECT l.id, l.title, l.description, l.public, l.owner_id, u.display_name AS owner,
    (SELECT COUNT(*) FROM list_items i WHERE i.list_id = l.id) AS items, (SELECT COUNT(*) FROM follows f WHERE f.list_id = l.id) AS followers,
    EXISTS(SELECT 1 FROM follows f WHERE f.list_id = l.id AND f.user_id = ?) AS following
    FROM lists l JOIN users u ON u.id = l.owner_id WHERE l.public = 1 OR l.owner_id = ? ORDER BY l.created_at DESC, l.id DESC`, req.user.id, req.user.id);
  return { lists: rows.map(({ owner_id, ...l }) => ({ ...l, mine: owner_id === req.user.id, public: bool(l.public), following: bool(l.following) })) };
}));
app.post("/api/lists", auth, wrap(async (req) => {
  const title = str(req.body.title, 120); if (!title) bad("Give the list a title.");
  return { id: await db.insert("INSERT INTO lists (owner_id, title, description, public, created_at) VALUES (?, ?, ?, ?, ?)", req.user.id, title, str(req.body.description, 600), req.body.public === false ? 0 : 1, now()) };
}));
app.get("/api/lists/:id", auth, wrap(async (req) => {
  const l = await listRow(Number(req.params.id)); if (!bool(l.public) && l.owner_id !== req.user.id) forbid("This list is private.");
  const ids = await db.all("SELECT story_id, note FROM list_items WHERE list_id = ? ORDER BY added_at DESC", l.id);
  const notes = Object.fromEntries(ids.map((i) => [i.story_id, i.note]));
  const stories = ids.length ? await storyRows(`s.id IN (${ids.map(() => "?").join(",")})`, ids.map((i) => i.story_id), req.user.id, { sort: "new", limit: 500 }) : [];
  return { list: { ...l, public: bool(l.public), mine: l.owner_id === req.user.id, owner: (await db.get("SELECT display_name AS n FROM users WHERE id = ?", l.owner_id)).n,
    following: !!(await db.get("SELECT 1 AS x FROM follows WHERE user_id = ? AND list_id = ?", req.user.id, l.id)) }, stories: stories.map((s) => ({ ...s, listNote: notes[s.id] || "" })) };
}));
app.put("/api/lists/:id/items/:sid", auth, wrap(async (req) => {
  const l = await listRow(Number(req.params.id)); if (l.owner_id !== req.user.id) forbid("Only the list's owner can change it.");
  const sid = Number(req.params.sid); await storyExists(sid);
  if (req.body.remove) await db.run("DELETE FROM list_items WHERE list_id = ? AND story_id = ?", l.id, sid);
  else await db.run("INSERT INTO list_items (list_id, story_id, note, added_at) VALUES (?, ?, ?, ?) ON CONFLICT (list_id, story_id) DO UPDATE SET note = excluded.note", l.id, sid, str(req.body.note, 400), now());
  return { ok: true };
}));
app.post("/api/lists/:id/follow", auth, wrap(async (req) => {
  const l = await listRow(Number(req.params.id)); if (!bool(l.public)) forbid("This list is private.");
  if (await db.get("SELECT 1 AS x FROM follows WHERE user_id = ? AND list_id = ?", req.user.id, l.id)) { await db.run("DELETE FROM follows WHERE user_id = ? AND list_id = ?", req.user.id, l.id); return { following: false }; }
  await db.run("INSERT OR IGNORE INTO follows (user_id, list_id) VALUES (?, ?)", req.user.id, l.id); return { following: true };
}));
app.delete("/api/lists/:id", auth, wrap(async (req) => {
  const l = await listRow(Number(req.params.id)); if (l.owner_id !== req.user.id) forbid("Only the list's owner can delete it.");
  await db.run("DELETE FROM lists WHERE id = ?", l.id); return { ok: true };
}));

/* ------------------------------------------------------------------ sources */
app.get("/api/sources", auth, wrap(async (req) => ({
  sources: await db.all(`SELECT s.*, u.display_name AS suggested_by_name, (SELECT COUNT(DISTINCT story_id) FROM story_links l WHERE l.source_id = s.id) AS stories
    FROM sources s LEFT JOIN users u ON u.id = s.suggested_by ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.kind, s.name`),
  kinds: KINDS.filter((k) => k !== "submitted"), fetching: harvester.isRunning(), fetchMinutes: process.env.VERCEL ? null : FETCH_MINUTES, schedule: process.env.VERCEL ? "daily (Vercel Cron)" : null, isAdmin: req.user.admin,
  formats: Object.entries(feeds.FORMATS).map(([id, f]) => ({ id, label: f.label })),
})));
app.post("/api/sources/suggest", auth, limit(10, 36e5), wrap(async (req) => {
  const name = str(req.body.name, 100), url = str(req.body.url, 600), kind = str(req.body.kind, 30), format = FORMAT_IDS.includes(req.body.format) ? req.body.format : "rss";
  if (!name || !/^https?:\/\//.test(url)) bad("Give the source a name and its feed URL (https://…).");
  if (!KINDS.includes(kind) || kind === "submitted") bad("Pick what kind of source it is.");
  if (/(twitter\.com|x\.com|nitter)/i.test(url)) bad("This homepage doesn't track Twitter/X. Suggest the person's blog or newsletter instead.");
  if (await db.get("SELECT 1 AS x FROM sources WHERE url = ?", url)) bad("That feed is already listed.");
  await db.run("INSERT INTO sources (name, kind, format, url, home, status, suggested_by, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    name, kind, format, url, str(req.body.home, 600), req.user.admin ? "active" : "pending", req.user.id, str(req.body.note, 300), now());
  return { ok: true, status: req.user.admin ? "active" : "pending" };
}));
app.put("/api/sources/:id", auth, admin, wrap(async (req) => {
  const s = await db.get("SELECT * FROM sources WHERE id = ?", Number(req.params.id)); if (!s) notFound("That source");
  const status = ["active", "paused", "pending", "rejected"].includes(req.body.status) ? req.body.status : s.status;
  await db.run("UPDATE sources SET status = ?, url = ?, name = ? WHERE id = ?", status, str(req.body.url, 600) || s.url, str(req.body.name, 100) || s.name, s.id);
  return { ok: true };
}));
app.post("/api/sources/fetch", auth, admin, wrap(async (req) => {
  const r = await fetchAll(req.body.id ? Number(req.body.id) : null);
  await audit.log(req.user.id, "harvest.run", req.body.id ? `source:${req.body.id}` : "all", r.skipped ? "skipped" : `${r.ok} ok, ${r.errors} errors, ${r.stored} new`);
  return r;
}));
// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET". Without a secret configured it stays closed.
app.get("/api/cron/fetch", wrap(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) { res.status(401).json({ error: "Not authorized." }); return; }
  return harvester.harvest({ trigger: "cron" });
}));

/* ---------------------------------------------------------------- agent log */
// Entries are visible to every signed-in user (so the instructor can read them); only the author can write.
// Each autosave records how much text changed, how much was typed vs pasted, and active editing time.
// That is evidence of how an entry was written, not proof: the counts come from the author's browser.
const LOG_FIELDS = ["went_wrong", "caught_how", "fix"];
const logRow = async (id) => (await db.get("SELECT * FROM agent_log WHERE id = ?", id)) || notFound("That entry");
async function shapeLog(e, uid) {
  const author = await db.get("SELECT display_name AS name, username FROM users WHERE id = ?", e.author_id);
  const saves = await db.get("SELECT COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last FROM agent_log_saves WHERE entry_id = ?", e.id);
  const total = LOG_FIELDS.reduce((a, k) => a + (e[k] || "").length, 0);
  return { ...e, active_ms: Number(e.active_ms), author, mine: e.author_id === uid, total_chars: total, saves: saves.n, first_save: saves.first, last_save: saves.last };
}
app.get("/api/agent-log", auth, wrap(async (req) => {
  const rows = await db.all("SELECT * FROM agent_log WHERE status = 'submitted' OR author_id = ? ORDER BY session_date DESC, id DESC", req.user.id);
  return { entries: await Promise.all(rows.map((e) => shapeLog(e, req.user.id))) };
}));
app.post("/api/agent-log", auth, wrap(async (req) => {
  // The browser sends its local date; the fallback uses the app's time zone (US Central by default), not UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.sessionDate) ? req.body.sessionDate : new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
  const id = await db.insert("INSERT INTO agent_log (author_id, session_date, agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", req.user.id, date, str(req.body.agent, 80), now(), now());
  return { entry: await shapeLog(await logRow(id), req.user.id) };
}));
app.get("/api/agent-log/:id", auth, wrap(async (req) => {
  const e = await logRow(Number(req.params.id)); if (e.status !== "submitted" && e.author_id !== req.user.id) forbid("That draft belongs to someone else.");
  return { entry: await shapeLog(e, req.user.id), timeline: await db.all("SELECT at, total_chars, typed_delta, pasted_delta, active_delta_ms FROM agent_log_saves WHERE entry_id = ? ORDER BY id", e.id) };
}));
app.put("/api/agent-log/:id", auth, limit(240, 6e5), wrap(async (req) => {
  const e = await logRow(Number(req.params.id)); if (e.author_id !== req.user.id) forbid("You can only edit your own agent log entries.");
  const b = req.body, f = Object.fromEntries(LOG_FIELDS.map((k) => [k, typeof b[k] === "string" ? b[k].slice(0, 4000) : e[k]]));
  const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const typed = n(b.typedDelta, 20000), pasted = n(b.pastedDelta, 20000), active = n(b.activeDeltaMs, 15 * 60e3), edits = n(b.editDelta, 20000);
  const total = LOG_FIELDS.reduce((a, k) => a + f[k].length, 0);
  const submit = b.submit === true;
  if (submit && (!f.went_wrong.trim() || !f.caught_how.trim())) bad("Fill in what the agent got wrong and how you caught it before submitting.");
  await db.tx(async (t) => {
    await t.run(`UPDATE agent_log SET went_wrong = ?, caught_how = ?, fix = ?, link = ?, agent = ?, session_date = ?,
        typed_chars = typed_chars + ?, pasted_chars = pasted_chars + ?, active_ms = active_ms + ?, edit_events = edit_events + ?, updated_at = ?,
        status = ?, submitted_at = ? WHERE id = ?`,
      f.went_wrong, f.caught_how, f.fix, str(b.link, 400) || e.link, str(b.agent, 80) || e.agent, /^\d{4}-\d{2}-\d{2}$/.test(b.sessionDate) ? b.sessionDate : e.session_date,
      typed, pasted, active, edits, now(), submit ? "submitted" : e.status, submit && !e.submitted_at ? now() : e.submitted_at, e.id);
    if (typed || pasted || active || submit) await t.run("INSERT INTO agent_log_saves (entry_id, at, total_chars, typed_delta, pasted_delta, active_delta_ms) VALUES (?, ?, ?, ?, ?, ?)", e.id, now(), total, typed, pasted, active);
  });
  return { entry: await shapeLog(await logRow(e.id), req.user.id) };
}));
app.delete("/api/agent-log/:id", auth, wrap(async (req) => {
  const e = await logRow(Number(req.params.id)); if (e.author_id !== req.user.id) forbid("You can only delete your own entries.");
  if (e.status === "submitted") bad("Submitted entries stay in the log. Edit it instead.");
  await db.run("DELETE FROM agent_log WHERE id = ?", e.id); return { ok: true };
}));
app.get("/api/agent-log-export.md", auth, wrap(async (req, res) => {
  const rows = await Promise.all((await db.all("SELECT * FROM agent_log WHERE status = 'submitted' ORDER BY session_date, id")).map((e) => shapeLog(e, req.user.id)));
  const mins = (ms) => Math.round(ms / 6e4);
  const md = ["# Agent log", "", `Exported ${new Date().toISOString().slice(0, 10)}. Each entry was written by its author in the Agent log page. The writing record (time spent, autosaves, typed vs pasted characters) is collected by the editor in the author's browser: evidence of how it was written, not proof.`, ""]
    .concat(rows.flatMap((e) => [`## ${e.session_date} · ${e.author.name}${e.agent ? ` · ${e.agent}` : ""}`, "", "**What the agent got wrong**", "", e.went_wrong, "", "**How I caught it**", "", e.caught_how, "",
      ...(e.fix ? ["**What I did about it**", "", e.fix, ""] : []), ...(e.link ? [`Link: ${e.link}`, ""] : []),
      `*Writing record: ${mins(e.active_ms)} min active, ${e.saves} autosaves, ${e.typed_chars} characters typed, ${e.pasted_chars} pasted.*`, ""]));
  res.type("text/markdown").set("Content-Disposition", 'attachment; filename="agent-log.md"').send(md.join("\n"));
}));

/* -------------------------------------------- weekly brief (a json-render spec) */
let viewsP; const views = () => (viewsP ||= Promise.all([import("./views/specs.mjs"), import("./views/catalog.mjs")]).then(([s, c]) => ({ ...s, catalog: c.catalog })));
function weekBounds(weekStart) {
  const d = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? new Date(weekStart + "T00:00:00Z") : new Date();
  const day = (d.getUTCDay() + 6) % 7; const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (weekStart ? 0 : day)));
  return { start, end: new Date(start.getTime() + 7 * 864e5) };
}
app.get("/api/brief", auth, wrap(async (req) => {
  const { start, end } = weekBounds(str(req.query.week, 10));
  const prevStart = new Date(start.getTime() - 7 * 864e5);
  const inRange = "COALESCE(s.published_at, s.first_seen) >= ? AND COALESCE(s.published_at, s.first_seen) < ?";
  const stories = await storyRows(inRange, [start.toISOString(), end.toISOString()], req.user.id, { sort: "top", limit: 1000 });
  const prev = await db.all(`SELECT t.topic, COUNT(*) AS n FROM story_topics t JOIN stories s ON s.id = t.story_id WHERE COALESCE(s.hidden, 0) = 0 AND COALESCE(s.in_scope, 1) = 1 AND ${inRange} GROUP BY t.topic`, prevStart.toISOString(), start.toISOString());
  const prevMap = Object.fromEntries(prev.map((r) => [r.topic, r.n]));
  const kinds = {}; stories.forEach((s) => new Set(s.sources.map((x) => x.kind)).forEach((k) => (kinds[k] = (kinds[k] || 0) + 1)));
  const v = await views();
  return { spec: v.weeklyBrief({ start, end, stories, topics: tagger.topicList(), prevCounts: prevMap, kinds }), week: start.toISOString().slice(0, 10) };
}));
app.get("/api/agent-log-view", auth, wrap(async (req) => {
  const rows = await Promise.all((await db.all("SELECT * FROM agent_log WHERE status = 'submitted' ORDER BY session_date")).map((e) => shapeLog(e, req.user.id)));
  return { spec: (await views()).agentLogSummary(rows) };
}));
app.get("/api/catalog", wrap(async () => { const { catalog } = await views(); return { components: Object.keys(catalog.data?.components ?? {}), prompt: catalog.prompt(), jsonSchema: catalog.jsonSchema() }; }));

/* -------------------------------------------------------------------- admin */
// Everything modules need from the core, passed to their routes and start hooks (never imported directly).
function moduleDeps() {
  return { app, db, auth, admin, wrap, str, bad, forbid, notFound, bool, now, KINDS, FORMAT_IDS, harvester, audit, tagger, feeds, analysis, storyRows, views, kernel };
}
kernel.mount(app, moduleDeps());
app.get("/api/modules", auth, admin, wrap(() => kernel.describe()));
// Module pages live in modules/<id>/pages and are served at /m/<page> (the build copies them into public/m for Vercel).
for (const m of kernel.modules) { const dir = path.join(m.dir, "pages"); if (require("node:fs").existsSync(dir)) app.use("/m", express.static(dir, { extensions: ["html"] })); }
for (const [from, to] of [["/capabilities", "/m/capabilities"], ["/admin", "/m/admin"], ["/project", "/m/project"]]) app.get(from, (req, res) => res.redirect(301, to));

/* ------------------------------------------------------------------ static */
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That's too big." });
  console.error(err); res.status(500).json({ error: "Something went wrong on the server." });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  boot().then(() => {
    app.listen(PORT, () => console.log(`Superintelligence Homepage on http://localhost:${PORT} (${db.engine})`));
    // Locally, check every FETCH_MINUTES for sources that are due (each source keeps its own interval).
    const tick = () => harvester.harvest({ trigger: "schedule" }).then((r) => r.sources && console.log(`Harvest: ${r.ok} ok, ${r.errors} errors, ${r.stored} new stories`)).catch((e) => console.error("Harvest failed:", e.message));
    if (FETCH_MINUTES > 0) { tick(); setInterval(tick, FETCH_MINUTES * 60e3).unref(); }
  });
}
module.exports = { app, db, ingestItems, seedSources, fetchAll, boot, harvester };
