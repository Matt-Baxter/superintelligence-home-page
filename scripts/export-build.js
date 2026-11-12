#!/usr/bin/env node
// Exports the bake-off build (the spec version: REQ-001 to REQ-020, SITE_PROFILE=spec) into a folder of its own, for
// builds/john/ on main (WORKING_AGREEMENT: each build lives in its own folder). Copies only what the spec version runs
// on: the server, the core library, the admin module, the reader pages, the spec acceptance suite and its synthetic
// fixtures. John's extended work stays on his branch. The file list was found by tracing every module the spec
// acceptance suite loads (API and browser); test/export-build check reruns that suite inside the exported folder.
//   node scripts/export-build.js <out-dir>
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, ".."), out = path.resolve(process.argv[2] || path.join(root, "out", "builds-john"));
const FILES = [
  "server.js", "api/index.js", "kernel/kernel.js",
  "lib/analysis.js", "lib/audit.js", "lib/db.js", "lib/expr/build.js", "lib/expr/eval.js", "lib/expr/index.js", "lib/expr/spec.json", "lib/feeds.js",
  "lib/harvest.js", "lib/ids.js", "lib/negation.js", "lib/ontology.json", "lib/profile.js", "lib/publication-identity.js", "lib/registry.js",
  "lib/si-rubric.js", "lib/sources.json", "lib/story-values.js", "lib/tagger.js", "lib/taggers/contract.js", "lib/taggers/index.js", "lib/topic-index.js",
  "schema/types.json",
  "modules/admin/module.js", "modules/admin/routes.js", "modules/admin/README.md",
  "public/index.html", "public/story.html", "public/sources.html", "public/welcome.html", "public/css/app.css", "public/js/api.js",
  "test/spec-acceptance.js", "test/serve-fixtures.js", "test/sample-clock.js", "test/fixture-dates.js",
  ".env.example", "vercel.json",
];
const DIRS = ["lib/rules", "modules/admin/pages", "public/fonts", "test/fixtures/spec"];
const FIXTURES = ["sample-catalog.json", "sample-rss.xml", "sample-atom.xml", "sample-hf.json", "sample-spec.xml"];
const copy = (rel) => { const s = path.join(root, rel), d = path.join(out, rel); if (!fs.existsSync(s)) return false; fs.mkdirSync(path.dirname(d), { recursive: true }); fs.cpSync(s, d, { recursive: true }); return true; };
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const missing = [...FILES, ...DIRS, ...FIXTURES.map((f) => `test/fixtures/${f}`)].filter((f) => !copy(f));
// The sample server runs the spec version with the spec's labelled fixtures by default (the build has no other version).
{ const f = path.join(out, "test", "serve-fixtures.js"); let t = fs.readFileSync(f, "utf8");
  t = t.replace(/process\.env\.SITE_PROFILE = process\.env\.SITE_PROFILE \|\| "extended";[^\n]*/, 'process.env.SITE_PROFILE = process.env.SITE_PROFILE || "spec"; process.env.FIXTURE_SET = process.env.FIXTURE_SET || "spec";');
  fs.writeFileSync(f, t); }
// Only the admin module, and only the spec profile.
fs.writeFileSync(path.join(out, "modules/modules.json"), JSON.stringify({ about: "The spec version runs only the admin module (sources and fetch status), which running the site needs.", enabled: ["admin"] }, null, 2) + "\n");
const P = JSON.parse(fs.readFileSync(path.join(root, "modules/profiles.json"), "utf8"));
fs.writeFileSync(path.join(out, "modules/profiles.json"), JSON.stringify({ about: "John's bake-off build runs the spec version only.", default: "spec", profiles: { spec: P.profiles.spec } }, null, 2) + "\n");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({
  name: "si-home-john", version: pkg.version, private: true,
  description: "John's bake-off build of the Superintelligence Homepage (the shared spec, REQ-001 to REQ-020).",
  scripts: { build: "node scripts/pages.js", start: "node --no-warnings server.js", "dev:sample": "node --no-warnings test/serve-fixtures.js", test: "node test/spec-acceptance.js --browser", "test:api": "node test/spec-acceptance.js" },
  engines: pkg.engines, dependencies: { express: pkg.dependencies.express, pg: pkg.dependencies.pg }, devDependencies: { playwright: pkg.devDependencies.playwright },
}, null, 2) + "\n");
// Module pages are served by Express locally; on Vercel the static output needs them in public/m/.
fs.mkdirSync(path.join(out, "scripts"), { recursive: true });
fs.writeFileSync(path.join(out, "scripts", "pages.js"), `#!/usr/bin/env node
// Copies each enabled module's pages to public/m/ so a static host (Vercel) serves them as the local server does.
const fs = require("node:fs"), path = require("node:path"), root = path.join(__dirname, "..");
const { enabled } = JSON.parse(fs.readFileSync(path.join(root, "modules", "modules.json"), "utf8"));
const dst = path.join(root, "public", "m"); fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
for (const id of enabled) { const src = path.join(root, "modules", id, "pages"); if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true }); }
console.log("pages: copied module pages to public/m/");
`);
const vc = JSON.parse(fs.readFileSync(path.join(out, "vercel.json"), "utf8"));
vc.functions["api/index.js"].includeFiles = "{lib,kernel,modules,schema}/**";
fs.writeFileSync(path.join(out, "vercel.json"), JSON.stringify(vc, null, 2) + "\n");
fs.writeFileSync(path.join(out, "Dockerfile"), "FROM node:22-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --omit=dev\nCOPY . .\nRUN npm run build\nENV NODE_ENV=production DATA_DIR=/data PORT=3000\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n");
// docs/BUILD_JOHN.md links from docs/ (../X); the folder sits two levels down (builds/john), so links gain one level.
fs.writeFileSync(path.join(out, "README.md"), fs.readFileSync(path.join(root, "docs", "BUILD_JOHN.md"), "utf8").replace(/\]\(\.\.\//g, "](../../"));
fs.writeFileSync(path.join(out, ".gitignore"), "node_modules/\ndata/\n*.db\n.env\n.env.*\n!.env.example\npublic/m/\n");
console.log(`export-build: ${FILES.length + DIRS.length} paths -> ${path.relative(root, out) || out}${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
if (missing.length) process.exit(1);
