// One async database API over two engines:
//   - Postgres when DATABASE_URL (or POSTGRES_URL, as Vercel/Neon set it) is present: production on Vercel.
//   - SQLite (Node's built-in node:sqlite) otherwise: local dev and tests, no setup.
// Queries are written once with `?` placeholders in portable SQL; the Postgres side numbers them ($1, $2, ...).
const path = require("node:path");
const fs = require("node:fs");

const PG_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const isPg = !!PG_URL;
const NOW_DEFAULT = isPg ? `(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))` : `(strftime('%Y-%m-%dT%H:%M:%SZ','now'))`;
const ID = isPg ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY";

function schema() {
  const T = NOW_DEFAULT;
  return `
CREATE TABLE IF NOT EXISTS users (id ${ID}, username TEXT NOT NULL, display_name TEXT NOT NULL, pass_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0, created_at TEXT DEFAULT ${T});
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower ON users (LOWER(username));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sources (id ${ID}, name TEXT NOT NULL, kind TEXT NOT NULL, format TEXT NOT NULL, url TEXT UNIQUE NOT NULL,
  home TEXT DEFAULT '', status TEXT DEFAULT 'active', suggested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, note TEXT DEFAULT '',
  last_fetched TEXT, last_ok TEXT, last_error TEXT, last_count INTEGER DEFAULT 0, created_at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS stories (id ${ID}, title TEXT NOT NULL, url TEXT NOT NULL, summary TEXT DEFAULT '', authors TEXT DEFAULT '',
  published_at TEXT, first_seen TEXT DEFAULT ${T}, topics TEXT DEFAULT '[]', orgs TEXT DEFAULT '[]', ext_score INTEGER DEFAULT 0,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS story_keys (key TEXT PRIMARY KEY, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS story_links (id ${ID}, story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL, url TEXT NOT NULL, title TEXT NOT NULL, published_at TEXT, seen_at TEXT DEFAULT ${T},
  UNIQUE (story_id, source_id, url));
CREATE TABLE IF NOT EXISTS story_topics (story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE, topic TEXT NOT NULL, PRIMARY KEY (story_id, topic));
CREATE TABLE IF NOT EXISTS votes (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${T}, PRIMARY KEY (user_id, story_id));
CREATE TABLE IF NOT EXISTS saves (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT ${T}, PRIMARY KEY (user_id, story_id));
CREATE TABLE IF NOT EXISTS notes (id ${ID}, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  text TEXT NOT NULL, private INTEGER DEFAULT 1, created_at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS lists (id ${ID}, owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT DEFAULT '',
  public INTEGER DEFAULT 1, created_at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS list_items (list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE, story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  note TEXT DEFAULT '', added_at TEXT DEFAULT ${T}, PRIMARY KEY (list_id, story_id));
CREATE TABLE IF NOT EXISTS follows (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE, PRIMARY KEY (user_id, list_id));
CREATE TABLE IF NOT EXISTS agent_log (id ${ID}, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_date TEXT NOT NULL,
  agent TEXT DEFAULT '', went_wrong TEXT DEFAULT '', caught_how TEXT DEFAULT '', fix TEXT DEFAULT '', link TEXT DEFAULT '', status TEXT DEFAULT 'draft',
  typed_chars INTEGER DEFAULT 0, pasted_chars INTEGER DEFAULT 0, active_ms BIGINT DEFAULT 0, edit_events INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ${T}, updated_at TEXT DEFAULT ${T}, submitted_at TEXT);
CREATE TABLE IF NOT EXISTS agent_log_saves (id ${ID}, entry_id INTEGER NOT NULL REFERENCES agent_log(id) ON DELETE CASCADE,
  at TEXT DEFAULT ${T}, total_chars INTEGER NOT NULL, typed_delta INTEGER DEFAULT 0, pasted_delta INTEGER DEFAULT 0, active_delta_ms BIGINT DEFAULT 0);
CREATE TABLE IF NOT EXISTS fetch_runs (id ${ID}, source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE, trigger TEXT DEFAULT 'cron',
  started_at TEXT, finished_at TEXT, status TEXT, items INTEGER DEFAULT 0, stored INTEGER DEFAULT 0, error TEXT, duration_ms INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS admin_audit (id ${ID}, admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, target TEXT DEFAULT '',
  detail TEXT DEFAULT '', at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS project_milestones (id ${ID}, name TEXT NOT NULL, description TEXT DEFAULT '', target_date TEXT, created_at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS project_issues (id ${ID}, number INTEGER UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo', priority INTEGER DEFAULT 0, assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, milestone_id INTEGER REFERENCES project_milestones(id) ON DELETE SET NULL,
  labels TEXT DEFAULT '[]', due_date TEXT, sort_order REAL DEFAULT 0, created_at TEXT DEFAULT ${T}, updated_at TEXT DEFAULT ${T}, completed_at TEXT);
CREATE TABLE IF NOT EXISTS project_comments (id ${ID}, issue_id INTEGER NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, body TEXT NOT NULL, created_at TEXT DEFAULT ${T});
CREATE TABLE IF NOT EXISTS project_activity (id ${ID}, issue_id INTEGER REFERENCES project_issues(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, detail TEXT DEFAULT '', at TEXT DEFAULT ${T});
CREATE INDEX IF NOT EXISTS idx_pact_issue ON project_activity(issue_id, id);
CREATE INDEX IF NOT EXISTS idx_runs_source ON fetch_runs(source_id, id);
CREATE INDEX IF NOT EXISTS idx_links_story ON story_links(story_id);
CREATE INDEX IF NOT EXISTS idx_topics_topic ON story_topics(topic);
CREATE INDEX IF NOT EXISTS idx_stories_seen ON stories(first_seen);
`;
}

