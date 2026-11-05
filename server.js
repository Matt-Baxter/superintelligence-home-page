// Superintelligence Homepage: multi-source AI-progress feed with accounts, curation, a weekly brief and an agent log.
// Run: node server.js   Env: PORT, DATA_DIR, FETCH_MINUTES (0 = never fetch), NODE_ENV=production
const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const feeds = require("./lib/feeds");
const tagger = require("./lib/tagger");

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FETCH_MINUTES = Number(process.env.FETCH_MINUTES ?? 30);
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "si.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, display_name TEXT NOT NULL,
  pass_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, format TEXT NOT NULL, url TEXT UNIQUE NOT NULL,
  home TEXT DEFAULT '', status TEXT DEFAULT 'active', suggested_by INTEGER REFERENCES users(id), note TEXT DEFAULT '',
  last_fetched TEXT, last_ok TEXT, last_error TEXT, last_count INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stories (id INTEGER PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, summary TEXT DEFAULT '', authors TEXT DEFAULT '',
  published_at TEXT, first_seen TEXT DEFAULT CURRENT_TIMESTAMP, topics TEXT DEFAULT '[]', orgs TEXT DEFAULT '[]', ext_score INTEGER DEFAULT 0, submitted_by INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS story_keys (key TEXT PRIMARY KEY, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS story_links (id INTEGER PRIMARY KEY, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL, url TEXT NOT NULL, title TEXT NOT NULL, published_at TEXT, seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (story_id, source_id, url));
CREATE TABLE IF NOT EXISTS story_topics (story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE, topic TEXT NOT NULL, PRIMARY KEY (story_id, topic));
CREATE TABLE IF NOT EXISTS votes (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, story_id));
CREATE TABLE IF NOT EXISTS saves (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, read_at TEXT, PRIMARY KEY (user_id, story_id));
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  text TEXT NOT NULL, private INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT DEFAULT '',
  public INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS list_items (list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  note TEXT DEFAULT '', added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (list_id, story_id));
CREATE TABLE IF NOT EXISTS follows (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE, PRIMARY KEY (user_id, list_id));

CREATE TABLE IF NOT EXISTS agent_log (id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_date TEXT NOT NULL,
  agent TEXT DEFAULT '', went_wrong TEXT DEFAULT '', caught_how TEXT DEFAULT '', fix TEXT DEFAULT '', link TEXT DEFAULT '', status TEXT DEFAULT 'draft',
  typed_chars INTEGER DEFAULT 0, pasted_chars INTEGER DEFAULT 0, active_ms INTEGER DEFAULT 0, edit_events INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, submitted_at TEXT);
CREATE TABLE IF NOT EXISTS agent_log_saves (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES agent_log(id) ON DELETE CASCADE,
  at TEXT DEFAULT CURRENT_TIMESTAMP, total_chars INTEGER NOT NULL, typed_delta INTEGER DEFAULT 0, pasted_delta INTEGER DEFAULT 0, active_delta_ms INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_links_story ON story_links(story_id);
CREATE INDEX IF NOT EXISTS idx_topics_topic ON story_topics(topic);
CREATE INDEX IF NOT EXISTS idx_stories_seen ON stories(first_seen);
`);

/* ------------------------------------------------------------------ helpers */
const q = (sql) => db.prepare(sql);
const tx = (fn) => { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };
const str = (v, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => { throw new HttpError(400, m); };
const forbid = (m = "You don't have access to this.") => { throw new HttpError(403, m); };
const notFound = (w = "That item") => { throw new HttpError(404, `${w} wasn't found.`); };
const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).then((o) => o !== undefined && res.json(o)).catch(next);
const nowIso = () => new Date().toISOString();

function hashPassword(pw) { const salt = crypto.randomBytes(16).toString("hex"); return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`; }
function checkPassword(pw, stored) { const [s, h] = stored.split(":"); return crypto.timingSafeEqual(crypto.scryptSync(pw, s, 64), Buffer.from(h, "hex")); }
const SESSION_DAYS = 30;
function startSession(res, uid) {
  const token = crypto.randomBytes(32).toString("hex");
  q("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, uid, Date.now() + SESSION_DAYS * 864e5);
  res.cookie("sid", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_DAYS * 864e5 });
}
const cookie = (req, n) => { const m = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(n + "=")); return m ? decodeURIComponent(m.slice(n.length + 1)) : null; };

/* ---------------------------------------------------------------- ingestion */
function addItem(item, sourceId, submittedBy = null) {
  const keys = feeds.storyKeys(item);
  if (!keys.length) return null;
  let sid = null;
  for (const k of keys) { const r = q("SELECT story_id FROM story_keys WHERE key = ?").get(k); if (r) { sid = r.story_id; break; } }
  if (!sid) {
    const t = tagger.tag(item.title, item.summary);
    sid = Number(q(`INSERT INTO stories (title, url, summary, authors, published_at, topics, orgs, ext_score, submitted_by) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(item.title, feeds.canonicalUrl(item), item.summary || "", (item.authors || []).join(", "), item.published, JSON.stringify(t.topics), JSON.stringify(t.orgs), item.score || 0, submittedBy).lastInsertRowid);
    t.topics.forEach((x) => q("INSERT OR IGNORE INTO story_topics (story_id, topic) VALUES (?, ?)").run(sid, x.id));
  } else if (item.score) q("UPDATE stories SET ext_score = MAX(ext_score, ?) WHERE id = ?").run(item.score, sid);
  keys.forEach((k) => q("INSERT OR IGNORE INTO story_keys (key, story_id) VALUES (?, ?)").run(k, sid));
  q("INSERT OR IGNORE INTO story_links (story_id, source_id, url, title, published_at) VALUES (?, ?, ?, ?, ?)").run(sid, sourceId, item.url, item.title, item.published);
  return sid;
}
function ingestItems(sourceId, items) { return tx(() => items.map((it) => addItem(it, sourceId)).filter(Boolean).length); }
let fetching = false;
async function fetchAll(only = null) {
  if (fetching) return { skipped: true };
  fetching = true; const report = [];
  try {
    const list = q("SELECT * FROM sources WHERE status = 'active'" + (only ? " AND id = ?" : "")).all(...(only ? [only] : []));
    await Promise.all(list.map(async (s) => {
      q("UPDATE sources SET last_fetched = ? WHERE id = ?").run(nowIso(), s.id);
      try {
        const items = await feeds.fetchSource(s); const n = ingestItems(s.id, items);
        q("UPDATE sources SET last_ok = ?, last_error = NULL, last_count = ? WHERE id = ?").run(nowIso(), items.length, s.id);
        report.push({ source: s.name, items: items.length, stored: n });
      } catch (e) {
        q("UPDATE sources SET last_error = ? WHERE id = ?").run(String(e.cause?.code || e.message).slice(0, 200), s.id);
        report.push({ source: s.name, error: String(e.cause?.code || e.message) });
      }
    }));
  } finally { fetching = false; }
  return { report };
}
function seedSources() {
  if (q("SELECT COUNT(*) AS n FROM sources").get().n) return;
  const { sources } = require("./lib/sources.json");
  tx(() => sources.forEach((s) => q("INSERT INTO sources (name, kind, format, url, home) VALUES (?, ?, ?, ?, ?)").run(s.name, s.kind, s.format, s.url, s.home || "")));
}

