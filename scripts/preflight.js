#!/usr/bin/env node
// Cheap checks before you push (~10 s): syntax, JSON, bundle build, secrets, no-Twitter rule,
// a contract reminder, and an API smoke test on synthetic data. No browser, no network.
// Run: npm run preflight     (also runs on git push once hooks are installed, and in GitHub Actions)
const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const results = [];
const ok = (name, detail = "") => results.push({ ok: true, name, detail });
const fail = (name, detail = "") => results.push({ ok: false, name, detail });
const warn = (name, detail = "") => results.push({ ok: true, warn: true, name, detail });
const sh = (cmd) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString();
const tracked = () => { try { return sh("git ls-files").split("\n").filter(Boolean); } catch { return []; } };

// 1. Syntax of every JS/MJS file we own
const files = tracked().filter((f) => /\.(m?js)$/.test(f) && !f.startsWith("public/js/jr.js") && !f.startsWith("node_modules/"));
const bad = [];
for (const f of files) { try { sh(`node --check "${f}"`); } catch (e) { bad.push(`${f}: ${String(e.stderr || e.message).split("\n").find((l) => /Error/.test(l)) || "syntax error"}`); } }
bad.length ? fail("JavaScript syntax", bad.join("; ")) : ok("JavaScript syntax", `${files.length} files`);

