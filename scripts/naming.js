#!/usr/bin/env node
// Checks the naming convention in docs/NAMING.md: routes, tables, ids, labels and metadata.
//   node scripts/naming.js         print problems; exit 1 if any
// Uses the codebase map (every module, whatever the site profile) so routes and tables are seen as the code defines them.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const { KEBAB, REQ } = require("../lib/ids");

function check() {
  const problems = [], add = (rule, msg) => problems.push({ rule, msg });
  const scan = require("../modules/codemap/scan.js");
  const g = scan.build();
  const modules = fs.readdirSync(path.join(root, "modules"), { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(root, "modules", d.name, "module.js"))).map((d) => d.name);
  const manifests = Object.fromEntries(modules.map((id) => [id, require(path.join(root, "modules", id, "module.js"))]));

  // Metadata: module manifests.
  for (const [dir, m] of Object.entries(manifests)) {
    if (m.id !== dir) add("module-id", `modules/${dir}/module.js: id "${m.id}" should equal its folder "${dir}"`);
    if (!/^\d+\.\d+\.\d+$/.test(m.version || "")) add("module-version", `module ${dir}: version "${m.version}" is not semver`);
    if (!m.description) add("module-description", `module ${dir}: missing description`);
  }

  // Routes.
  const prefixes = Object.fromEntries(Object.entries(manifests).map(([id, m]) => [id, [`/api/${id}`, `/api/admin/${id}`, ...(m.api || [])]]));
  const allModulePrefixes = Object.entries(prefixes).filter(([id]) => id !== "admin").flatMap(([, p]) => p);
  for (const r of g.nodes.filter((n) => n.kind === "route")) {
    const p = r.path;
    if (!p.startsWith("/api/")) continue; // pages and redirects
    for (const seg of p.split("/").slice(1)) if (!(KEBAB.test(seg) || /^:[a-z]+$/.test(seg) || /^[a-z0-9-]+\.(xml|md|json|opml)$/.test(seg))) add("route-segment", `${r.label}: segment "${seg}" isn't kebab-case or :param (${r.file})`);
    if (r.admin && !p.startsWith("/api/admin/") && p !== "/api/admin") add("route-admin", `${r.label}: admin-only route should live under /api/admin/ (${r.file})`);
    if (!r.admin && p.startsWith("/api/admin/")) add("route-admin", `${r.label}: under /api/admin/ but doesn't require an admin (${r.file})`);
    if (r.module && r.module !== "core") {
      const ok = (prefixes[r.module] || []).some((x) => p === x || p.startsWith(x + "/") || p.startsWith(x + "."));
      const adminModule = r.module === "admin" && p.startsWith("/api/admin/");
      if (!ok && !adminModule) add("route-module", `${r.label}: module "${r.module}" routes start with /api/${r.module} or /api/admin/${r.module} (or declare api: [...] in its manifest)`);
    } else if (allModulePrefixes.some((x) => p === x || p.startsWith(x + "/"))) add("route-core", `${r.label}: core route uses a module's prefix`);
  }

  // Tables.
  for (const t of g.nodes.filter((n) => n.kind === "table")) {
    if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(t.label)) add("table-name", `${t.label}: tables are snake_case`);
    const m = /^modules\/([^/]+)\//.exec(t.file || "");
    if (m && !t.label.startsWith(m[1].replace(/-/g, "_") + "_")) add("table-module", `${t.label}: tables of module "${m[1]}" start with "${m[1].replace(/-/g, "_")}_"`);
  }

  // Ontology ids, references and the spec's top-level topics.
  const o = require("../lib/ontology.json");
  for (const kind of ["topics", "organizations", "benchmarks", "people"]) {
    const seen = new Set();
    for (const x of o[kind] || []) { if (!KEBAB.test(x.id)) add("id-kebab", `ontology ${kind}: "${x.id}" isn't kebab-case`); if (seen.has(x.id)) add("id-unique", `ontology ${kind}: duplicate id "${x.id}"`); seen.add(x.id); }
  }
  const topicIds = new Set(o.topics.map((t) => t.id));
  for (const t of o.topics) if (t.parent && !topicIds.has(t.parent)) add("id-ref", `topic ${t.id}: parent "${t.parent}" doesn't exist`);
  for (const b of o.benchmarks || []) if (b.measures && !topicIds.has(b.measures)) add("id-ref", `benchmark ${b.id}: measures "${b.measures}" isn't a topic`);
  const spec = fs.readFileSync(path.join(root, "specs/001-superintelligence-homepage/spec.md"), "utf8");
  const block = (spec.split("**Superintelligence topics**")[1] || "").split(/\n- \*\*|\n## /)[0];
  const specTopics = [...block.matchAll(/^\s+- (.+)$/gm)].map((m) => m[1].trim());
  const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();
  const top = o.topics.filter((t) => !t.parent).map((t) => t.label);
  if (specTopics.length) {
    if (top.length !== specTopics.length) add("spec-topics", `ontology has ${top.length} top-level topics; the spec lists ${specTopics.length}`);
    for (const s of specTopics) if (!top.some((l) => norm(s).startsWith(norm(l)) || norm(l).startsWith(norm(s)))) add("spec-topics", `spec topic "${s}" has no top-level topic with that label`);
  }

  // Learn concepts.
  const cf = path.join(root, "modules/learn/data/concepts.json");
  if (fs.existsSync(cf)) {
    const c = JSON.parse(fs.readFileSync(cf, "utf8")), ids = new Set(), tops = new Set(o.topics.filter((t) => !t.parent).map((t) => t.id));
    for (const x of c.concepts) {
      if (!KEBAB.test(x.id)) add("id-kebab", `concept "${x.id}" isn't kebab-case`); if (ids.has(x.id)) add("id-unique", `duplicate concept "${x.id}"`); ids.add(x.id);
      if (!tops.has(x.topic)) add("id-ref", `concept ${x.id}: topic "${x.topic}" isn't a top-level topic`);
    }
    for (const x of c.concepts) for (const r of x.relations || []) { if (!ids.has(r.to)) add("id-ref", `concept ${x.id}: relation to unknown "${r.to}"`); if (!c.relations[r.kind]) add("id-ref", `concept ${x.id}: unknown relation kind "${r.kind}"`); }
  }

  // Project labels.
  const reqs = new Set([...spec.matchAll(/\*\*(REQ-\d{3})\*\*/g)].map((m) => m[1]));
  const sf = path.join(root, "modules/project/starter.json");
  if (fs.existsSync(sf)) for (const i of JSON.parse(fs.readFileSync(sf, "utf8")).issues || []) for (const l of i.labels || []) {
    if (REQ.test(l)) { if (!reqs.has(l)) add("label-req", `starter issue "${i.title}": ${l} isn't in the spec`); }
    else if (!KEBAB.test(l)) add("label-kebab", `starter issue "${i.title}": label "${l}" isn't kebab-case`);
  }

  // Data files carry metadata.
  const dataFiles = ["lib/ontology.json", "lib/sources.json", "modules/profiles.json", "modules/project/starter.json", ...modules.flatMap((id) => { const d = path.join(root, "modules", id, "data"); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json") && !/^codemap\.json$/.test(f)).map((f) => `modules/${id}/data/${f}`) : []; })];
  for (const f of dataFiles) {
    if (!fs.existsSync(path.join(root, f))) continue;
    const d = JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
    if (Array.isArray(d) || !d.about) add("meta-about", `${f}: needs a top-level "about"`);
  }
  for (const f of ["lib/ontology.json", "modules/learn/data/concepts.json"]) if (fs.existsSync(path.join(root, f)) && !JSON.parse(fs.readFileSync(path.join(root, f), "utf8")).version) add("meta-version", `${f}: needs a "version"`);

  return { problems, counts: { routes: g.nodes.filter((n) => n.kind === "route").length, tables: g.nodes.filter((n) => n.kind === "table").length, modules: modules.length } };
}
module.exports = { check };

if (require.main === module) {
  const { problems, counts } = check();
  for (const p of problems) console.log(`✗ ${p.rule}  ${p.msg}`);
  console.log(`naming: ${counts.routes} routes, ${counts.tables} tables, ${counts.modules} modules, ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}
