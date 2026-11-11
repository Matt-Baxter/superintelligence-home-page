// Claims (REQ-069, proposed): who is working on what, as leases that run out on their own. A person or an agent claims
// a task (and the files it will touch) before starting; a claim that collides with someone else's is refused with the
// reason, unless a person forces it. Soft claims are presence (someone has a builder page open) and never refuse.
// The live claims are also written to out/work/claims.json so the agent kit's guard hook can check an edit without a
// database (best-effort; a deployment's read-only disk just skips it).
const fs = require("node:fs"), path = require("node:path");
const O = require("./overlap");
const ROOT = path.join(__dirname, "..", "..");
const OUT = process.env.WORK_OUT || path.join(ROOT, "out", "work"); // tests point this elsewhere
const LEASE = { agent: 120, person: 24 * 60, soft: 15 }, MAX_MIN = 72 * 60, KEEP_DAYS = 30;
const SQL = `
CREATE TABLE IF NOT EXISTS work_claims (id \${ID}, task TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'agent', user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  files TEXT DEFAULT '[]', branch TEXT DEFAULT '', intent TEXT DEFAULT '', asked_by TEXT DEFAULT '', soft INTEGER DEFAULT 0, forced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT \${T}, expires_at TEXT NOT NULL, released_at TEXT);
CREATE INDEX IF NOT EXISTS idx_work_claims_live ON work_claims (released_at, expires_at);
CREATE TABLE IF NOT EXISTS work_advice (finding TEXT PRIMARY KEY, state TEXT NOT NULL, note TEXT DEFAULT '', actor TEXT DEFAULT '', at TEXT DEFAULT \${T});`;

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const row = (r) => ({ ...r, files: JSON.parse(r.files || "[]"), soft: !!r.soft, forced: !!r.forced });
const live = async (db, now = Date.now()) => (await db.all("SELECT * FROM work_claims WHERE released_at IS NULL AND expires_at > ? ORDER BY created_at, id", iso(now))).map(row);

function readBranches() { try { return JSON.parse(fs.readFileSync(path.join(OUT, "branches.json"), "utf8")); } catch { return { at: null, branches: [] }; } }
async function writeCache(db) {
  try { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "claims.json"), JSON.stringify({ about: "Live work claims, written by modules/work on every change; read by agent-kit/hooks/guard.js. Generated; don't edit.", at: iso(Date.now()), claims: await live(db) }, null, 1)); } catch {}
}

class Conflict extends Error { constructor(msg, detail) { super(msg); this.status = 409; this.detail = detail; } }

// claim({ task, files, actor, kind, intent, branch, minutes, soft, force, askedBy, userId }, { items, branches })
async function claim(db, i, { items = [], branches = [], now = Date.now() } = {}) {
  const kind = i.kind === "person" ? "person" : "agent";
  const minutes = Math.min(MAX_MIN, Math.max(1, Number(i.minutes) || (i.soft ? LEASE.soft : LEASE[kind])));
  return db.tx(async (t) => {
    if (t.engine === "pg") await t.get("SELECT pg_advisory_xact_lock(6068069)"); // one claim at a time, so two can't both pass the check
    await t.run("DELETE FROM work_claims WHERE (released_at IS NOT NULL OR expires_at < ?) AND created_at < ?", iso(now), iso(now - KEEP_DAYS * 864e5)); // stay small
    const claims = await live(t, now), mine = claims.find((c) => c.actor === i.actor && c.task === i.task && c.soft === !!i.soft);
    const c = i.soft ? { ok: true, hard: [], warn: O.check({ task: i.task, actor: i.actor, kind }, { claims, items }).warn.filter((w) => w.type === "presence"), files: [] }
      : O.check({ task: i.task, files: i.files || [], actor: i.actor, kind, askedBy: i.askedBy }, { claims, branches: branches.branches || branches, items, myBranch: i.branch || "" });
    const forced = !c.ok && i.force && kind === "person" && !c.hard.some((h) => h.type === "not-eligible");
    if (!c.ok && !forced) throw new Conflict(`Can't claim ${i.task}: ${c.hard.map((h) => h.why).join(" ")}`, c);
    const expires = iso(now + minutes * 60e3);
    let id;
    if (mine) { await t.run("UPDATE work_claims SET expires_at = ?, files = ?, intent = ? WHERE id = ?", expires, JSON.stringify(c.files.length ? c.files : mine.files), i.intent || mine.intent, mine.id); id = mine.id; }
    else id = await t.insert("INSERT INTO work_claims (task, actor, kind, user_id, files, branch, intent, asked_by, soft, forced, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      i.task, i.actor, kind, i.userId || null, JSON.stringify(c.files), i.branch || "", String(i.intent || "").slice(0, 300), i.askedBy || "", i.soft ? 1 : 0, forced ? 1 : 0, iso(now), expires);
    return { id, task: i.task, actor: i.actor, expires_at: expires, renewed: !!mine, forced, warnings: c.warn, overridden: forced ? c.hard : [] };
  }).then(async (r) => { await writeCache(db); return r; });
}

async function release(db, { id, task, actor, admin = false }) {
  const where = id ? ["id = ?", id] : ["task = ? AND actor = ?", task, actor];
  const rows = await db.all(`SELECT * FROM work_claims WHERE released_at IS NULL AND ${where[0]}`, ...where.slice(1));
  const mine = rows.filter((r) => admin || r.actor === actor);
  if (rows.length && !mine.length) throw Object.assign(new Error("That claim is someone else's; only they or an admin can release it."), { status: 403 });
  for (const r of mine) await db.run("UPDATE work_claims SET released_at = ? WHERE id = ?", iso(Date.now()), r.id);
  await writeCache(db);
  return { released: mine.length };
}

const marks = async (db) => new Map((await db.all("SELECT finding, state, note, actor, at FROM work_advice")).map((r) => [r.finding, r]));
async function mark(db, { finding, state, note = "", actor = "" }) {
  if (state === "open") { await db.run("DELETE FROM work_advice WHERE finding = ?", finding); return { finding, state }; }
  const n = await db.run("UPDATE work_advice SET state = ?, note = ?, actor = ?, at = ? WHERE finding = ?", state, note, actor, iso(Date.now()), finding);
  if (!n.changes) await db.run("INSERT INTO work_advice (finding, state, note, actor, at) VALUES (?, ?, ?, ?, ?)", finding, state, note, actor, iso(Date.now()));
  return { finding, state };
}

module.exports = { SQL, LEASE, live, claim, release, readBranches, writeCache, marks, mark, Conflict, iso };