/* ------------------------------------------------------------------- app */
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  const t = cookie(req, "sid");
  if (t) {
    const r = q("SELECT u.id, u.username, u.display_name, u.is_admin, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?").get(t);
    if (r && r.expires_at > Date.now()) req.user = { id: r.id, username: r.username, name: r.display_name, admin: !!r.is_admin };
    else if (r) q("DELETE FROM sessions WHERE token = ?").run(t);
  }
  next();
});
const auth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please sign in first." }));
const admin = (req, res, next) => (req.user?.admin ? next() : res.status(403).json({ error: "Only an admin can do this." }));
const hits = new Map();
const limit = (n, ms) => (req, res, next) => {
  const k = req.path + req.ip, now = Date.now(), l = (hits.get(k) || []).filter((t) => now - t < ms);
  if (l.length >= n) return res.status(429).json({ error: "Too many requests. Wait a few minutes and try again." });
  l.push(now); hits.set(k, l); next();
};

/* accounts — the first account becomes the admin */
app.post("/api/signup", limit(30, 6e5), wrap((req, res) => {
  const u = str(req.body.username, 40), name = str(req.body.displayName, 60) || u, pw = req.body.password || "";
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(u)) bad("Usernames are 3–40 letters, numbers, dots, dashes or underscores.");
  if (typeof pw !== "string" || pw.length < 8) bad("Passwords need at least 8 characters.");
  if (q("SELECT 1 FROM users WHERE username = ?").get(u)) bad("That username is taken.");
  const first = q("SELECT COUNT(*) AS n FROM users").get().n === 0;
  const id = Number(q("INSERT INTO users (username, display_name, pass_hash, is_admin) VALUES (?, ?, ?, ?)").run(u, name, hashPassword(pw), first ? 1 : 0).lastInsertRowid);
  startSession(res, id); return { user: { id, username: u, name, admin: first } };
}));
app.post("/api/login", limit(30, 6e5), wrap((req, res) => {
  const u = q("SELECT * FROM users WHERE username = ?").get(str(req.body.username, 40));
  if (!u || !checkPassword(String(req.body.password || ""), u.pass_hash)) throw new HttpError(401, "Wrong username or password.");
  startSession(res, u.id); return { user: { id: u.id, username: u.username, name: u.display_name, admin: !!u.is_admin } };
}));
app.post("/api/logout", wrap((req, res) => { const t = cookie(req, "sid"); if (t) q("DELETE FROM sessions WHERE token = ?").run(t); res.clearCookie("sid"); return { ok: true }; }));
app.get("/api/me", wrap((req) => ({ user: req.user || null })));
app.get("/api/ontology", wrap(() => ({ topics: tagger.topicList(), orgs: tagger.orgList(), about: tagger.ontology.about })));

