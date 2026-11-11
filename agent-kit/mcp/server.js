#!/usr/bin/env node
// si-homepage MCP server: the agent kit's runtime for any MCP client (Claude Code, Claude Desktop, Cursor, VS Code, others).
// No dependencies; JSON-RPC 2.0 over stdio, one message per line.
//
// Progressive disclosure, same as Claude Code skills:
//   level 1  list_skills          names + one-line "use when" descriptions (cheap, always safe to call)
//   level 2  load_skill           one SKILL.md body + the list of its reference files
//   level 3  load_reference       one reference file, only when the skill says to read it
// Skills are also exposed as MCP resources (skill://<name>/...) and prompts (one per skill).
//
// App tools (tag_text, analyze_text, parse_feed, list_modules, ui_catalog, validate_spec, list_judges, run_judge) run the repo's own code. They need the repo:
// set SI_REPO, or start the client inside a clone. Without it, only the skill tools are offered.
const fs = require("node:fs"), path = require("node:path");

const KIT = path.resolve(__dirname, "..");
const SKILLS = path.join(KIT, "skills");
const VERSION = (() => { try { return JSON.parse(fs.readFileSync(path.join(KIT, ".claude-plugin/plugin.json"), "utf8")).version; } catch { return "0.0.0"; } })();

function findRepo() {
  const tries = [process.env.SI_REPO, process.cwd(), path.resolve(KIT, "..")].filter(Boolean);
  for (let dir of tries) {
    for (let i = 0; i < 6 && dir; i++, dir = path.dirname(dir)) if (fs.existsSync(path.join(dir, "lib", "analysis.js"))) return dir;
  }
  return null;
}
const REPO = findRepo();
const app = (m) => require(path.join(REPO, "lib", m));

// ---------- skills ----------
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/); const meta = {};
  if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { meta, body: m ? text.slice(m[0].length) : text };
}
function skills() {
  if (!fs.existsSync(SKILLS)) return [];
  return fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, "SKILL.md"))).sort().map((d) => {
    const { meta, body } = frontmatter(fs.readFileSync(path.join(SKILLS, d, "SKILL.md"), "utf8"));
    const refDir = path.join(SKILLS, d, "references");
    const refs = fs.existsSync(refDir) ? fs.readdirSync(refDir).filter((f) => f.endsWith(".md")).sort() : [];
    return { name: meta.name || d, dir: d, description: meta.description || "", body, refs };
  });
}
const skill = (name) => skills().find((s) => s.name === name || s.dir === name) || fail(`No skill named "${name}". Call list_skills.`);
function fail(msg) { const e = new Error(msg); e.user = true; throw e; }
function readRef(name, file) {
  const s = skill(name); const f = path.basename(String(file || ""));
  if (!s.refs.includes(f)) fail(`"${s.name}" has no reference "${file}". It has: ${s.refs.join(", ") || "none"}.`);
  return fs.readFileSync(path.join(SKILLS, s.dir, "references", f), "utf8");
}

