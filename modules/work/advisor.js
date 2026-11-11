// The advisor (REQ-070, proposed): highlights gaps between what the specs promise, what OpenSpec plans, what the data
// model, sources, actions, bindings and shapes actually are, and drafts the addition that would close each one.
// It only suggests: every finding carries a ready-to-paste draft and the file it belongs in, and a finding on a
// shared document says it needs both partners. Pure: advise(facts) -> findings; gather() reads the repo.
//
// finding: { id, rule, severity: error|warn|idea, target: speckit|openspec|data-model|bindings|validation|learning|agents,
//            subject, why, draft, file, shared, reqs }
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const ROOT = path.join(__dirname, "..", "..");
const O = require("./overlap");
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
const words = (s) => new Set(String(s).toLowerCase().match(/[a-z][a-z-]{3,}/g) || []);
const STOP = new Set(["must", "should", "system", "extended", "version", "with", "that", "their", "from", "each", "every", "this", "when", "into", "they", "them", "only", "which", "than", "have", "shall"]);
const jaccard = (a, b) => { const A = [...a].filter((w) => !STOP.has(w)), B = new Set([...b].filter((w) => !STOP.has(w))); const i = A.filter((w) => B.has(w)).length; return i / (new Set([...A, ...B]).size || 1); };
const short = (t) => String(t).replace(/^In the extended version, /i, "").replace(/^(the system|each \w+|a \w+)\s+/i, "").split(/[,;:]/)[0].split(/\s+/).slice(0, 10).join(" ");

const RULES = [];
const rule = (id, fn) => RULES.push({ id, fn });

// --- Spec Kit ----------------------------------------------------------------------------------------------------
rule("speckit.untraced", (f) => f.reqs.filter((r) => !r.trace).map((r) => {
  const hit = f.mentions[r.id] || { code: [], tests: [] };
  const code = hit.code.slice(0, 3).join(", ") || "(where it is built)", check = hit.tests.slice(0, 2).join(", ") || "(the check that proves it)";
  return { severity: hit.code.length ? "warn" : "idea", target: "speckit", subject: r.id, reqs: [r.id], file: "docs/SPEC_TRACE.md",
    why: hit.code.length ? `${r.id} has no row in docs/SPEC_TRACE.md, but ${hit.code.length} file${hit.code.length > 1 ? "s" : ""} name it.` : `${r.id} has no trace row and no code names it yet.`,
    draft: `<!-- trace-spec: ${r.spec} -->\n| ${r.id} | ${short(r.text)} | ${code} | ${check} |` };
}));
rule("speckit.no-task", (f) => f.reqs.filter((r) => r.status !== "approved" && !r.trace && !(r.tasks || []).length && !f.items.some((i) => i.reqs.includes(r.id))).map((r) => ({
  severity: "idea", target: "speckit", subject: r.id, reqs: [r.id], file: `specs/${f.specDir[r.spec] || r.spec}/tasks.md`,
  why: `${r.id} has no task in Spec Kit or OpenSpec, so nobody can pick it up.`, draft: `- [ ] T${String(f.nextTask[r.spec] || (+r.spec * 100) % 1000).padStart(3, "0")} [agent] [${r.id}] ${short(r.text)}` })));
