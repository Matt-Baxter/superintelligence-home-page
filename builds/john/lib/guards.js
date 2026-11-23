// Security guards (specs/005-guards, REQ-057–062): sign-up bot checks, per-account sign-in lockout, per-member budgets on
// the routes that do real work, baseline response headers, an event tally, the preview sign-in emulator policy, and the
// settings a super admin can change from /m/admin#security.
//
// Settings are validated by one zod schema, stored per environment (local / preview / production never share a row,
// even when they share a database) and cached here for 30 s. Each guard takes the settings as an argument, so the
// admin page's live examples run this exact code against throwaway counters instead of a copy of the rules.
// Counters live in this instance's memory. On serverless each instance keeps its own, so they bound bursts per
// instance; they are not a global quota. Nothing here stores a password, a token or a full IP address.
const { z } = require("zod");

/* ---------------------------------------------------------------- settings */
const SettingsSchema = z.object({
  signupOpen: z.boolean(),
  botCheck: z.boolean(),
  minFillSeconds: z.number().min(0).max(30),
  lockout: z.boolean(),
  lockAfterFailures: z.number().int().min(3).max(50),
  lockMinutes: z.number().int().min(1).max(240),
  budgets: z.boolean(),
  budgetScale: z.number().min(0.25).max(4),
  emulator: z.boolean(),
}).strict();
const DEFAULTS = Object.freeze({ signupOpen: true, botCheck: true, minFillSeconds: 1.5, lockout: true, lockAfterFailures: 8, lockMinutes: 15, budgets: true, budgetScale: 1, emulator: true });

// What the admin page renders: the server owns the labels, ranges and grouping so the UI never drifts from the schema.
const FIELDS = [
  { group: "Sign-up", key: "signupOpen", kind: "flag", label: "Accept new accounts", help: "Off pauses sign-up for everyone. The very first account can always be created." },
  { group: "Sign-up", key: "botCheck", kind: "flag", label: "Bot check on the sign-up form", help: "A hidden field people never see, plus a minimum time to fill the form." },
  { group: "Sign-up", key: "minFillSeconds", kind: "number", label: "Minimum seconds to fill the form", min: 0, max: 30, step: 0.5, needs: "botCheck" },
  { group: "Sign-in", key: "lockout", kind: "flag", label: "Lock an account after repeated wrong passwords", help: "Counted per account, so spreading guesses across many addresses doesn't help." },
  { group: "Sign-in", key: "lockAfterFailures", kind: "number", label: "Wrong passwords before the lock", min: 3, max: 50, step: 1, needs: "lockout" },
  { group: "Sign-in", key: "lockMinutes", kind: "number", label: "Lock length in minutes", min: 1, max: 240, step: 1, needs: "lockout" },
  { group: "Work limits", key: "budgets", kind: "flag", label: "Per-member limits on routes that do work", help: "Claim checks, paper fetches, uploads, lab runs and writes. Admins are exempt." },
  { group: "Work limits", key: "budgetScale", kind: "number", label: "Scale every limit by", min: 0.25, max: 4, step: 0.25, needs: "budgets" },
  { group: "Test sign-in", key: "emulator", kind: "flag", label: "One-click test sign-in buttons", help: "Only where the environment allows it. Never in production, whatever this says." },
];

let current = { ...DEFAULTS }, meta = { source: "defaults", updatedAt: null, updatedBy: null }, loadedAt = 0;
const settings = () => current;
const scopeOf = (env = process.env) => env.VERCEL_ENV || (env.VERCEL ? "vercel" : "local");
const STALE_MS = 30000;

// Accepts a partial patch, merges it over `base` and returns { ok, value } or { ok: false, error } in plain words.
function validate(patch, base = DEFAULTS) {
  const r = SettingsSchema.safeParse({ ...base, ...(patch && typeof patch === "object" ? patch : {}) });
  if (r.success) return { ok: true, value: r.data };
  const i = r.error.issues[0], f = FIELDS.find((x) => x.key === i.path[0]);
  return { ok: false, error: f ? `${f.label}: ${f.kind === "number" ? `use a number from ${f.min} to ${f.max}` : "use on or off"}.` : `Unknown setting "${i.path[0] ?? i.keys?.[0] ?? "?"}".` };
}
const diff = (s, base = DEFAULTS) => Object.fromEntries(Object.keys(base).filter((k) => s[k] !== base[k]).map((k) => [k, s[k]]));