/* ------------------------------------------------------------------ stories */
const KINDS = ["papers", "lab", "research-org", "forum", "newsletter", "academic", "community", "news", "policy", "submitted"];
function storyRows(where, args, uid, { sort = "top", limit = 40, offset = 0 } = {}) {
  const rows = q(`SELECT s.*, (SELECT COUNT(*) FROM votes v WHERE v.story_id = s.id) AS votes,
      (SELECT COUNT(DISTINCT COALESCE(l.source_id, -l.id)) FROM story_links l WHERE l.story_id = s.id) AS nsources,
      EXISTS(SELECT 1 FROM votes v WHERE v.story_id = s.id AND v.user_id = ?) AS voted,
      EXISTS(SELECT 1 FROM saves v WHERE v.story_id = s.id AND v.user_id = ?) AS saved,
      (SELECT COUNT(*) FROM notes n WHERE n.story_id = s.id AND (n.private = 0 OR n.user_id = ?)) AS nnotes,
      COALESCE(s.published_at, s.first_seen) AS t
    FROM stories s WHERE ${where}`).all(uid, uid, uid, ...args);
  const now = Date.now();
  rows.forEach((r) => {
    const hours = Math.max(0, (now - Date.parse(r.t.includes("T") ? r.t : r.t.replace(" ", "T") + "Z")) / 36e5);
    // Votes count most; being covered by several independent sources is a strong signal; older stories sink.
    r.rank = (1 + r.votes * 3 + (r.nsources - 1) * 2 + Math.log10(1 + r.ext_score)) / Math.pow(hours + 2, 1.15);
  });
  rows.sort(sort === "new" ? (a, b) => (a.t < b.t ? 1 : -1) : sort === "votes" ? (a, b) => b.votes - a.votes || (a.t < b.t ? 1 : -1) : (a, b) => b.rank - a.rank);
  return rows.slice(offset, offset + limit).map((r) => shapeStory(r));
}
function shapeStory(r) {
  const links = q(`SELECT l.url, l.title, l.published_at, src.name AS source, src.kind FROM story_links l LEFT JOIN sources src ON src.id = l.source_id WHERE l.story_id = ? ORDER BY l.id`).all(r.id);
  return {
    id: r.id, title: r.title, url: r.url, summary: r.summary, authors: r.authors, published_at: r.published_at, first_seen: r.first_seen,
    topics: JSON.parse(r.topics), orgs: JSON.parse(r.orgs), votes: r.votes, voted: !!r.voted, saved: !!r.saved, notes: r.nnotes,
    sources: links.map((l) => ({ name: l.source || "Submitted by a reader", kind: l.kind || "submitted", url: l.url, title: l.title })),
    nsources: r.nsources,
  };
}
app.get("/api/stories", auth, wrap((req) => {
  const w = ["1=1"], a = [];
  const topic = str(req.query.topic, 40), kind = str(req.query.kind, 30), org = str(req.query.org, 40), qtext = str(req.query.q, 100).toLowerCase();
  const days = Math.min(365, Number(req.query.days) || 0);
  if (topic) { w.push("s.id IN (SELECT story_id FROM story_topics WHERE topic = ?)"); a.push(topic); }
  if (kind) { w.push("s.id IN (SELECT l.story_id FROM story_links l LEFT JOIN sources src ON src.id = l.source_id WHERE COALESCE(src.kind, 'submitted') = ?)"); a.push(kind); }
  if (org) { w.push("s.orgs LIKE ?"); a.push(`%"id":"${org.replace(/[%_"]/g, "")}"%`); }
  if (qtext) { w.push("(LOWER(s.title) LIKE ? OR LOWER(s.summary) LIKE ?)"); a.push(`%${qtext}%`, `%${qtext}%`); }
  if (days) { w.push("COALESCE(s.published_at, s.first_seen) >= ?"); a.push(new Date(Date.now() - days * 864e5).toISOString()); }
  if (req.query.saved === "1") { w.push("s.id IN (SELECT story_id FROM saves WHERE user_id = ?)"); a.push(req.user.id); }
  const sort = ["top", "new", "votes"].includes(req.query.sort) ? req.query.sort : "top";
  const offset = Math.max(0, Number(req.query.offset) || 0);
  return { stories: storyRows(w.join(" AND "), a, req.user.id, { sort, offset, limit: 40 }), sort };
}));
app.get("/api/stories/:id", auth, wrap((req) => {
  const id = Number(req.params.id); const rows = storyRows("s.id = ?", [id], req.user.id); if (!rows.length) notFound("That story");
  return {
    story: rows[0],
    notes: q(`SELECT n.id, n.text, n.private, n.created_at, u.display_name AS name, n.user_id = ? AS mine FROM notes n JOIN users u ON u.id = n.user_id
      WHERE n.story_id = ? AND (n.private = 0 OR n.user_id = ?) ORDER BY n.id`).all(req.user.id, id, req.user.id).map((n) => ({ ...n, mine: !!n.mine, private: !!n.private })),
    lists: q("SELECT l.id, l.title, EXISTS(SELECT 1 FROM list_items i WHERE i.list_id = l.id AND i.story_id = ?) AS has FROM lists l WHERE l.owner_id = ? ORDER BY l.title").all(id, req.user.id).map((l) => ({ ...l, has: !!l.has })),
    inPublicLists: q("SELECT l.id, l.title, u.display_name AS owner FROM list_items i JOIN lists l ON l.id = i.list_id JOIN users u ON u.id = l.owner_id WHERE i.story_id = ? AND l.public = 1").all(id),
  };
}));
const storyExists = (id) => q("SELECT id FROM stories WHERE id = ?").get(id) || notFound("That story");
function toggle(table, uid, sid) {
  storyExists(sid);
  if (q(`SELECT 1 FROM ${table} WHERE user_id = ? AND story_id = ?`).get(uid, sid)) { q(`DELETE FROM ${table} WHERE user_id = ? AND story_id = ?`).run(uid, sid); return false; }
  q(`INSERT INTO ${table} (user_id, story_id) VALUES (?, ?)`).run(uid, sid); return true;
}
app.post("/api/stories/:id/vote", auth, wrap((req) => ({ voted: toggle("votes", req.user.id, Number(req.params.id)), votes: q("SELECT COUNT(*) AS n FROM votes WHERE story_id = ?").get(Number(req.params.id)).n })));
app.post("/api/stories/:id/save", auth, wrap((req) => ({ saved: toggle("saves", req.user.id, Number(req.params.id)) })));
app.post("/api/stories/:id/notes", auth, wrap((req) => {
  const sid = Number(req.params.id); storyExists(sid);
  const text = str(req.body.text, 2000); if (!text) bad("Write the note first.");
  q("INSERT INTO notes (user_id, story_id, text, private) VALUES (?, ?, ?, ?)").run(req.user.id, sid, text, req.body.private === false ? 0 : 1);
  return { ok: true };
}));
app.delete("/api/notes/:id", auth, wrap((req) => {
  const n = q("SELECT * FROM notes WHERE id = ?").get(Number(req.params.id)); if (!n) notFound("That note");
  if (n.user_id !== req.user.id) forbid("You can only delete your own notes.");
  q("DELETE FROM notes WHERE id = ?").run(n.id); return { ok: true };
}));
// Submit a link by hand (anything worth tracking that no source carries).
app.post("/api/stories", auth, limit(20, 36e5), wrap((req) => {
  const url = str(req.body.url, 600), title = str(req.body.title, 300);
  if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(url)) bad("Enter a full link starting with https://");
  if (title.length < 8) bad("Give it a descriptive title (8+ characters).");
  if (/(^|\.)(twitter\.com|x\.com)\//i.test(url.replace(/^https?:\/\//, ""))) bad("This homepage doesn't track Twitter/X posts. Link to the paper, post or article itself.");
  const id = tx(() => addItem({ url, title, summary: str(req.body.summary, 700), published: nowIso() }, null, req.user.id));
  return { id };
}));

