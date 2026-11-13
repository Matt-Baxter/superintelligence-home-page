#!/usr/bin/env node
// Save a version of the site for later analysis: measures a git ref and writes docs/snapshots/<name>.json and .md.
//   node scripts/snapshot.js <name> [ref]        e.g. node scripts/snapshot.js john-extended-2026-11-07 snapshot/john-extended-2026-11-07
//   node scripts/snapshot.js compare <a> <b>     compare two saved snapshots (names)
// The ref is checked out into a temporary git worktree (nothing in your working copy changes). Measures come from that
// version's own codebase map when it has one, plus file counts, lines of code, tests and spec coverage.
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const OUT = path.join(root, "docs", "snapshots");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();

function loc(dir, exts) {
  let files = 0, lines = 0;
  const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "m", "data", "shots", "out"].includes(e.name) && e.isDirectory()) continue;
    const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (exts.some((x) => e.name.endsWith(x))) { files++; lines += fs.readFileSync(p, "utf8").split("\n").length; } } };
  walk(dir); return { files, lines };
}

function measure(dir, ref) {
  const m = { ref, commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim(), date: execFileSync("git", ["log", "-1", "--format=%cI"], { cwd: dir, encoding: "utf8" }).trim() };
  const spec = fs.existsSync(path.join(dir, "specs/001-superintelligence-homepage/spec.md")) ? fs.readFileSync(path.join(dir, "specs/001-superintelligence-homepage/spec.md"), "utf8") : "";
  m.spec = { requirements: [...new Set([...spec.matchAll(/\*\*(REQ-\d{3})\*\*/g)].map((x) => x[1]))].length };
  const trace = path.join(dir, "docs/SPEC_TRACE.md");
  if (fs.existsSync(trace)) {
    const t = fs.readFileSync(trace, "utf8"), got = new Set();
    for (const [, a, b] of t.matchAll(/^\| REQ-(\d{3})(?:[–-](\d{3}))? \|/gm)) for (let n = Number(a); n <= Number(b || a); n++) got.add(n);
    m.spec.traced = got.size;
  }
  const scan = path.join(dir, "modules/codemap/scan.js");
  if (fs.existsSync(scan)) {
    try {
      const out = execFileSync(process.execPath, ["-e", `const g=require(${JSON.stringify(scan)}).build(); const c=(k)=>g.nodes.filter(n=>n.kind===k); console.log(JSON.stringify({routes:c("route").map(n=>n.label),tables:c("table").map(n=>n.label),pages:c("page").map(n=>n.label),modules:c("module").map(n=>n.label),blocks:c("block").length}))`], { cwd: dir, encoding: "utf8", env: { ...process.env, SITE_PROFILE: "extended" } });
      const g = JSON.parse(out);
      m.map = { routes: g.routes.length, tables: g.tables.length, pages: g.pages.length, modules: g.modules, blocks: g.blocks };
      m.lists = { routes: g.routes, tables: g.tables, pages: g.pages };
    } catch (e) { m.map = { error: String(e.message).split("\n")[0] }; }
  }
  const outOfScope = { "notes": /\/api\/stories\/:id\/notes/, "reading lists": /\/api\/lists/, "weekly brief": /\/api\/brief/, "source suggestions": /\/api\/sources\/suggest/, "in-app agent log": /\/api\/agent-log/, "Learn layer": /\/api\/learn/, "project tracker": /\/api\/admin\/project/, "codebase map": /codemap/, "capability tracker": /\/api\/capabilities/ };
  m.beyondSpec = m.lists ? Object.entries(outOfScope).filter(([, re]) => m.lists.routes.some((r) => re.test(r))).map(([k]) => k) : [];
  const prof = path.join(dir, "modules/profiles.json");
  m.profiles = fs.existsSync(prof) ? Object.keys(JSON.parse(fs.readFileSync(prof, "utf8")).profiles) : [];
  m.code = { server: loc(path.join(dir), [".js"]).lines, pages: loc(path.join(dir, "public"), [".html"]).lines + loc(path.join(dir, "modules"), [".html"]).lines, modules: loc(path.join(dir, "modules"), [".js", ".mjs", ".jsx"]).lines, lib: loc(path.join(dir, "lib"), [".js"]).lines };
  const e2e = path.join(dir, "test/e2e.js");
  m.tests = { browserChecks: fs.existsSync(e2e) ? (fs.readFileSync(e2e, "utf8").match(/\bok\(/g) || []).length : 0 };
  const skills = path.join(dir, "agent-kit/skills"); m.agentKit = { skills: fs.existsSync(skills) ? fs.readdirSync(skills).filter((d) => fs.existsSync(path.join(skills, d, "SKILL.md"))).length : 0 };
  return m;
}

function md(name, m) {
  const L = [`# Snapshot: ${name}`, "", `Saved version of the site for later analysis. Ref \`${m.ref}\`, commit \`${m.commit.slice(0, 10)}\`, ${m.date.slice(0, 10)}. Re-create it with \`git checkout ${m.ref}\`.`, "",
    "| Measure | Value |", "| --- | --- |",
    `| Spec requirements traced | ${m.spec.traced ?? "?"} of ${m.spec.requirements} |`,
    m.map && !m.map.error ? `| API routes · tables · pages | ${m.map.routes} · ${m.map.tables} · ${m.map.pages} |` : `| Codebase map | ${m.map?.error || "not available in this version"} |`,
    m.map?.modules ? `| Modules | ${m.map.modules.length}: ${m.map.modules.join(", ")} |` : null,
    m.map && !m.map.error ? `| json-render blocks | ${m.map.blocks} |` : null,
    `| Lines: lib · modules · pages | ${m.code.lib} · ${m.code.modules} · ${m.code.pages} |`,
    `| Browser-test checks | ${m.tests.browserChecks} |`,
    `| Agent-kit skills | ${m.agentKit.skills} |`,
    `| Profiles | ${m.profiles.join(", ") || "none (one version)"} |`,
    `| Beyond the shared spec | ${m.beyondSpec.join(", ") || "nothing"} |`, ""].filter((x) => x !== null);
  if (m.lists) L.push("<details><summary>Routes</summary>", "", ...m.lists.routes.map((r) => `- \`${r}\``), "", "</details>", "", "<details><summary>Tables</summary>", "", m.lists.tables.map((t) => `\`${t}\``).join(", "), "", "</details>", "");
  return L.join("\n");
}

function compare(a, b) {
  const A = JSON.parse(fs.readFileSync(path.join(OUT, `${a}.json`), "utf8")), B = JSON.parse(fs.readFileSync(path.join(OUT, `${b}.json`), "utf8"));
  const row = (k, x, y) => `| ${k} | ${x} | ${y} |`;
  const only = (x, y) => (x || []).filter((r) => !(y || []).includes(r));
  return [`# ${a} vs ${b}`, "", `| Measure | ${a} | ${b} |`, "| --- | --- | --- |",
    row("Commit", A.commit.slice(0, 10), B.commit.slice(0, 10)), row("Routes · tables · pages", `${A.map?.routes} · ${A.map?.tables} · ${A.map?.pages}`, `${B.map?.routes} · ${B.map?.tables} · ${B.map?.pages}`),
    row("Modules", (A.map?.modules || []).length, (B.map?.modules || []).length), row("Browser-test checks", A.tests.browserChecks, B.tests.browserChecks),
    row("Lines (lib + modules + pages)", A.code.lib + A.code.modules + A.code.pages, B.code.lib + B.code.modules + B.code.pages), row("Beyond the spec", A.beyondSpec.join(", ") || "nothing", B.beyondSpec.join(", ") || "nothing"), "",
    `Routes only in ${a}: ${only(A.lists?.routes, B.lists?.routes).map((r) => `\`${r}\``).join(", ") || "none"}`, "",
    `Routes only in ${b}: ${only(B.lists?.routes, A.lists?.routes).map((r) => `\`${r}\``).join(", ") || "none"}`, ""].join("\n");
}

function main() {
  const [a, b, c] = process.argv.slice(2);
  if (!a) { console.log("Usage: node scripts/snapshot.js <name> [ref] | compare <a> <b>"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  if (a === "compare") { const text = compare(b, c); const f = path.join(OUT, `compare-${b}-vs-${c}.md`); fs.writeFileSync(f, text); console.log(text); return; }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a)) throw new Error("Snapshot names are kebab-case, e.g. john-extended-2026-11-07");
  const ref = b || "HEAD";
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), "si-snap-"));
  git("worktree", "add", "--detach", wt, ref);
  try {
    if (fs.existsSync(path.join(root, "node_modules")) && !fs.existsSync(path.join(wt, "node_modules"))) fs.symlinkSync(path.join(root, "node_modules"), path.join(wt, "node_modules"), "dir");
    const m = measure(wt, ref);
    fs.writeFileSync(path.join(OUT, `${a}.json`), JSON.stringify(m, null, 2) + "\n");
    fs.writeFileSync(path.join(OUT, `${a}.md`), md(a, m));
    console.log(`snapshot ${a}: ${m.map?.routes ?? "?"} routes, ${m.map?.tables ?? "?"} tables, ${m.tests.browserChecks} browser checks -> docs/snapshots/${a}.md`);
  } finally { git("worktree", "remove", "--force", wt); }
}
main();