async function refresh(db, { force = false, env = process.env } = {}) {
  if (!force && Date.now() - loadedAt < STALE_MS) return current;
  loadedAt = Date.now();
  try {
    const r = await db.get("SELECT settings, updated_by, updated_at FROM guard_settings WHERE scope = ?", scopeOf(env));
    const v = r ? validate(JSON.parse(r.settings)) : { ok: true, value: { ...DEFAULTS } };
    // A bad stored row falls back to the defaults, which are the strict ones.
    current = v.ok ? v.value : { ...DEFAULTS };
    meta = r && v.ok ? { source: "saved", updatedAt: r.updated_at, updatedBy: r.updated_by } : { source: "defaults", updatedAt: null, updatedBy: null };
  } catch { /* table not ready or DB blip: keep the last good settings */ }
  return current;
}
async function save(db, patch, adminId, env = process.env) {
  const v = validate(patch, current); if (!v.ok) return v;
  const changed = diff(v.value, current), stored = diff(v.value), at = new Date().toISOString();
  await db.tx(async (t) => {
    await t.run("DELETE FROM guard_settings WHERE scope = ?", scopeOf(env));
    if (Object.keys(stored).length) await t.run("INSERT INTO guard_settings (scope, settings, updated_by, updated_at) VALUES (?, ?, ?, ?)", scopeOf(env), JSON.stringify(stored), adminId, at);
  });
  current = v.value; loadedAt = Date.now();
  meta = Object.keys(stored).length ? { source: "saved", updatedAt: at, updatedBy: adminId } : { source: "defaults", updatedAt: null, updatedBy: null };
  return { ok: true, value: v.value, changed };
}

/* ------------------------------------------------------------------ events */
const EVENTS = new Map();
function note(kind) {
  const e = EVENTS.get(kind) || { count: 0, last: null };
  e.count += 1; e.last = new Date().toISOString(); EVENTS.set(kind, e);
}
const events = () => Object.fromEntries([...EVENTS].sort((a, b) => b[1].count - a[1].count));

// Sliding-window counter keyed by any string. Bounded so a flood of distinct keys can't grow memory without limit.
function windowCounter(max = 10000) {
  const m = new Map();
  return {
    count(key, ms, t = Date.now()) { const l = (m.get(key) || []).filter((x) => t - x < ms); m.set(key, l); return l.length; },
    add(key, ms, t = Date.now()) { const l = (m.get(key) || []).filter((x) => t - x < ms); l.push(t); if (m.size > max) m.clear(); m.set(key, l); return l.length; },
    clear(key) { m.delete(key); },
  };
}

/* ------------------------------------------------- sign-up bot check (REQ-057) */
const MIN_FILL_MS = DEFAULTS.minFillSeconds * 1000;
function botCheck(body = {}, t = Date.now(), s = current) {
  if (!s.botCheck) return null;
  if (typeof body.website === "string" && body.website.trim()) return "honeypot";
  const started = Number(body.startedAt);
  // Only judged when the form sent it: API clients and tests that omit it still face the per-IP limits.
  if (Number.isFinite(started) && started > 0 && t - started < s.minFillSeconds * 1000) return "too-fast";
  return null;
}