// A spec whose requirements are all planned in an open OpenSpec change is covered by that change's tasks (the work
// board reads both), so only specs with neither get a suggestion; a mirrored tasks.md would just duplicate work items.
rule("speckit.no-tasks-file", (f) => f.specs.filter((s) => !f.hasTasks[s.id] && !f.reqs.filter((r) => r.spec === s.id).every((r) => Object.values(f.inChanges).some((ids) => ids.includes(r.id)))).map((s) => {
  const ch = Object.entries(f.inChanges).find(([, ids]) => ids.some((id) => f.reqs.some((r) => r.id === id && r.spec === s.id)));
  const from = ch ? f.items.filter((i) => i.change === ch[0]) : [];
  return { severity: "warn", target: "speckit", subject: `spec ${s.id}`, reqs: f.reqs.filter((r) => r.spec === s.id).map((r) => r.id), file: `specs/${s.dir}/tasks.md`,
    why: `Spec ${s.id} has no tasks.md${ch ? `; its tasks live only in openspec/changes/${ch[0]}` : ""}, so the project tracker can't show its open work.`,
    draft: [`# Tasks: ${s.title}`, "", "**Spec**: [spec.md](spec.md)", "", ...from.map((i, n) => `- [${i.done ? "x" : " "}] T${String(((+s.id * 100) % 1000) + n).padStart(3, "0")} [${i.who}] ${i.reqs.map((r) => `[${r}] `).join("")}${i.text}`)].join("\n") };
}));
// --- OpenSpec ----------------------------------------------------------------------------------------------------
rule("openspec.unmapped", (f) => f.reqs.filter((r) => !f.mapped.has(r.id) && !f.mapped.has(`${r.spec}:${r.id}`)).map((r) => {
  const best = Object.entries(f.capabilities).map(([id, c]) => ({ id, s: jaccard(words(r.text), words(`${c.title} ${c.purpose}`)) })).sort((a, b) => b.s - a.s)[0];
  return { severity: "error", target: "openspec", subject: r.id, reqs: [r.id], file: "openspec/capabilities.json",
    why: `${r.id} isn't in any OpenSpec capability or open change, so openspec check fails.`, draft: best ? `add "${r.id}" to capabilities.${best.id}.reqs (closest by wording, similarity ${best.s.toFixed(2)})` : `add "${r.id}" to a capability` };
}));
rule("openspec.archive-ready", (f) => Object.keys(f.inChanges).filter((ch) => { const ts = f.items.filter((i) => i.change === ch); return ts.length && ts.every((i) => i.done); }).map((ch) => ({
  severity: "idea", target: "openspec", subject: ch, file: `openspec/changes/${ch}`, why: `Every task in ${ch} is done.`, draft: `npx @fission-ai/openspec archive ${ch}  # then move its REQs from inChanges into capabilities` })));
rule("openspec.gate-waiting", (f) => f.items.filter((i) => i.source === "openspec" && !i.done && i.who === "people" && i.blocks.length >= 2).map((i) => ({
  severity: "warn", target: "openspec", subject: i.key, reqs: i.reqs, file: `openspec/changes/${i.change}/tasks.md`,
  why: `${i.blocks.length} tasks wait on a decision only John and Matt can make: ${i.text.slice(0, 120)}`, draft: `Decide ${i.key}, then tick it in the commit that records the decision.` })));
// --- Data model --------------------------------------------------------------------------------------------------
rule("data-model.undocumented-table", (f) => f.tables.filter((t) => !f.interfaces.includes(t.name)).map((t) => ({
  severity: "warn", target: "data-model", subject: `table:${t.name}`, file: "docs/INTERFACES.md", why: `Table ${t.name} (${t.file}) isn't named in docs/INTERFACES.md, the log of this build's tables.`,
  draft: `- **${f.today}.** Table \`${t.name}\` (${t.file}): ${t.cols.slice(0, 8).join(", ")}${t.cols.length > 8 ? ", …" : ""}.` })));
rule("data-model.unshaped-type", (f) => f.types.filter((t) => !f.shaped.has(t)).map((t) => ({
  severity: "idea", target: "data-model", subject: `type:${t}`, file: "modules/graph/shapes.ttl", why: `Graph nodes of type ${t} are exported but no SHACL shape checks them.`,
  draft: `si:${t}Shape a sh:NodeShape ; sh:targetClass si:${t} ;\n  sh:property [ sh:path rdfs:label ; sh:minCount 1 ; sh:datatype xsd:string ; sh:message "A ${t} needs a label." ] .` })));
// --- Sources, actions and bindings -------------------------------------------------------------------------------
rule("bindings.unknown-refresh", (f) => f.actions.flatMap((a) => (a.refresh || []).filter((s) => !f.sourceIds.has(s)).map((s) => ({
  severity: "error", target: "bindings", subject: `action:${a.id}`, why: `${a.id} asks views to refresh ${s}, which no module registers.`, draft: `refresh: [${(a.refresh || []).filter((x) => f.sourceIds.has(x)).map((x) => JSON.stringify(x)).join(", ")}]`, file: `modules/${a.module}` }))));