// 2. JSON files parse
const jsonBad = [];
for (const f of ["package.json", "vercel.json", "lib/ontology.json", "lib/sources.json"]) { try { JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch (e) { jsonBad.push(`${f}: ${e.message}`); } }
jsonBad.length ? fail("JSON files", jsonBad.join("; ")) : ok("JSON files");

// 3. json-render bundle builds
try { sh("npm run -s build"); ok("Bundle builds", "public/js/jr.js"); } catch (e) { fail("Bundle builds", String(e.stderr || e.message).slice(0, 300)); }

// 4. No secrets in tracked files
const SECRET = [/postgres(ql)?:\/\/[^\s:@'"]+:[^\s@'"]+@/i, /\bsk-[A-Za-z0-9]{20,}/, /\bghp_[A-Za-z0-9]{30,}/, /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /^CRON_SECRET=(?!["<$])\S+/m, /^DATABASE_URL=(?!["<$])\S+/m];
const leaks = [];
for (const f of tracked()) {
  if (/^(node_modules|shots)\//.test(f) || /\.(png|jpg|ico|lock)$/.test(f) || f === "package-lock.json") continue;
  let t; try { t = fs.readFileSync(path.join(root, f), "utf8"); } catch { continue; }
  if (f === ".env.example" || f === "scripts/preflight.js") continue;
  if (SECRET.some((re) => re.test(t))) leaks.push(f);
}
if (fs.existsSync(path.join(root, ".env")) && tracked().includes(".env")) leaks.push(".env is tracked");
leaks.length ? fail("No secrets", "check: " + leaks.join(", ")) : ok("No secrets");

// 5. No Twitter/X sources
const src = fs.readFileSync(path.join(root, "lib/sources.json"), "utf8");
/(twitter\.com|x\.com\/|nitter)/i.test(src) ? fail("No Twitter/X sources", "lib/sources.json") : ok("No Twitter/X sources");

// 5b. No Twitter/X in the source catalog either; analysis rules behave
const cat = fs.readFileSync(path.join(root, "lib/source-catalog.json"), "utf8");
/(twitter\.com|x\.com\/|nitter)/i.test(cat) ? fail("No Twitter/X in catalog", "lib/source-catalog.json") : ok("No Twitter/X in catalog");
try { const out = sh("node test/analysis-unit.js").trim(); ok("Analysis rules", out.replace(/^analysis unit checks: /, "")); }
catch (e) { fail("Analysis rules", String(e.stderr || e.message).split("\n").find((l) => /Assertion|Error/.test(l)) || "failed"); }

// 5b2. Modules: kernel boots, boundaries hold, blocks, views and judges are valid
try { sh("node test/kernel-unit.js"); ok("Modules", sh("node scripts/modules.js check").trim() + "; kernel unit checks passed"); }
catch (e) { fail("Modules", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 5b3. Codebase map: every API call a page makes has a route
try { ok("Codebase map", sh("node scripts/codemap.js check").trim()); }
catch (e) { fail("Codebase map", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 5c. Agent kit: skills, subagents, plugin manifests, symlinks, index and MCP handshake
try { ok("Agent kit", sh("node scripts/agent-kit.js check").trim()); }
catch (e) { fail("Agent kit", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 6. Spec trace: every REQ in the shared spec(s) appears in docs/SPEC_TRACE.md, and the trace cites no unknown REQ
{
  const specDir = path.join(root, "specs");
  const specReqs = new Set();
  if (fs.existsSync(specDir)) for (const d of fs.readdirSync(specDir)) { const f = path.join(specDir, d, "spec.md"); if (fs.existsSync(f)) for (const m of fs.readFileSync(f, "utf8").matchAll(/\*\*(REQ-\d{3})\*\*/g)) specReqs.add(m[1]); }
  const traceFile = path.join(root, "docs", "SPEC_TRACE.md");
  const trace = fs.existsSync(traceFile) ? fs.readFileSync(traceFile, "utf8") : "";
  const traced = new Set(); for (const m of trace.matchAll(/REQ-(\d{3})(?:[–-](\d{3}))?/g)) { const a = +m[1], b = +(m[2] || m[1]); for (let i = a; i <= b; i++) traced.add(`REQ-${String(i).padStart(3, "0")}`); }
  if (!specReqs.size) warn("Spec trace", "no specs/*/spec.md found");
  else {
    const missing = [...specReqs].filter((r) => !traced.has(r)), unknown = [...traced].filter((r) => !specReqs.has(r));
    missing.length || unknown.length ? fail("Spec trace", [missing.length && `not traced: ${missing.join(", ")}`, unknown.length && `not in the spec: ${unknown.join(", ")}`].filter(Boolean).join("; ") + " (docs/SPEC_TRACE.md)")
      : ok("Spec trace", `${specReqs.size} requirements traced`);
  }
}

// 7. Interfaces reminder: schema or routes changed without docs/INTERFACES.md changing
try {
  const base = sh("git merge-base HEAD origin/main 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || echo").trim();
  if (base) {
    const changed = sh(`git diff --name-only ${base}`).split("\n");
    const diff = sh(`git diff ${base} -- lib/db.js server.js modules kernel`);
    const shape = /^[+-].*(CREATE TABLE|app\.(get|post|put|delete)\()/m.test(diff);
    if (shape && !changed.includes("docs/INTERFACES.md")) warn("Interfaces", "tables or API routes changed but docs/INTERFACES.md didn't; add a row if shapes changed");
    else ok("Interfaces", shape ? "routes or tables changed and INTERFACES.md updated" : "no shape changes");
  } else ok("Interfaces", "no base to compare");
} catch { ok("Contract", "skipped (no git history)"); }

// 7. API smoke test on synthetic data (SQLite, random port)
async function smoke() {
  const port = 3400 + Math.floor(Math.random() * 500);
  const env = { ...process.env, PORT: String(port), DATA_DIR: fs.mkdtempSync(path.join(require("node:os").tmpdir(), "si-pf-")) };
  delete env.DATABASE_URL; delete env.POSTGRES_URL;
  const child = spawn(process.execPath, ["--no-warnings", "test/serve-fixtures.js"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let errOut = ""; child.stderr.on("data", (d) => (errOut += d));
  const B = `http://localhost:${port}`;
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(B + "/api/me"); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    let cookie = "";
    const call = async (p, o = {}) => {
      const r = await fetch(B + p, { method: o.method || (o.body ? "POST" : "GET"), headers: { "content-type": "application/json", cookie }, body: o.body ? JSON.stringify(o.body) : undefined });
      const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      return { status: r.status, json: await r.json().catch(() => ({})) };
    };
    const steps = [];
    const su = await call("/api/signup", { body: { username: "preflight", password: "preflight-pass-1" } }); steps.push(["sign up", su.status === 200]);
    const st = await call("/api/stories"); steps.push(["feed (4 superintelligence stories; the general-AI sample is left out)", st.status === 200 && st.json.stories?.length === 4]);
    steps.push(["grouping (3 sources on one story)", st.json.stories?.some((s) => s.nsources === 3)]);
    const id = st.json.stories?.[0]?.id; const v = await call(`/api/stories/${id}/vote`, { method: "POST" }); steps.push(["vote", v.json.voted === true && v.json.votes === 1]);
    const br = await call("/api/brief"); steps.push(["weekly brief spec", br.status === 200 && !!br.json.spec?.root]);
    const al = await call("/api/agent-log", { body: {} }); steps.push(["agent log draft", al.status === 200 && al.json.entry?.status === "draft"]);
    const anon = await fetch(B + "/api/stories"); steps.push(["anonymous blocked", anon.status === 401]);
    const tw = await call("/api/stories", { body: { url: "https://x.com/a/status/1", title: "A Twitter thread here" } }); steps.push(["Twitter link refused", tw.status === 400]);
    const failed = steps.filter(([, p]) => !p).map(([n]) => n);
    failed.length ? fail("API smoke test", "failed: " + failed.join(", ") + (errOut ? ` | server: ${errOut.slice(0, 200)}` : "")) : ok("API smoke test", `${steps.length} checks`);
  } catch (e) { fail("API smoke test", e.message + (errOut ? ` | ${errOut.slice(0, 200)}` : "")); }
  finally { child.kill(); }
}

smoke().then(() => {
  const t = results.map((r) => `${r.ok ? (r.warn ? "!" : "✓") : "✗"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`).join("\n");
  console.log(t);
  const nfail = results.filter((r) => !r.ok).length;
  console.log(nfail ? `\nPreflight failed: ${nfail} problem${nfail > 1 ? "s" : ""}. Fix before pushing (or push with --no-verify if you must).` : "\nPreflight passed.");
  process.exit(nfail ? 1 : 0);
});