/* -------------------------------------------------------------------- lists */
const listRow = (id) => q("SELECT * FROM lists WHERE id = ?").get(id) || notFound("That list");
app.get("/api/lists", auth, wrap((req) => {
  const sql = `SELECT l.id, l.title, l.description, l.public, l.owner_id = ? AS mine, u.display_name AS owner,
    (SELECT COUNT(*) FROM list_items i WHERE i.list_id = l.id) AS items, (SELECT COUNT(*) FROM follows f WHERE f.list_id = l.id) AS followers,
    EXISTS(SELECT 1 FROM follows f WHERE f.list_id = l.id AND f.user_id = ?) AS following
    FROM lists l JOIN users u ON u.id = l.owner_id WHERE l.public = 1 OR l.owner_id = ? ORDER BY l.created_at DESC, l.id DESC`;
  return { lists: q(sql).all(req.user.id, req.user.id, req.user.id).map((l) => ({ ...l, mine: !!l.mine, public: !!l.public, following: !!l.following })) };
}));
app.post("/api/lists", auth, wrap((req) => {
  const title = str(req.body.title, 120); if (!title) bad("Give the list a title.");
  return { id: Number(q("INSERT INTO lists (owner_id, title, description, public) VALUES (?, ?, ?, ?)").run(req.user.id, title, str(req.body.description, 600), req.body.public === false ? 0 : 1).lastInsertRowid) };
}));
app.get("/api/lists/:id", auth, wrap((req) => {
  const l = listRow(Number(req.params.id)); if (!l.public && l.owner_id !== req.user.id) forbid("This list is private.");
  const ids = q("SELECT story_id, note FROM list_items WHERE list_id = ? ORDER BY added_at DESC").all(l.id);
  const notes = Object.fromEntries(ids.map((i) => [i.story_id, i.note]));
  const stories = ids.length ? storyRows(`s.id IN (${ids.map(() => "?").join(",")})`, ids.map((i) => i.story_id), req.user.id, { sort: "new", limit: 500 }) : [];
  return { list: { ...l, mine: l.owner_id === req.user.id, owner: q("SELECT display_name AS n FROM users WHERE id = ?").get(l.owner_id).n,
    following: !!q("SELECT 1 FROM follows WHERE user_id = ? AND list_id = ?").get(req.user.id, l.id) }, stories: stories.map((s) => ({ ...s, listNote: notes[s.id] || "" })) };
}));
app.put("/api/lists/:id/items/:sid", auth, wrap((req) => {
  const l = listRow(Number(req.params.id)); if (l.owner_id !== req.user.id) forbid("Only the list's owner can change it.");
  const sid = Number(req.params.sid); storyExists(sid);
  if (req.body.remove) q("DELETE FROM list_items WHERE list_id = ? AND story_id = ?").run(l.id, sid);
  else q("INSERT INTO list_items (list_id, story_id, note) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET note = excluded.note").run(l.id, sid, str(req.body.note, 400));
  return { ok: true };
}));
app.post("/api/lists/:id/follow", auth, wrap((req) => {
  const l = listRow(Number(req.params.id)); if (!l.public) forbid("This list is private.");
  if (q("SELECT 1 FROM follows WHERE user_id = ? AND list_id = ?").get(req.user.id, l.id)) { q("DELETE FROM follows WHERE user_id = ? AND list_id = ?").run(req.user.id, l.id); return { following: false }; }
  q("INSERT INTO follows (user_id, list_id) VALUES (?, ?)").run(req.user.id, l.id); return { following: true };
}));
app.delete("/api/lists/:id", auth, wrap((req) => {
  const l = listRow(Number(req.params.id)); if (l.owner_id !== req.user.id) forbid("Only the list's owner can delete it.");
  q("DELETE FROM lists WHERE id = ?").run(l.id); return { ok: true };
}));