// Portable SQL -> Postgres: numbered placeholders and INSERT OR IGNORE.
function toPg(sql) {
  let i = 0;
  let out = sql.replace(/\?/g, () => `$${++i}`);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(out)) out = out.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO") + " ON CONFLICT DO NOTHING";
  return out;
}

function makeSqlite() {
  const { DatabaseSync } = require("node:sqlite");
  const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  fs.mkdirSync(dir, { recursive: true });
  const raw = new DatabaseSync(path.join(dir, "si.db"));
  raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const api = {
    engine: "sqlite",
    async get(sql, ...a) { return raw.prepare(sql).get(...a); },
    async all(sql, ...a) { return raw.prepare(sql).all(...a); },
    async run(sql, ...a) { const r = raw.prepare(sql).run(...a); return { changes: Number(r.changes) }; },
    async insert(sql, ...a) { return Number(raw.prepare(sql).run(...a).lastInsertRowid); },
    async exec(sql) { raw.exec(sql); },
    async tx(fn) {
      // node:sqlite is synchronous, but callers await inside fn; serialize transactions so they can't interleave.
      const prev = api._chain || Promise.resolve();
      let release; api._chain = new Promise((r) => (release = r));
      await prev;
      raw.exec("BEGIN");
      try { const out = await fn(api); raw.exec("COMMIT"); return out; } catch (e) { raw.exec("ROLLBACK"); throw e; } finally { release(); }
    },
  };
  return api;
}

function makePg() {
  const pg = require("pg");
  pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // COUNT() and BIGINT come back as numbers, not strings
  // Free tier: keep the pool small and close idle connections fast, so Neon's compute can scale to zero between requests.
  const pool = new pg.Pool({ connectionString: PG_URL, max: Number(process.env.PG_POOL || (process.env.VERCEL ? 2 : 5)), idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 5000), allowExitOnIdle: true, ssl: /localhost|127\.0\.0\.1/.test(PG_URL) ? false : { rejectUnauthorized: false } });
  const wrapClient = (c) => ({
    engine: "pg",
    async get(sql, ...a) { return (await c.query(toPg(sql), a)).rows[0]; },
    async all(sql, ...a) { return (await c.query(toPg(sql), a)).rows; },
    async run(sql, ...a) { const r = await c.query(toPg(sql), a); return { changes: r.rowCount }; },
    async insert(sql, ...a) { return (await c.query(toPg(sql) + " RETURNING id", a)).rows[0].id; },
    async exec(sql) { await c.query(sql); },
  });
  const api = wrapClient(pool);
  api.tx = async (fn) => {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const out = await fn(wrapClient(client)); await client.query("COMMIT"); return out; }
    catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  };
  api.end = () => pool.end();
  return api;
}

// Columns added after the first release. Each is added on startup if missing, so existing databases upgrade in place.
const ADDED_COLUMNS = [
  ["sources", "interval_minutes", "INTEGER DEFAULT 360"],
  ["sources", "max_items", "INTEGER DEFAULT 50"],
  ["sources", "etag", "TEXT"],
  ["sources", "last_modified", "TEXT"],
  ["sources", "failures", "INTEGER DEFAULT 0"],
  ["sources", "next_due_at", "TEXT"],
  ["sources", "verified", "INTEGER DEFAULT 0"],
  ["sources", "from_catalog", "INTEGER DEFAULT 0"],
  ["users", "disabled", "INTEGER DEFAULT 0"],
  ["stories", "hidden", "INTEGER DEFAULT 0"],
  ["stories", "hidden_reason", "TEXT DEFAULT ''"],
];
async function migrate() {
  for (const [table, col, type] of ADDED_COLUMNS) {
    const cols = isPg
      ? (await db.all("SELECT column_name AS name FROM information_schema.columns WHERE table_name = ?", table)).map((r) => r.name)
      : (await db.all(`PRAGMA table_info(${table})`)).map((r) => r.name);
    if (!cols.includes(col)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  }
}

const db = isPg ? makePg() : makeSqlite();
let ready;
db.ready = () => (ready ||= db.exec(schema()).then(migrate).catch((e) => { ready = null; throw e; }));
// Bytes used by the database (Neon's free plan allows 1 GB per project).
db.sizeBytes = async () => isPg
  ? Number((await db.get("SELECT pg_database_size(current_database()) AS n")).n)
  : Number((await db.get("PRAGMA page_count")).page_count) * Number((await db.get("PRAGMA page_size")).page_size);
db.now = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
module.exports = db;