// The form's start time comes from the server, signed, never from the browser clock: a skewed device would otherwise
// be refused, and a bot could simply send an old timestamp. A token from another instance (different random secret)
// or a forged one reads as NaN, so only the honeypot judges it.
const crypto = require("crypto");
const FORM_SECRET = process.env.GUARD_SECRET || process.env.CRON_SECRET || crypto.randomBytes(32).toString("hex");
const FORM_TOKEN_MAX_AGE_MS = 24 * 36e5;
const signTs = (ts) => crypto.createHmac("sha256", FORM_SECRET).update("signup-form:" + ts).digest("base64url");
function formToken(t = Date.now()) { return `${t}.${signTs(t)}`; }
function readFormToken(token, t = Date.now()) {
  const [tsText, sig] = String(token || "").split(".");
  const ts = Number(tsText);
  if (!Number.isFinite(ts) || !sig || ts > t || t - ts > FORM_TOKEN_MAX_AGE_MS) return NaN;
  const want = Buffer.from(signTs(ts)), got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? ts : NaN;
}
// Outside local, a missing or forged token is refused, else a bot just leaves it out. That needs a secret every
// instance shares; with a per-instance random one, a token from another instance would turn real people away.
const SHARED_FORM_SECRET = !!(process.env.GUARD_SECRET || process.env.CRON_SECRET);
function signupBotCheck(body = {}, t = Date.now(), s = current, env = process.env, shared = SHARED_FORM_SECRET) {
  const startedAt = readFormToken(body.formToken, t);
  const verdict = botCheck({ website: body.website, startedAt }, t, s);
  if (verdict) return verdict;
  if (s.botCheck && shared && scopeOf(env) !== "local" && Number.isNaN(startedAt)) return "no-token";
  return null;
}

/* ------------------------------------------- sign-in lockout per account (REQ-058) */
const LOCK_FAILS = DEFAULTS.lockAfterFailures, LOCK_KEEP_MS = 240 * 6e4;
const lockKey = (username) => String(username || "").toLowerCase();
function lockout(counter = windowCounter()) {
  return {
    isLocked: (username, t = Date.now(), s = current) => s.lockout && counter.count(lockKey(username), s.lockMinutes * 6e4, t) >= s.lockAfterFailures,
    failed: (username, t = Date.now()) => counter.add(lockKey(username), LOCK_KEEP_MS, t),
    clear: (username) => counter.clear(lockKey(username)),
  };
}
const liveLock = lockout();
const isLocked = (username, t, s) => liveLock.isLocked(username, t, s);
const loginFailed = (username, t) => liveLock.failed(username, t);
const loginSucceeded = (username) => liveLock.clear(username);