/* ------------------------------------------------------------------ sources */
app.get("/api/sources", auth, wrap((req) => ({
  sources: q(`SELECT s.*, u.display_name AS suggested_by_name, (SELECT COUNT(DISTINCT story_id) FROM story_links l WHERE l.source_id = s.id) AS stories
    FROM sources s LEFT JOIN users u ON u.id = s.suggested_by ORDER BY s.status = 'active' DESC, s.kind, s.name`).all(),
  kinds: KINDS.filter((k) => k !== "submitted"), fetching, fetchMinutes: FETCH_MINUTES, isAdmin: req.user.admin,
})));
app.post("/api/sources/suggest", auth, limit(10, 36e5), wrap((req) => {
  const name = str(req.body.name, 100), url = str(req.body.url, 600), kind = str(req.body.kind, 30), format = ["rss", "arxiv", "hf-daily"].includes(req.body.format) ? req.body.format : "rss";
  if (!name || !/^https?:\/\//.test(url)) bad("Give the source a name and its feed URL (https://…).");
  if (!KINDS.includes(kind) || kind === "submitted") bad("Pick what kind of source it is.");
  if (/(twitter\.com|x\.com|nitter)/i.test(url)) bad("This homepage doesn't track Twitter/X. Suggest the person's blog or newsletter instead.");
  if (q("SELECT 1 FROM sources WHERE url = ?").get(url)) bad("That feed is already listed.");
  q("INSERT INTO sources (name, kind, format, url, home, status, suggested_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(name, kind, format, url, str(req.body.home, 600), req.user.admin ? "active" : "pending", req.user.id, str(req.body.note, 300));
  return { ok: true, status: req.user.admin ? "active" : "pending" };
}));
app.put("/api/sources/:id", auth, admin, wrap((req) => {
  const s = q("SELECT * FROM sources WHERE id = ?").get(Number(req.params.id)); if (!s) notFound("That source");
  const status = ["active", "paused", "pending", "rejected"].includes(req.body.status) ? req.body.status : s.status;
  q("UPDATE sources SET status = ?, url = ?, name = ? WHERE id = ?").run(status, str(req.body.url, 600) || s.url, str(req.body.name, 100) || s.name, s.id);
  return { ok: true };
}));
app.post("/api/sources/fetch", auth, admin, wrap(async (req) => fetchAll(req.body.id ? Number(req.body.id) : null)));

/* ---------------------------------------------------------------- agent log */
// Entries are visible to every signed-in user (so the instructor can read them); only the author can write.
// Each autosave records how much text changed, how much of it was typed vs pasted, and active editing time.
// That is evidence of how an entry was written, not proof: the counts come from the author's browser.
const LOG_FIELDS = ["went_wrong", "caught_how", "fix"];
const logRow = (id) => q("SELECT * FROM agent_log WHERE id = ?").get(id) || notFound("That entry");
function shapeLog(e, uid) {
  const author = q("SELECT display_name AS name, username FROM users WHERE id = ?").get(e.author_id);
  const saves = q("SELECT COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last FROM agent_log_saves WHERE entry_id = ?").get(e.id);
  const total = LOG_FIELDS.reduce((a, k) => a + (e[k] || "").length, 0);
  return { ...e, author, mine: e.author_id === uid, total_chars: total, saves: saves.n, first_save: saves.first, last_save: saves.last,
    pasted_share: total ? Math.min(1, e.pasted_chars / Math.max(total, e.typed_chars + e.pasted_chars)) : 0 };
}
app.get("/api/agent-log", auth, wrap((req) => ({
  entries: q("SELECT * FROM agent_log WHERE status = 'submitted' OR author_id = ? ORDER BY session_date DESC, id DESC").all(req.user.id).map((e) => shapeLog(e, req.user.id)),
})));
app.post("/api/agent-log", auth, wrap((req) => {
  // The browser sends its local date; the fallback uses the app's time zone (US Central by default), not UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.sessionDate) ? req.body.sessionDate : new Date().toLocaleDateString("en-CA", { timeZone: process.env.APP_TZ || "America/Chicago" });
  const id = Number(q("INSERT INTO agent_log (author_id, session_date, agent) VALUES (?, ?, ?)").run(req.user.id, date, str(req.body.agent, 80)).lastInsertRowid);
  return { entry: shapeLog(logRow(id), req.user.id) };
}));
app.get("/api/agent-log/:id", auth, wrap((req) => {
  const e = logRow(Number(req.params.id)); if (e.status !== "submitted" && e.author_id !== req.user.id) forbid("That draft belongs to someone else.");
  return { entry: shapeLog(e, req.user.id), timeline: q("SELECT at, total_chars, typed_delta, pasted_delta, active_delta_ms FROM agent_log_saves WHERE entry_id = ? ORDER BY id").all(e.id) };
}));
app.put("/api/agent-log/:id", auth, limit(240, 6e5), wrap((req) => {
  const e = logRow(Number(req.params.id)); if (e.author_id !== req.user.id) forbid("You can only edit your own agent log entries.");
  const b = req.body, f = Object.fromEntries(LOG_FIELDS.map((k) => [k, typeof b[k] === "string" ? b[k].slice(0, 4000) : e[k]]));
  const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const typed = n(b.typedDelta, 20000), pasted = n(b.pastedDelta, 20000), active = n(b.activeDeltaMs, 15 * 60e3), edits = n(b.editDelta, 20000);
  const total = LOG_FIELDS.reduce((a, k) => a + f[k].length, 0);
  const submit = b.submit === true;
  if (submit && (!f.went_wrong.trim() || !f.caught_how.trim())) bad("Fill in what the agent got wrong and how you caught it before submitting.");
  tx(() => {
    q(`UPDATE agent_log SET went_wrong = ?, caught_how = ?, fix = ?, link = ?, agent = ?, session_date = ?,
        typed_chars = typed_chars + ?, pasted_chars = pasted_chars + ?, active_ms = active_ms + ?, edit_events = edit_events + ?,
        updated_at = CURRENT_TIMESTAMP, status = CASE WHEN ? THEN 'submitted' ELSE status END, submitted_at = CASE WHEN ? AND submitted_at IS NULL THEN CURRENT_TIMESTAMP ELSE submitted_at END WHERE id = ?`)
      .run(f.went_wrong, f.caught_how, f.fix, str(b.link, 400) || e.link, str(b.agent, 80) || e.agent, /^\d{4}-\d{2}-\d{2}$/.test(b.sessionDate) ? b.sessionDate : e.session_date,
        typed, pasted, active, edits, submit ? 1 : 0, submit ? 1 : 0, e.id);
    if (typed || pasted || active || submit) q("INSERT INTO agent_log_saves (entry_id, total_chars, typed_delta, pasted_delta, active_delta_ms) VALUES (?, ?, ?, ?, ?)").run(e.id, total, typed, pasted, active);
  });
  return { entry: shapeLog(logRow(e.id), req.user.id) };
}));
app.delete("/api/agent-log/:id", auth, wrap((req) => {
  const e = logRow(Number(req.params.id)); if (e.author_id !== req.user.id) forbid("You can only delete your own entries.");
  if (e.status === "submitted") bad("Submitted entries stay in the log. Edit it instead.");
  q("DELETE FROM agent_log WHERE id = ?").run(e.id); return { ok: true };
}));
app.get("/api/agent-log-export.md", auth, wrap((req, res) => {
  const rows = q("SELECT * FROM agent_log WHERE status = 'submitted' ORDER BY session_date, id").all().map((e) => shapeLog(e, req.user.id));
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
  const stories = storyRows(inRange, [start.toISOString(), end.toISOString()], req.user.id, { sort: "top", limit: 1000 });
  const prev = q(`SELECT t.topic, COUNT(*) AS n FROM story_topics t JOIN stories s ON s.id = t.story_id WHERE ${inRange} GROUP BY t.topic`).all(prevStart.toISOString(), start.toISOString());
  const prevMap = Object.fromEntries(prev.map((r) => [r.topic, r.n]));
  const kinds = {}; stories.forEach((s) => new Set(s.sources.map((x) => x.kind)).forEach((k) => (kinds[k] = (kinds[k] || 0) + 1)));
  const v = await views();
  return { spec: v.weeklyBrief({ start, end, stories, topics: tagger.topicList(), prevCounts: prevMap, kinds }), week: start.toISOString().slice(0, 10) };
}));
app.get("/api/agent-log-view", auth, wrap(async (req) => {
  const rows = q("SELECT * FROM agent_log WHERE status = 'submitted' ORDER BY session_date").all().map((e) => shapeLog(e, req.user.id));
  return { spec: (await views()).agentLogSummary(rows) };
}));
app.get("/api/catalog", wrap(async () => { const { catalog } = await views(); return { components: Object.keys(catalog.data?.components ?? {}), prompt: catalog.prompt(), jsonSchema: catalog.jsonSchema() }; }));

/* ------------------------------------------------------------------ static */
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use("/api", (req, res) => res.status(404).json({ error: "Unknown API route." }));
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That's too big." });
  console.error(err); res.status(500).json({ error: "Something went wrong on the server." });
});

if (require.main === module) {
  seedSources();
  app.listen(PORT, () => console.log(`Superintelligence Homepage on http://localhost:${PORT}`));
  if (FETCH_MINUTES > 0) { fetchAll().then((r) => console.log("First fetch:", JSON.stringify(r.report || r))); setInterval(fetchAll, FETCH_MINUTES * 60e3).unref(); }
}
module.exports = { app, db, ingestItems, seedSources, fetchAll };