rule("bindings.view-references", (f) => f.views.flatMap((v) => {
  const out = [], walk = (x) => { if (!x || typeof x !== "object") return; if (x.action === "runAction" && x.params && x.params.id && !f.actionIds.has(x.params.id)) out.push({ kind: "action", id: x.params.id }); Object.values(x).forEach(walk); };
  for (const [p, b] of Object.entries((v.spec && v.spec.bindings) || {})) if (!f.sourceIds.has(b.source)) out.push({ kind: "source", id: b.source, path: p });
  walk(v.spec && v.spec.elements);
  return out.map((o) => ({ severity: "error", target: "bindings", subject: `view:${v.name}`, file: `modules/${v.module}`, why: `View ${v.name} ${o.kind === "source" ? `binds ${o.path} to source ${o.id}` : `runs action ${o.id}`}, which doesn't exist.`, draft: `Register ${o.id} with ctx.point("data.${o.kind === "source" ? "sources" : "actions"}").add(...) or point the view at one of: ${[...(o.kind === "source" ? f.sourceIds : f.actionIds)].filter((x) => x.split(".")[0] === String(o.id).split(".")[0]).slice(0, 4).join(", ") || "(none in that module)"}` }));
}));
rule("bindings.unbound-source", (f) => f.sources.filter((s) => s.access !== "admin" && !f.boundSources.has(s.id) && !f.pageSources.has(s.id)).map((s) => ({
  severity: "idea", target: "bindings", subject: `source:${s.id}`, file: `modules/${s.module}`, why: `${s.id} is readable by ${s.access === "public" ? "anyone" : "signed-in people"} but no page or view uses it.`,
  draft: `{"bindings": {"/${s.id.split(".").pop()}": {"source": "${s.id}"${Object.keys(s.params || {}).length ? `, "params": {${Object.entries(s.params).filter(([, d]) => d.required).map(([k]) => `"${k}": "…"`).join(", ")}}` : ""}}}}` })));
// --- Validation --------------------------------------------------------------------------------------------------
rule("validation.unbounded-string", (f) => [...f.sources, ...f.actions].flatMap((d) => Object.entries(d.params || {}).filter(([, p]) => p.type === "string" && !p.max && !p.enum).map(([k]) => ({
  severity: "warn", target: "validation", subject: `${d.kind}:${d.id}.${k}`, file: `modules/${d.module}`, why: `${d.id} takes ${k} as a string with no length limit.`, draft: `${k}: { type: "string", max: 200 }` }))));
rule("validation.inconsistent-guard", (f) => { const out = []; const byMod = new Map(); for (const d of [...f.sources, ...f.actions]) { if (!byMod.has(d.module)) byMod.set(d.module, []); byMod.get(d.module).push(d); }
  for (const [mod, ds] of byMod) { const g = ds.filter((d) => d.guarded); if (g.length && g.length < ds.length) for (const d of ds.filter((x) => !x.guarded && x.id.startsWith(`${mod}.`))) out.push({ severity: "warn", target: "validation", subject: `${d.kind}:${d.id}`, file: `modules/${mod}`, why: `${g.length} of ${ds.length} ${mod} sources and actions check the feature switch; ${d.id} doesn't, so it stays reachable when the feature is off.`, draft: `${d.id}: add guard (the same one its module's other ${d.kind}s use)` }); }
  return out; });
rule("validation.action-without-about", (f) => [...f.sources, ...f.actions].filter((d) => !d.about || d.about.length < 12).map((d) => ({ severity: "warn", target: "validation", subject: `${d.kind}:${d.id}`, file: `modules/${d.module}`, why: `${d.id} has no description, so the Studio catalog and agents can't tell what it does.`, draft: `about: "…"` })));
// --- Learnings and agents ----------------------------------------------------------------------------------------
rule("learning.area-without-qa", (f) => { const areas = {}; for (const l of f.learnings) (areas[l.area] ||= []).push(l); return Object.entries(areas).filter(([, ls]) => ls.length >= 3 && ls.every((l) => !/^qa:/.test(l.guard))).map(([a, ls]) => ({
  severity: "idea", target: "learning", subject: `area:${a}`, file: "modules/responses/qa.js", why: `${ls.length} learnings in ${a} are guarded only by unit checks; none is checked on a real render.`, draft: `Add a QA check for ${a} in modules/responses/qa.js (CHECKS) and point the newest learning in that area at it.` })); });
rule("agents.overlapping-tasks", (f) => O.board({ items: f.items }).filter((c) => c.type === "overlapping-tasks").map((c) => ({ severity: "idea", target: "agents", subject: c.subjects.join(" + "), why: c.why, file: c.files[0], draft: c.subjects.slice(1).map((k, n) => `${k}: add "after ${c.subjects[n].split("/").pop()}" to its text`).join("\n") })));

function advise(facts, { dismissed = new Set() } = {}) {
  const out = [];
  for (const r of RULES) {
    let found = []; try { found = r.fn(facts) || []; } catch (e) { found = [{ severity: "warn", target: "agents", subject: r.id, why: `The ${r.id} rule failed: ${e.message}`, draft: "" }]; }
    for (const x of found) { const id = hash(`${r.id}|${x.subject}|${x.why}`); out.push({ id, rule: r.id, reqs: [], ...x, shared: O.shared([x.file]).length > 0 || /^specs\/001-/.test(x.file || ""), dismissed: dismissed.has(id) }); }
  }
  const order = { error: 0, warn: 1, idea: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.target.localeCompare(b.target) || a.subject.localeCompare(b.subject));
}