// ---------- tools ----------
const S = (props, required = []) => ({ type: "object", properties: props, required, additionalProperties: false });
const TOOLS = [
  { name: "list_skills", description: "List the kit's skills: name and when to use each. Start here.", inputSchema: S({}),
    run: () => skills().map((s) => `- ${s.name}: ${s.description}`).join("\n") },
  { name: "load_skill", description: "Load one skill's instructions (SKILL.md) and the names of its reference files.", inputSchema: S({ name: { type: "string" } }, ["name"]),
    run: ({ name }) => { const s = skill(name); return `${s.body.trim()}\n\n---\nReference files (load with load_reference only when the steps above say to): ${s.refs.join(", ") || "none"}`; } },
  { name: "load_reference", description: "Load one reference file from a skill (third level of detail).", inputSchema: S({ skill: { type: "string" }, file: { type: "string" } }, ["skill", "file"]),
    run: ({ skill: n, file }) => readRef(n, file) },
];
if (REPO) TOOLS.push(
  { name: "tag_text", description: "Tag a title and summary with the homepage ontology (topics and organizations, with the words that matched).", inputSchema: S({ title: { type: "string" }, summary: { type: "string" } }, ["title"]),
    run: ({ title, summary = "" }) => JSON.stringify(app("tagger").tag(title, summary), null, 1) },
  { name: "analyze_text", description: "Judge a story like the homepage does: update type, evidence level, benchmarks with reported scores, watched people, frontier claims, and the 0-100 significance score with its explanation.",
    inputSchema: S({ title: { type: "string" }, summary: { type: "string" }, authors: { type: "string" }, kinds: { type: "array", items: { type: "string" }, description: "Source kinds that carried it, e.g. [\"journal\"], [\"lab\",\"news\"]" }, nsources: { type: "integer", minimum: 1 } }, ["title"]),
    run: ({ title, summary = "", authors = "", kinds = ["submitted"], nsources = 1 }) => JSON.stringify(app("analysis").analyze({ title, summary, authors }, { kinds, nsources }), null, 1) },
  { name: "parse_feed", description: "Parse feed text (RSS/Atom, arXiv, JSON Feed, HF daily, HN Algolia, Semantic Scholar) into normalized items, without saving anything. Pass the body you fetched yourself.",
    inputSchema: S({ format: { type: "string", enum: ["rss", "arxiv", "jsonfeed", "hf-daily", "hn-algolia", "semantic-scholar"] }, body: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, ["format", "body"]),
    run: ({ format, body, limit = 10 }) => { const items = app("feeds").parse(format, body); return JSON.stringify({ count: items.length, items: items.slice(0, limit) }, null, 1); } },
  { name: "list_modules", description: "List the app's plug-in modules, the extension points they declare or contribute to, and their views (the modular monolith's map).", inputSchema: S({}),
    run: () => JSON.stringify(kernel().describe(), null, 1) },
  { name: "ui_catalog", description: "Generative UI: the json-render catalog (every block from every enabled module, the actions) and the system prompt to give an LLM that should produce a view spec.", inputSchema: S({}),
    run: async () => { const { blocks, catalog } = await esm("views/catalog.mjs"); return JSON.stringify({ blocks: blocks.map(({ def, module }) => ({ name: def.name, module, description: def.description })), prompt: catalog.prompt() }, null, 1); } },
  { name: "validate_spec", description: "Validate a json-render view spec ({root, elements}) against the catalog before anyone renders it. Returns ok and the issues to fix.", inputSchema: S({ spec: { type: "object" } }, ["spec"]),
    run: async ({ spec }) => {
      const { catalog } = await esm("views/catalog.mjs"); const r = catalog.validate(spec);
      const issues = r.success ? [] : (r.error?.issues || []).slice(0, 30).map((i) => `${(i.path || []).join(".") || "spec"}: ${i.message}`);
      if (r.success) for (const [id, e] of Object.entries(spec.elements || {})) for (const c of e.children || []) if (!spec.elements[c]) issues.push(`elements.${id}.children: "${c}" isn't an element`);
      if (r.success && !spec.elements?.[spec.root]) issues.push(`root "${spec.root}" isn't an element`);
      return JSON.stringify({ ok: !issues.length, issues }, null, 1);
    } },
  { name: "list_judges", description: "List the decision models plugged into decision.judges (weighted-criteria, JEV, CLEF, …) and a sample input.", inputSchema: S({}),
    run: () => { const d = decision(); return JSON.stringify({ judges: [...d.judges.values()].map(({ id, name, description, method, inputs, module }) => ({ id, name, description, method, inputs, module })), sample: require(path.join(d.dir, "sample.json")) }, null, 1); } },
  { name: "run_judge", description: "Run a judge on {title, criteria:[{id,label,weight}], entries:[{id,label}], scores:{entry:{criterion:{score,evidence}}}, external?}. External judges (JEV, CLEF) need the real run's recommendation in external; they never invent one.",
    inputSchema: S({ judge: { type: "string" }, input: { type: "object" } }, ["judge", "input"]),
    run: ({ judge, input }) => { const j = decision().judges.get(judge); if (!j) fail(`No judge "${judge}". Call list_judges.`); return JSON.stringify(j.judge(input), null, 1); } },
);
TOOLS.push(...(REPO ? [{ name: "codemap_query", description: "Ask the codebase map instead of grepping: which pages call a route, which routes read or write a table, where a spec REQ is met and tested, what a module contributes. Query with words (\"votes\", \"REQ-003\", \"project_issues\", \"POST /api/lists\") or an exact node id (\"table:votes\") to trace everything connected.",
  inputSchema: S({ q: { type: "string" }, trace: { type: "boolean", description: "Return every node connected to the best match (pages ↔ routes ↔ tables, REQ ↔ code ↔ tests)." } }, ["q"]),
  run: ({ q, trace }) => {
    const scan = require(path.join(REPO, "modules", "codemap", "scan.js")), g = scan.build();
    const id = g.nodes.some((n) => n.id === q) ? q : scan.search(g, q)[0]?.id;
    if (!id) return "Nothing in the map matches. Try a table, route, page, module or REQ id.";
    return JSON.stringify(trace ? { id, connected: scan.trace(g, id) } : { answer: scan.answer(g, q), problems: g.problems }, null, 1);
  } }] : []));
// Coordination (REQ-071, proposed): the same claims, collision checks, ranked next steps and advisor as the Work board,
// through scripts/work.js so the database (local SQLite or the shared DATABASE_URL) is the app's. Who the agent is comes
// from SI_ACTOR (default agent:<branch>); SI_ASKED_BY names the person it works for.
const work = (...a) => { const r = require("node:child_process").spawnSync(process.execPath, [path.join(REPO, "scripts", "work.js"), ...a], { cwd: REPO, encoding: "utf8", timeout: 60000, env: { ...process.env, NODE_NO_WARNINGS: "1" } }); return (r.stdout || "") + (r.status ? `\n${(r.stderr || "").trim()}` : ""); };
const csv = (x) => (Array.isArray(x) ? x.join(",") : x || "");
TOOLS.push(...(REPO ? [
  { name: "work_brief", description: "Start here before changing code: the hard rules, who (people and agents) holds which tasks and files, your next tasks ranked with reasons, collisions with open branches, and the advisor's errors and warnings.", inputSchema: S({}), run: () => work("brief") },
  { name: "work_next", description: "Open tasks this agent may take (Spec Kit and OpenSpec), ranked, with the points behind each score; skips [people] tasks, blocked tasks and tasks someone holds.", inputSchema: S({}), run: () => work("next", "--json") },
  { name: "work_check", description: "Would claiming this task (and these files) collide with someone else's claim, an open branch, a gate or a shared document? Same answer a claim gives, without claiming.", inputSchema: S({ task: { type: "string" }, files: { type: "array", items: { type: "string" } } }, ["task"]), run: ({ task, files }) => work("check", task, ...(files && files.length ? ["--files", csv(files)] : []), "--json") },
  { name: "work_claim", description: "Claim a task and the files you will touch before you start (a lease, 2 h by default). Refused, with the reasons, if it collides; agents can't force. Release it when you push.", inputSchema: S({ task: { type: "string" }, files: { type: "array", items: { type: "string" } }, intent: { type: "string" }, minutes: { type: "integer" } }, ["task"]),
    run: ({ task, files, intent, minutes }) => work("claim", task, ...(files && files.length ? ["--files", csv(files)] : []), ...(intent ? ["--intent", intent] : []), ...(minutes ? ["--minutes", String(minutes)] : []), "--json") },
  { name: "work_release", description: "Release your claim on a task.", inputSchema: S({ task: { type: "string" } }, ["task"]), run: ({ task }) => work("release", task, "--json") },
  { name: "work_who", description: "Who holds a file or folder right now, and which open branches change it.", inputSchema: S({ file: { type: "string" } }, ["file"]), run: ({ file }) => work("who", file, "--json") },
  { name: "work_advise", description: "Highlights and drafted additions for Spec Kit, OpenSpec, the data model, sources and actions, view bindings, validation and learnings; each names its file and whether it is a shared document (needs both partners). Suggest them; don't apply shared ones.", inputSchema: S({ target: { type: "string", enum: ["speckit", "openspec", "data-model", "bindings", "validation", "learning", "agents"] } }), run: ({ target }) => work("advise", ...(target ? ["--target", target] : []), "--json") },
] : []));
function kernel() { return require(path.join(REPO, "kernel", "kernel.js")).createKernel(); }
function decision() { const m = kernel().modules.find((x) => x.id === "decision"); if (!m) fail("The decision module isn't enabled."); return m; }
const esm = (rel) => import(require("node:url").pathToFileURL(path.join(REPO, rel)).href);

// ---------- JSON-RPC ----------
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
const handlers = {
  initialize: (p) => ({
    protocolVersion: p?.protocolVersion || "2025-06-18",
    capabilities: { tools: {}, resources: {}, prompts: {} },
    serverInfo: { name: "si-homepage", version: VERSION },
    instructions: "Skills for the Superintelligence Homepage repo. Call list_skills first, load_skill for the one that fits the task, and load_reference only when a skill says to." + (REPO ? "" : " App tools are off: set SI_REPO to a clone of the repo to enable tagging, analysis, feed parsing, modules, generative UI and judges."),
  }),
  ping: () => ({}),
  "tools/list": () => ({ tools: TOOLS.map(({ run, ...t }) => t) }),
  "tools/call": (p) => {
    const t = TOOLS.find((x) => x.name === p?.name);
    if (!t) return { content: [{ type: "text", text: `Unknown tool ${p?.name}` }], isError: true };
    return Promise.resolve().then(() => t.run(p.arguments || {})).then((text) => ({ content: [{ type: "text", text: String(text) }] }), (e) => ({ content: [{ type: "text", text: e.message }], isError: true }));
  },
  "resources/list": () => ({ resources: skills().flatMap((s) => [
    { uri: `skill://${s.name}/SKILL.md`, name: s.name, description: s.description, mimeType: "text/markdown" },
    ...s.refs.map((f) => ({ uri: `skill://${s.name}/references/${f}`, name: `${s.name}/${f}`, mimeType: "text/markdown" })),
  ]) }),
  "resources/read": (p) => {
    const m = String(p?.uri || "").match(/^skill:\/\/([^/]+)\/(SKILL\.md|references\/(.+))$/); if (!m) fail("Unknown resource.");
    const text = m[3] ? readRef(m[1], m[3]) : fs.readFileSync(path.join(SKILLS, skill(m[1]).dir, "SKILL.md"), "utf8");
    return { contents: [{ uri: p.uri, mimeType: "text/markdown", text }] };
  },
  "prompts/list": () => ({ prompts: skills().map((s) => ({ name: s.name, description: s.description })) }),
  "prompts/get": (p) => { const s = skill(p?.name); return { description: s.description, messages: [{ role: "user", content: { type: "text", text: s.body.trim() } }] }; },
};
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk; let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { send({ id: null, error: { code: -32700, message: "Parse error" } }); continue; }
    if (msg.id === undefined) continue; // notifications (e.g. notifications/initialized)
    const h = handlers[msg.method];
    if (!h) { send({ id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } }); continue; }
    Promise.resolve().then(() => h(msg.params)).then((result) => send({ id: msg.id, result }), (e) => send({ id: msg.id, error: { code: e.user ? -32602 : -32603, message: e.message } }));
  }
});
// Let async replies finish before exiting when stdin closes.
process.stdin.on("end", () => setTimeout(() => process.exit(0), 1500));
