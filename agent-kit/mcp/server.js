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
// App tools (tag_text, analyze_text, parse_feed) run the repo's own lib/ code. They need the repo:
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
);

// ---------- JSON-RPC ----------
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
const handlers = {
  initialize: (p) => ({
    protocolVersion: p?.protocolVersion || "2025-06-18",
    capabilities: { tools: {}, resources: {}, prompts: {} },
    serverInfo: { name: "si-homepage", version: VERSION },
    instructions: "Skills for the Superintelligence Homepage repo. Call list_skills first, load_skill for the one that fits the task, and load_reference only when a skill says to." + (REPO ? "" : " App tools are off: set SI_REPO to a clone of the repo to enable tag_text, analyze_text and parse_feed."),
  }),
  ping: () => ({}),
  "tools/list": () => ({ tools: TOOLS.map(({ run, ...t }) => t) }),
  "tools/call": (p) => {
    const t = TOOLS.find((x) => x.name === p?.name);
    if (!t) return { content: [{ type: "text", text: `Unknown tool ${p?.name}` }], isError: true };
    try { return { content: [{ type: "text", text: String(t.run(p.arguments || {})) }] }; }
    catch (e) { return { content: [{ type: "text", text: e.message }], isError: true }; }
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
    try { send({ id: msg.id, result: h(msg.params) }); }
    catch (e) { send({ id: msg.id, error: { code: e.user ? -32602 : -32603, message: e.message } }); }
  }
});
process.stdin.on("end", () => process.exit(0));