// --- Reading the repo and the live registry ----------------------------------------------------------------------
function walkFiles(dir, root, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { if (/^(node_modules|\.git|out|data|public)$/.test(e.name) && dir === root) continue; if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name); if (e.isDirectory()) walkFiles(p, root, out); else if (/\.(js|mjs|html|json|py)$/.test(e.name)) out.push(p); }
  return out;
}
function tablesIn(root) {
  const files = [path.join(root, "lib", "db.js"), ...walkFiles(path.join(root, "modules"), root).filter((f) => /module\.js$/.test(f))], out = [];
  for (const f of files) { let t = ""; try { t = fs.readFileSync(f, "utf8"); } catch { continue; }
    for (const m of t.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g)) out.push({ name: m[1], file: path.relative(root, f), cols: m[2].split(/,(?![^(]*\))/).map((c) => c.trim().split(/\s+/)[0]).filter((c) => /^[a-z_]+$/.test(c) && !["PRIMARY", "UNIQUE", "FOREIGN"].includes(c)) }); }
  return out;
}

function gather({ root = ROOT, registry = null, views = [], items = null } = {}) {
  const S = require("../project/specs"), I = require("./items");
  const rd = (rel) => { try { return fs.readFileSync(path.join(root, rel), "utf8"); } catch { return ""; } };
  const { specs, reqs } = S.collect();
  const caps = JSON.parse(rd("openspec/capabilities.json") || "{}"), inChanges = Object.fromEntries(Object.entries(caps.inChanges || {}).filter(([k]) => k !== "about"));
  const mapped = new Set([...Object.values(caps.capabilities || {}).flatMap((c) => c.reqs), ...Object.values(inChanges).flat()]);
  const all = walkFiles(root, root).map((f) => path.relative(root, f)), mentions = {}, pageSources = new Set(), boundSources = new Set();
  for (const f of all) { const t = rd(f); if (!t) continue;
    for (const id of new Set(t.match(/REQ-\d{3}/g) || [])) { const m = (mentions[id] ||= { code: [], tests: [] }); (/^test\//.test(f) ? m.tests : /^(modules|lib|scripts|views|kernel|server\.js|agent-kit)/.test(f) ? m.code : []).push(f); }
    if (/\.html$/.test(f)) for (const m of t.matchAll(/source\(\s*"([\w.-]+)"/g)) pageSources.add(m[1]);
    for (const m of t.matchAll(/"source"\s*:\s*"([\w.-]+)"/g)) boundSources.add(m[1]); }
  const reg = registry || require("../data/registry");
  const defs = (map, kind) => [...map.values()].map((d) => ({ kind, id: d.id, module: d.module, about: d.about, params: d.params, access: d.access, guarded: !!d.guard, refresh: d.refresh }));
  const sources = defs(reg.sources, "source"), actions = defs(reg.actions, "action");
  for (const v of views) for (const b of Object.values((v.spec && v.spec.bindings) || {})) boundSources.add(b.source);
  let types = [], shaped = new Set(); try { types = require("../graph/appgraph").TYPES; shaped = new Set([...rd("modules/graph/shapes.ttl").matchAll(/sh:targetClass si:(\w+)/g)].map((m) => m[1])); } catch {}
  let learnings = []; try { learnings = JSON.parse(rd("modules/responses/learnings.json")).learnings; } catch {}
  const specDir = Object.fromEntries(specs.map((s) => [s.id, s.dir])), hasTasks = Object.fromEntries(specs.map((s) => [s.id, !!rd(`specs/${s.dir}/tasks.md`)]));
  const nextTask = {}; for (const s of specs) { const ids = [...rd(`specs/${s.dir}/tasks.md`).matchAll(/T(\d{3})/g)].map((m) => +m[1]); nextTask[s.id] = ids.length ? Math.max(...ids) + 1 : (+s.id * 100) % 1000; }
  return { reqs, specs, specDir, hasTasks, nextTask, capabilities: caps.capabilities || {}, inChanges, mapped, items: items || I.collect(root), mentions, tables: tablesIn(root), interfaces: rd("docs/INTERFACES.md"),
    types, shaped, sources, actions, sourceIds: new Set(sources.map((s) => s.id)), actionIds: new Set(actions.map((a) => a.id)), views, boundSources, pageSources, learnings, today: new Date().toISOString().slice(0, 10) };
}

module.exports = { advise, gather, RULES, jaccard, words, tablesIn };