/* --------------------------------------------------- work budgets (REQ-059) */
// Keyed by member id, or by IP for guests (who are refused by `auth` on every one of these anyway).
// Admins are exempt: every job and model run is already admin-only, and none is reachable by guests.
const BUDGETS = [
  { id: "claim-check", label: "Claim checks", method: "POST", re: /^\/api\/review\/(check|stress)$/, n: 60, ms: 10 * 6e4 },
  { id: "arxiv-fetch", label: "Paper fetches", method: "POST", re: /^\/api\/review\/arxiv$/, n: 10, ms: 10 * 6e4 },
  { id: "doc-upload", label: "Document uploads", method: "POST", re: /^\/api\/review\/docs$/, n: 20, ms: 60 * 6e4 },
  { id: "lab-run", label: "Lab runs", method: "POST", re: /^\/api\/lab\//, n: 30, ms: 10 * 6e4 },
  { id: "knowledge-rpc", label: "Knowledge queries", method: "POST", re: /^\/api\/knowledge\/rpc$/, n: 120, ms: 6e4 },
  { id: "teardown", label: "Paper teardowns", method: "POST", re: /^\/api\/learn\/teardown$/, n: 30, ms: 10 * 6e4 },
  { id: "ui-validate", label: "UI validations", method: "POST", re: /^\/api\/ui\/validate$/, n: 60, ms: 6e4 },
  { id: "member-writes", label: "Any other change", method: "WRITE", re: /^\/api\/(?!admin\/|cron\/|login$|logout$|signup$|emulate$)/, n: 600, ms: 10 * 6e4 },
];
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const matches = (b, req) => (b.method === "WRITE" ? WRITE.has(req.method) : req.method === b.method) && b.re.test(req.path);
const budgetLimit = (b, s = current) => Math.max(1, Math.round(b.n * s.budgetScale));
function makeBudgets(counter, getSettings, onBlock = note) {
  return (req, res, next) => {
    const s = getSettings();
    if (!s.budgets || req.user?.admin) return next();
    const who = req.user ? `u:${req.user.id}` : `ip:${req.ip}`, t = req.now ?? Date.now();
    for (const b of BUDGETS) {
      if (!matches(b, req)) continue;
      if (counter.count(`${b.id}|${who}`, b.ms, t) >= budgetLimit(b, s)) {
        onBlock(`budget:${b.id}`);
        res.set("Retry-After", String(Math.ceil(b.ms / 1000)));
        return res.status(429).json({ error: "You've reached the limit for this for now. Wait a few minutes and try again." });
      }
      counter.add(`${b.id}|${who}`, b.ms, t);
    }
    next();
  };
}
const budgets = makeBudgets(windowCounter(20000), settings);

/* ------------------------------------------------------- response headers */
// Always on, not a setting. No CSP yet: the pages use inline scripts, so a policy needs nonces first.
function headers(env = process.env) {
  const https = env.NODE_ENV === "production" || !!env.VERCEL;
  return (req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("X-Frame-Options", "SAMEORIGIN");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (https) res.set("Strict-Transport-Security", "max-age=63072000");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", res.get("Cache-Control") || "no-store");
    next();
  };
}

/* ------------------------------------------- preview sign-in emulator (REQ-060) */
// The environment decides where it MAY run; the `emulator` setting can only switch it off inside that.
// Off in production, always. On a Vercel preview it needs EMULATOR=1 because previews can share the production
// database. On a local machine it is on unless EMULATOR=0. Any other deployment (Docker, an unknown host) is off.
const EMULATOR_ROLES = { admin: { username: "emulator.admin", admin: true }, reader: { username: "emulator.reader", admin: false } };
const EMULATOR_PREFIX = "emulator.";
const EMULATOR_HOURS = 2;
function emulatorMode(env = process.env) {
  if (env.EMULATOR === "0") return null;
  if (env.VERCEL_ENV === "production") return null;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return env.EMULATOR === "1" ? "preview" : null;
  if (env.VERCEL || env.NODE_ENV === "production") return null;
  return "local";
}
const emulatorOn = (env = process.env, s = current) => (s.emulator ? emulatorMode(env) : null);
const isReservedUsername = (u) => String(u || "").toLowerCase().startsWith(EMULATOR_PREFIX);

/* ------------------------------------------------- admin and super admin (REQ-061) */
const names = (v) => String(v || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
// Who becomes admin on sign-up. With ADMIN_USERNAMES set, only those names; otherwise the first account.
function adminOnSignup(username, isFirst, env = process.env) {
  const list = names(env.ADMIN_USERNAMES);
  return list.length ? list.includes(String(username).toLowerCase()) : isFirst;
}
// Who may change these settings. With SUPER_ADMIN_USERNAMES set, only those admins; otherwise the oldest admin account.
// The emulator's test admin counts only while the emulator is on, so testers can try this page on a preview.
function isSuperAdmin(user, oldestAdminId, env = process.env, s = current) {
  if (!user?.admin) return false;
  const u = String(user.username || "").toLowerCase();
  if (u === EMULATOR_ROLES.admin.username) return !!emulatorOn(env, s);
  const list = names(env.SUPER_ADMIN_USERNAMES);
  return list.length ? list.includes(u) : user.id === oldestAdminId;
}

/* ------------------------------------------------ live examples (REQ-062) */
// Each example replays a realistic attempt through the real guard functions, with fresh counters, under `s`.
function simulate(s = current, env = process.env) {
  const t0 = Date.UTC(2026, 0, 1), out = [];
  const add = (id, area, scenario, blocked, outcome) => out.push({ id, area, scenario, blocked, outcome });

  const signup = (body, at) => (!s.signupOpen ? "paused" : botCheck(body, at, s));
  const say = (r) => ({ paused: "Refused: sign-ups are paused", honeypot: "Refused: the hidden field was filled", "too-fast": "Refused: filled faster than a person can" }[r] || "Account created");
  for (const [id, scenario, body] of [
    ["signup-person", "A person fills in the sign-up form in 6 seconds", { startedAt: t0 - 6000 }],
    ["signup-script", "A script submits the sign-up form 0.4 seconds after the page loads", { startedAt: t0 - 400 }],
    ["signup-honeypot", "A bot fills in every field, including the hidden one", { startedAt: t0 - 6000, website: "spam.example" }],
  ]) { const r = signup(body, t0); add(id, "Sign-up", scenario, !!r, say(r)); }

  const lock = lockout(), who = "sample.reader";
  let lockedAt = 0;
  for (let i = 1; i <= 12 && !lockedAt; i++) { const at = t0 + i * 30000; if (lock.isLocked(who, at, s)) lockedAt = i; else lock.failed(who, at); }
  add("login-guess", "Sign-in", "Someone tries 12 wrong passwords on one account in 6 minutes", !!lockedAt,
    lockedAt ? `Locked at attempt ${lockedAt}, for ${s.lockMinutes} min` : "Never locked: every guess gets an answer (the per-address limit of 30 per 10 min still applies)");
  const later = t0 + 6 * 6e4 + 20 * 6e4;
  add("login-later", "Sign-in", "The same account is tried again 20 minutes later", !!lockedAt && lock.isLocked(who, later, s),
    !lockedAt ? "Answered normally" : lock.isLocked(who, later, s) ? "Still locked" : "Lock has expired, the guess is answered");

  for (const [id, path, tries, minutes, scenario] of [
    ["budget-claims", "/api/review/check", 100, 10, "A member runs 100 claim checks in 10 minutes"],
    ["budget-uploads", "/api/review/docs", 30, 60, "A member uploads 30 documents in an hour"],
  ]) {
    let blockedAt = 0;
    const mw = makeBudgets(windowCounter(), () => s, () => {});
    for (let i = 1; i <= tries && !blockedAt; i++) {
      let stopped = false;
      const res = { set() { return res; }, status() { stopped = true; return res; }, json() { return res; } };
      mw({ method: "POST", path, user: { id: 1, admin: false }, ip: "sample", now: t0 + Math.floor((i * minutes * 6e4) / (tries + 1)) }, res, () => {});
      if (stopped) blockedAt = i;
    }
    add(id, "Work limits", scenario, !!blockedAt, blockedAt ? `Stopped after ${blockedAt - 1}; the rest wait` : `All ${tries} run`);
  }

  const mode = emulatorMode(env), on = emulatorOn(env, s);
  add("emulator", "Test sign-in", "A visitor opens the sign-in page", !on,
    on ? `Shows "Test admin" and "Test reader" buttons (${mode})` : !mode ? "No test buttons: this environment never allows them" : "No test buttons: switched off here");
  return out;
}

function describe(env = process.env) {
  return {
    scope: scopeOf(env),
    settings: current, defaults: DEFAULTS, fields: FIELDS, saved: meta,
    environment: { emulatorAllowed: emulatorMode(env) || "never", superAdminRule: env.SUPER_ADMIN_USERNAMES ? "SUPER_ADMIN_USERNAMES" : "oldest admin account", adminRule: env.ADMIN_USERNAMES ? "ADMIN_USERNAMES" : "first account" },
    budgets: BUDGETS.map((b) => ({ id: b.id, label: b.label, limit: budgetLimit(b), windowMinutes: b.ms / 6e4 })),
    alwaysOn: ["Security headers on every response", "Sign-up and sign-in: 30 attempts per address per 10 minutes", "Guests can't reach any route that runs a model or a job", "Every model run and job is admin-only"],
    events: events(), counters: "per instance",
    examples: simulate(current, env),
  };
}

module.exports = { SettingsSchema, DEFAULTS, FIELDS, settings, validate, diff, refresh, save, scopeOf,
  note, events, windowCounter, botCheck, MIN_FILL_MS, formToken, readFormToken, signupBotCheck, lockout, isLocked, loginFailed, loginSucceeded, LOCK_FAILS,
  BUDGETS, budgetLimit, makeBudgets, budgets, headers,
  emulatorMode, emulatorOn, EMULATOR_ROLES, EMULATOR_HOURS, isReservedUsername, adminOnSignup, isSuperAdmin, simulate, describe };
