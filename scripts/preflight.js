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
try { ok("Content desk", sh("node --no-warnings test/content-desk-unit.js").trim()); ok("Editorial publishing", sh("node --no-warnings test/editorial-unit.js").trim()); } catch (e) { fail("Content management", String(e.stderr || e.message).slice(0,600)); }
try { ok("Graph logic", sh("node test/graph-logic-unit.js").trim()); } catch (e) { fail("Graph logic", String(e.stderr || e.message)); }
try { ok("Pipeline quality", sh("node test/pipeline-quality-unit.js").trim()); ok("Story paging", sh("node --no-warnings test/story-page-unit.js").trim().split("\n").pop()); }
catch (e) { fail("Pipeline quality / paging", String(e.stderr || e.message).split("\n").find((l) => /Assertion|Error/.test(l)) || "failed"); }
try { ok("UI dates", sh("node test/ui-date-unit.js").trim()); }
catch (e) { fail("UI dates", String(e.stderr || e.message).split("\n").find((l) => /Assertion|Error/.test(l)) || "failed"); }
try { const out = sh("node test/analysis-unit.js").trim(); ok("Analysis rules", out.replace(/^analysis unit checks: /, "")); }
catch (e) { fail("Analysis rules", String(e.stderr || e.message).split("\n").find((l) => /Assertion|Error/.test(l)) || "failed"); }

