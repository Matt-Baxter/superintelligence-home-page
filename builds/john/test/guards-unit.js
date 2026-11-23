// Guards (specs/005-guards, REQ-057..062): pure checks, no server, no database.
const G = require("../lib/guards");
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL " + msg); } };
const D = G.DEFAULTS, t = Date.UTC(2026, 0, 1);

// Settings schema (REQ-061)
ok(G.validate({}).ok && G.validate({}).value.lockAfterFailures === 8, "empty patch gives the defaults");
ok(!G.validate({ lockAfterFailures: 1 }).ok && /from 3 to 50/.test(G.validate({ lockAfterFailures: 1 }).error), "out-of-range number refused in plain words");
ok(!G.validate({ emulator: "yes" }).ok, "flag must be a boolean");
ok(!G.validate({ isAdmin: true }).ok && /Unknown setting/.test(G.validate({ isAdmin: true }).error), "unknown keys refused (strict)");
ok(G.FIELDS.every((f) => f.key in D), "every UI field is a schema key");
ok(JSON.stringify(G.diff({ ...D, lockMinutes: 30 })) === '{"lockMinutes":30}', "diff shows only what changed");
ok(G.scopeOf({}) === "local" && G.scopeOf({ VERCEL_ENV: "preview" }) === "preview" && G.scopeOf({ VERCEL_ENV: "production" }) === "production", "settings scoped per environment");

// Bot check (REQ-057)
ok(G.botCheck({ website: "http://spam" }, t, D) === "honeypot", "filled hidden field refused");
ok(G.botCheck({ startedAt: t - 400 }, t, D) === "too-fast", "script-speed form refused");
ok(G.botCheck({ startedAt: t - 6000 }, t, D) === null, "person-speed form accepted");
ok(G.botCheck({ startedAt: t - 400 }, t, { ...D, botCheck: false }) === null, "bot check can be switched off");
{ const tok = G.formToken(t - 5000);
  ok(G.readFormToken(tok, t) === t - 5000, "signed form token returns the server's start time");
  ok(Number.isNaN(G.readFormToken(tok.replace(/.$/, c => c === "A" ? "B" : "A"), t)), "tampered form token is rejected");
  ok(Number.isNaN(G.readFormToken(`${t - 999999}.forged`, t)), "forged form token is rejected");
  ok(Number.isNaN(G.readFormToken(G.formToken(t + 60000), t)), "a token from the future is rejected");
  ok(Number.isNaN(G.readFormToken(G.formToken(t - 25 * 36e5), t)), "a day-old token is rejected");
  ok(G.botCheck({ startedAt: G.readFormToken(G.formToken(t - 400), t) }, t, D) === "too-fast", "fast submit is refused on the server clock");
  const prod = { VERCEL: "1", VERCEL_ENV: "production" };
  ok(G.signupBotCheck({}, t, D, prod, true) === "no-token", "on Vercel a sign-up with no form token is refused");
  ok(G.signupBotCheck({ formToken: `${t - 9e5}.forged` }, t, D, prod, true) === "no-token", "on Vercel a forged form token is refused");
  ok(G.signupBotCheck({ formToken: tok }, t, D, prod, true) === null, "on Vercel a valid, human-paced token is accepted");
  ok(G.signupBotCheck({}, t, D, prod, false) === null, "without a shared secret a missing token falls back to the honeypot");
  ok(G.signupBotCheck({}, t, D, {}, true) === null, "locally an API sign-up without a token still works for tests");
  ok(G.signupBotCheck({}, t, { ...D, botCheck: false }, prod, true) === null, "switching the bot check off also drops the token rule"); }

// Lockout per account (REQ-058)
const lock = G.lockout();
for (let i = 0; i < 7; i++) lock.failed("Reader", t);
ok(!lock.isLocked("reader", t, D), "seven wrong passwords: not locked");
lock.failed("READER", t);
ok(lock.isLocked("reader", t, D), "eighth wrong password locks, whatever the case of the name");
ok(!lock.isLocked("reader", t + 16 * 6e4, D), "lock ends after the configured minutes");
ok(!lock.isLocked("reader", t, { ...D, lockout: false }), "lockout can be switched off");
lock.clear("reader");
ok(!lock.isLocked("reader", t, D), "an unlock clears the count");

