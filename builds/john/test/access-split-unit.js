// Guard: basics stay public (cheap, cached, rate-limited reads) and agent traces stay behind sign-in.
// Reads the route source so a change of middleware on any listed route fails CI, and an unlisted GET fails too.
const fs = require("node:fs"), path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../modules/review/routes.js"), "utf8");
let failed = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) failed++; };

const PUBLIC = ["/api/review/docs", "/api/review/outlets", "/api/review/events", "/api/review/metrics", "/api/review/dossier/:topic", "/api/review/evidence-index", "/api/review/map"];
const SIGNED_IN = ["/api/review/docs/:id", "/api/review/spotchecks", "/api/review/samples"];
const OWN_AUTH = ["/api/cron/spotcheck", "/api/review/dossier/:topic/storyboard"];

const gets = {};
for (const m of src.matchAll(/app\.get\("([^"]+)",\s*([^w][^,]*?,\s*)?wrap/g)) gets[m[1]] = (m[2] || "").trim();

for (const r of PUBLIC) ok(/^\.\.\.open\(/.test(gets[r] || ""), `public, cached and rate-limited: GET ${r}`);
for (const r of SIGNED_IN) ok(/^auth\b/.test(gets[r] || ""), `needs an account (agent trace): GET ${r}`);
ok(/CRON_SECRET/.test(src.slice(src.indexOf('"/api/cron/spotcheck"'), src.indexOf('"/api/cron/spotcheck"') + 300)), "the spot-check run is guarded by CRON_SECRET");
const known = new Set([...PUBLIC, ...SIGNED_IN, ...OWN_AUTH]);
for (const r of Object.keys(gets)) ok(known.has(r), `GET ${r} is classified as public or signed-in`);
for (const m of src.matchAll(/app\.post\("([^"]+)",\s*([^,]+),/g)) ok(m[2].trim() === "auth", `writes need an account: POST ${m[1]}`);

if (failed) { console.error(`${failed} failed`); process.exit(1); }
console.log("access split: all checks passed");