// 5b2. Modules: kernel boots, boundaries hold, blocks, views and judges are valid
try { sh("node test/kernel-unit.js"); ok("Modules", sh("node scripts/modules.js check").trim() + "; kernel unit checks passed"); }
catch (e) { fail("Modules", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 5b3. Codebase map: every API call a page makes has a route
try { ok("Codebase map", sh("node scripts/codemap.js check").trim()); }
catch (e) { fail("Codebase map", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 5b2. Unslop: UI patterns that read as AI-generated (agent-kit/skills/ui-design)
try { sh("node test/unslop-unit.js"); ok("Unslop", sh("node scripts/unslop.js").trim().split("\n").pop().replace(/^unslop: /, "")); }
catch (e) { fail("Unslop", String(e.stdout || e.stderr || e.message).trim().split("\n").slice(0, 5).join(" | ")); }

// 5b3. Nothing the code needs is git-ignored (a fresh clone in CI must have every module file).
try {
  const GENERATED = [/^modules\/codemap\/data\//, /^modules\/project\/data\//, /\/node_modules\//];
  const ignored = sh("git ls-files --others --ignored --exclude-standard -- modules lib kernel scripts agent-kit").split("\n").filter((f) => f && !GENERATED.some((r) => r.test(f)));
  ignored.length ? fail("No ignored source files", `git-ignored but needed: ${ignored.slice(0, 5).join(", ")} (fix .gitignore)`) : ok("No ignored source files");
} catch { ok("No ignored source files", "skipped (no git)"); }

// 5b4. Naming convention (docs/NAMING.md): routes, tables, ids, labels, metadata
try { ok("Naming", sh("node scripts/naming.js").trim().split("\n").pop().replace(/^naming: /, "")); }
catch (e) { fail("Naming", String(e.stdout || e.message).trim().split("\n").slice(0, 4).join(" | ")); }

// 5b5. Commit messages on this branch carry no co-author or session trailers (the humans asked).
try {
  const base = sh("git merge-base HEAD origin/main").trim();
  const bodies = sh(`git log ${base}..HEAD --format=%H%n%B%n----`);
  const bad = bodies.split("----").filter((b) => /^(Co-Authored-By|Claude-Session):/im.test(b)).map((b) => b.trim().slice(0, 10));
  bad.length ? fail("Commit trailers", `${bad.length} commit(s) since main carry Co-Authored-By/Claude-Session lines: ${bad.slice(0, 3).join(", ")}`) : ok("Commit trailers", "none");
} catch { ok("Commit trailers", "skipped (no origin/main)"); }

// 5b6. si-expr (portable rules) and the schema registry: Node vectors, builder/registry units, generated schemas current.
try {
  sh("node test/spec-status-unit.js"); sh("node test/sync-source-unit.js"); sh("node --no-warnings test/scope-admission.js");
  sh("node test/expr-unit.js"); sh("node test/lab-unit.js"); sh("node test/review-unit.js"); sh("node test/papers-unit.js"); sh("node test/watch-unit.js"); sh("node test/project-sync-unit.js"); sh("node test/dossier-unit.js"); sh("node test/sources-unit.js"); sh("node test/panel-unit.js"); sh("node test/quality-unit.js"); sh("node --no-warnings test/research-feed.js"); sh("node --no-warnings test/rigor-badge.js");
  sh("node test/project-specs-unit.js");
  const ex = sh("node scripts/expr-check.js --only=node").trim().split("\n")[0].replace(/^✓ node\s+/, "");
  const sc = sh("node scripts/schema.js check").trim().split("\n")[0].replace(/^✓ up to date\s+/, "");
  ok("Rules and schemas", `si-expr ${ex} vectors; schema/gen ${sc} current`);
} catch (e) { fail("Rules and schemas", String(e.stdout || e.stderr || e.message).trim().split("\n").slice(-3).join(" | ")); }

// 5b7. Judge edge cases (bench/judge-edge-cases.json, proposed REQ-032..REQ-037): a case marked "ok" that breaks fails;
// known gaps are reported, not failed, so the backlog is visible and can only shrink.
try { ok("Judge edge cases", sh("node test/judge-edge-cases.js").trim().split("\n").pop().replace(/^judge edge cases: /, "")); }
catch (e) { fail("Judge edge cases", String(e.stdout || e.message).trim().split("\n").filter((l) => /✗|regression/.test(l)).slice(0, 4).join(" | ")); }

// 5b7b. Judge fixtures and properties (spec 003, T003-T006): fidelity set shape, near-cutoff report, the Lean model's
// vectors against review.js, and property tests on 300 generated synthetic texts (known design gaps print, don't fail).
try { const last = (c) => sh(c).trim().split("\n").pop();
  const props = last("node test/judge-properties.js --n 300").replace(/^judge properties: /, "");
  sh("node test/fidelity-cases.js"); sh("node test/fidelity-unit.js"); sh("node test/judge-report-unit.js"); sh("node test/judge-lean-vectors.js"); sh("node test/bands-unit.js");
  ok("Judge properties", `${props} (300 generated texts; the full run is 1,200); fidelity set well-formed, near-cutoff rule and band units pass, Lean vectors match review.js`); }
catch (e) { fail("Judge properties", String(e.stdout || e.message).trim().split("\n").slice(-3).join(" | ")); }

// 5b8. AGENTS.md is what Codex reads (not CLAUDE.md): it must carry the hard rules itself and fit Codex's 32 KiB default.
try { const a = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), need = ["Never push to `main`", "No Twitter/X", "No co-author trailers", "npm run preflight"].filter((x) => !a.includes(x));
  const kb = Buffer.byteLength(a) / 1024; need.length || kb > 32 ? fail("AGENTS.md", [need.length && `missing: ${need.join(", ")}`, kb > 32 && `${kb.toFixed(1)} KiB, over Codex's 32 KiB`].filter(Boolean).join("; ")) : ok("AGENTS.md", `rules and commands present, ${kb.toFixed(1)} KiB`); }
catch (e) { fail("AGENTS.md", e.message); }

// 5b6. Lab results precomputed for cold starts (scripts/lab-results.js) must match the current examples and runners.
try { ok("Lab results current", sh("node scripts/lab-results.js --check").trim().replace(/^lab results: /, "")); }
catch (e) { fail("Lab results current", String(e.stdout || e.message).trim()); }

// 5b7. Benchmarks with a ratchet (scripts/bench.js): no metric may get worse than bench/baseline.json allows.
try {
  const out = sh("node scripts/bench.js").trim().split("\n").at(-1).replace(/^bench: /, "");
  ok("Benchmarks", out);
} catch (e) { fail("Benchmarks", String(e.stdout || e.message).trim().split("\n").filter((l) => /REGRESSION|bench:/.test(l)).join(" | ")); }

// 5c. Agent kit: skills, subagents, plugin manifests, symlinks, index and MCP handshake
try { ok("Agent kit", sh("node scripts/agent-kit.js check").trim()); }
catch (e) { fail("Agent kit", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ")); }

// 5c2. Hub (docs/HUB.md): generated from the repo by scripts/hub.js, so it fails when stale or when a relative link in it breaks (test/hub-unit.js first)
try { sh("node test/hub-unit.js"); ok("Hub", sh("node scripts/hub.js --check").trim().replace(/^hub: /, "")); }
catch (e) { fail("Hub", String(e.stderr || e.message).trim().split("\n").slice(0, 4).join(" ") + " (run npm run hub)"); }

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
  env.SITE_PROFILE = "spec"; // the smoke test checks the version built from the shared spec; npm test covers the extended one
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
    const me = await call("/api/me"); steps.push(["spec version running", me.json.user?.profile === "spec"]);
    const extras = await Promise.all(["/api/brief", "/api/lists", "/api/learn/concepts", "/api/admin/project/issues"].map((p) => call(p)));
    steps.push(["extras beyond the spec are off (brief, lists, Learn, project)", extras.every((r) => r.status === 404)]);
    const page = await fetch(B + "/m/learn"); steps.push(["extended-only pages aren't served", page.status === 404]);
    const save = await call(`/api/stories/${id}/save`, { method: "POST" }); steps.push(["save (REQ)", save.status === 200]);
    const al = await call("/api/agent-log"); steps.push(["no in-app agent log (REQ-020)", al.status === 404]);
    const anon = await fetch(B + "/api/stories"); steps.push(["public feed readable", anon.status === 200]);
    const privateView = await fetch(B + "/api/stories?saved=1"); steps.push(["saved stories require sign-in", privateView.status === 401]);
    const tw = await call("/api/stories", { body: { url: "https://x.com/a/status/1", title: "A Twitter thread here" } }); steps.push(["Twitter link refused", tw.status === 400]);
    const failed = steps.filter(([, p]) => !p).map(([n]) => n);
    failed.length ? fail("API smoke test", "failed: " + failed.join(", ") + (errOut ? ` | server: ${errOut.slice(0, 200)}` : "")) : ok("API smoke test", `${steps.length} checks`);
  } catch (e) { fail("API smoke test", e.message + (errOut ? ` | ${errOut.slice(0, 200)}` : "")); }
  finally { child.kill(); }
}

// 8. Spec acceptance (API checks) on the spec version with labelled synthetic sources: every REQ needs a passing check (SC-008).
async function specAcceptance() {
  try { const out = sh("node test/spec-acceptance.js").trim().split("\n").pop(); ok("Spec acceptance", out.replace(/^spec acceptance: /, "").split(";").slice(0, 2).join(";")); }
  catch (e) { fail("Spec acceptance", String(e.stdout || e.message).trim().split("\n").filter((l) => l.startsWith("✗") || l.startsWith("spec acceptance")).slice(0, 4).join(" | ")); }
}
smoke().then(specAcceptance).then(() => {
  const t = results.map((r) => `${r.ok ? (r.warn ? "!" : "✓") : "✗"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`).join("\n");
  console.log(t);
  const nfail = results.filter((r) => !r.ok).length;
  console.log(nfail ? `\nPreflight failed: ${nfail} problem${nfail > 1 ? "s" : ""}. Fix before pushing (or push with --no-verify if you must).` : "\nPreflight passed.");
  process.exit(nfail ? 1 : 0);
});