// Work budgets (REQ-059)
const run = (mw, req) => { let code = 200; const res = { set() {}, status(c) { code = c; return { json() {} }; } }; let next = false; mw(req, res, () => { next = true; }); return next ? 200 : code; };
ok(G.BUDGETS.length >= 5 && G.BUDGETS.every((x) => x.n > 0 && x.ms > 0 && x.re instanceof RegExp), "every budget has a limit, a window and a route pattern");
ok(G.budgetLimit({ n: 10 }, { ...D, budgetScale: 0.25 }) === 3 && G.budgetLimit({ n: 1 }, { ...D, budgetScale: 0.25 }) === 1, "scale rounds and never drops below one");
const samplePath = (re) => { for (const p of ["/api/claims/check", "/api/papers/fetch", "/api/uploads", "/api/lab/run", "/api/knowledge/query", "/api/teardown", "/api/ui/validate", "/api/notes"]) if (re.test(p)) return p; return null; };
const bud = G.BUDGETS.find((x) => samplePath(x.re));
if (bud) {
  const mw = G.makeBudgets(G.windowCounter(), () => D, () => {});
  const req = { method: bud.method === "WRITE" ? "POST" : bud.method, path: samplePath(bud.re), user: { id: 7 }, now: t };
  const codes = Array.from({ length: bud.n + 1 }, () => run(mw, { ...req }));
  ok(codes.slice(0, bud.n).every((c) => c === 200) && codes[bud.n] === 429, `member over the ${bud.id} budget gets 429`);
  ok(run(mw, { ...req, user: { id: 7, admin: true } }) === 200, "admins are not limited");
  ok(run(G.makeBudgets(G.windowCounter(), () => ({ ...D, budgets: false }), () => {}), { ...req }) === 200, "budgets can be switched off");
} else ok(false, "no budget matched a sample work route");

// Test sign-in (REQ-060)
ok(G.emulatorMode({ VERCEL_ENV: "production", EMULATOR: "1" }) === null, "never in production, even with EMULATOR=1");
ok(G.emulatorMode({ VERCEL_ENV: "preview" }) === null && G.emulatorMode({ VERCEL_ENV: "preview", EMULATOR: "1" }) === "preview", "a preview needs EMULATOR=1");
ok(G.emulatorMode({}) === "local" && G.emulatorMode({ EMULATOR: "0" }) === null, "local by default, EMULATOR=0 turns it off");
ok(G.emulatorMode({ NODE_ENV: "production" }) === null && G.emulatorMode({ VERCEL: "1" }) === null, "unknown hosted environments stay off");
ok(G.emulatorOn({}, { ...D, emulator: false }) === null, "the setting can switch it off where allowed");
ok(G.isReservedUsername("Emulator.Admin") && !G.isReservedUsername("emu"), "test names are reserved");

// Super admin (REQ-061)
const admin = { id: 1, admin: true, username: "john" }, other = { id: 2, admin: true, username: "matt" };
ok(G.isSuperAdmin(admin, 1, {}) && !G.isSuperAdmin(other, 1, {}), "oldest admin is the super admin by default");
ok(!G.isSuperAdmin({ id: 1, admin: false, username: "john" }, 1, {}), "a non-admin is never super admin");
ok(G.isSuperAdmin(other, 1, { SUPER_ADMIN_USERNAMES: "Matt" }) && !G.isSuperAdmin(admin, 1, { SUPER_ADMIN_USERNAMES: "matt" }), "SUPER_ADMIN_USERNAMES overrides");
const emu = { id: 9, admin: true, username: "emulator.admin" };
ok(G.isSuperAdmin(emu, 1, {}, D) && !G.isSuperAdmin(emu, 1, { VERCEL_ENV: "production" }, D), "test admin is super admin only where the test sign-in runs");

// Live examples (REQ-062)
const base = G.simulate(D, {}), byId = (xs) => Object.fromEntries(xs.map((x) => [x.id, x]));
const e = byId(base);
ok(e["signup-person"] && !e["signup-person"].blocked && e["signup-script"].blocked, "examples: person passes, script refused");
const paused = byId(G.simulate({ ...D, signupOpen: false }, {}));
ok(paused["signup-person"].blocked, "pausing sign-up changes the person example");
const noBot = byId(G.simulate({ ...D, botCheck: false }, {}));
ok(!noBot["signup-script"].blocked, "turning off the bot check lets the script example through");
ok(base.every((x) => x.id && x.area && x.scenario && typeof x.blocked === "boolean" && x.outcome), "every example has an id, area, scenario and outcome");

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
