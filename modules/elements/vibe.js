// Provider for a vibe-coding checkout (REQ-073, proposed): the conventions in its CONVENTIONS.md (a project header and a
// context block per prompt, with fixed vocabularies) become two element descriptors, and every prompts.md becomes rows,
// so the same keys, grain, shapes and quads apply to another repo's records. Point VIBE_REPO at a checkout, or pass
// { dir } (the tests use a Sample checkout in test/fixtures/vibe).
const fs = require("node:fs"), path = require("node:path");
const TBD = "TBD";
const STATUS = ["prototype", "keeper", "abandoned", TBD], LEVEL = ["low", "medium", "high", TBD], STORY = ["none", "anecdote", "case study", "chapter-worthy", TBD], VERIFIED = ["not-run", "syntax-checked", "agent-tested", "human-tested"];

function vocabulary(dir) {
  try { const t = fs.readFileSync(path.join(dir, "CONVENTIONS.md"), "utf8"), sec = t.split(/^## Tags/m)[1] || ""; return [...sec.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]); } catch { return []; }
}
const field = (block, name) => { const m = block.match(new RegExp(`^> - \\*\\*${name}(?: \\([^)]*\\))?:\\*\\*\\s*(.*)$`, "mi")); return m ? m[1].trim() : null; };
const firstWord = (v, list) => { if (v === null) return null; const w = v.toLowerCase(); return list.find((x) => w.startsWith(x.toLowerCase())) || v; };

function parse(text, folder) {
  const head = text.split(/^# Prompt /m)[0], title = (head.match(/^# Project:\s*(.+)$/m) || [])[1] || folder;
  const dates = (field(head, "Dates") || "").match(/(\d{4}-\d{2}-\d{2})(?:\s*(?:→|->|to)\s*(\d{4}-\d{2}-\d{2}))?/);
  const reuse = field(head, "Reusability") || "", ra = reuse.match(/artifact\s+(\w+)/i), rp = reuse.match(/prompt pattern\s+(\w+)/i);
  const project = { folder, title: title.trim(), files: (field(head, "Files") || "").split(",").map((s) => s.trim()).filter(Boolean), date_first: dates ? dates[1] : null, date_last: dates ? dates[2] || dates[1] : null,
    defaults: field(head, "Defaults"), status: firstWord(field(head, "Status"), STATUS), use: field(head, "Use"), reusability_artifact: ra ? ra[1] : null, reusability_prompt: rp ? rp[1] : null,
    tags: (field(head, "Tags") || "").split(",").map((s) => s.trim()).filter(Boolean), takeaway: field(head, "Takeaway"), story_value: firstWord(field(head, "Story value"), STORY), surprises: field(head, "Surprises") };
  const prompts = [];
  for (const part of text.split(/^# Prompt /m).slice(1)) {
    const h = part.match(/^(\d+)\s*(?:\(([^)]*)\))?/); if (!h) continue;
    const block = part.split(/^## Output/m)[0], tool = field(block, "Tool"), date = tool && (tool.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
    const time = field(block, "Time"), secs = time ? (time.match(/(\d+(?:\.\d+)?)\s*(s|sec|m|min)?/) || []) : [];
    prompts.push({ project: folder, number: Number(h[1]), purpose: h[2] || null, tool, date: date || null, session: field(block, "Session"), time_seconds: secs[1] ? Math.round(Number(secs[1]) * (/^m/.test(secs[2] || "") ? 60 : 1)) : null,
      verified: field(block, "Verified") ? firstWord(field(block, "Verified"), VERIFIED) : null, human_edits: field(block, "Human edits"), has_output: /^## Output/m.test(part) });
  }
  return { project, prompts };
}

function read(dir) {
  const projects = [], prompts = [];
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return { projects, prompts, vocabulary: [] }; }
  for (const e of ents.filter((x) => x.isDirectory() && !x.name.startsWith(".") && !x.name.startsWith("_")).sort((a, b) => a.name.localeCompare(b.name))) {
    let t; try { t = fs.readFileSync(path.join(dir, e.name, "prompts.md"), "utf8"); } catch { continue; }
    const r = parse(t, e.name); projects.push(r.project); prompts.push(...r.prompts);
  }
  return { projects, prompts, vocabulary: vocabulary(dir) };
}

function descriptors(vocab = []) {
  const s = (description, extra = {}) => ({ type: "string", description, ...extra });
  return [
    { id: "collection:vibe-project", kind: "collection", label: "Vibe-coding project", owner: "vibe-coding", source: "CONVENTIONS.md (project header)", aliases: ["vibe project", "project header"],
      description: "One project folder in a vibe-coding repo: something built with an AI assistant, with its prompts.md header saying what it is, how it went and whether it was worth it.",
      tags: ["interop:external", "repo:vibe-coding", "storage:markdown"],
      properties: { folder: s("The project's folder name (snake_case); its natural key.", { required: true, pattern: "^[a-z0-9_]+$" }), title: s("The name after '# Project:'.", { required: true }),
        files: { type: "json", description: "The deliverable files in the folder." }, date_first: { type: "date", description: "First prompt date." }, date_last: { type: "date", description: "Last prompt date." },
        defaults: s("Tool and model used unless a prompt says otherwise."), status: s("prototype, keeper or abandoned (TBD while unknown).", { required: true, enum: STATUS }), use: s("Where it was actually used, or none yet."),
        reusability_artifact: s("Is the thing worth reusing?", { enum: LEVEL }), reusability_prompt: s("Is the technique worth copying?", { enum: LEVEL }),
        tags: { type: "json", description: "Tags from the conventions' tag list." }, takeaway: s("One sentence, written while fresh."), story_value: s("none, anecdote, case study or chapter-worthy.", { enum: STORY }), surprises: s("Failures and pleasant surprises.") },
      keys: { surrogate: null, primary: ["folder"], natural: [["folder"]] }, grain: { statement: "one row per project folder", keys: ["folder"] },
      relationships: [{ rel: "has-prompt", target: "collection:vibe-prompt", direction: "in", cardinality: "1..*", description: "Its prompts, in order." }],
      constraints: [{ id: "tags-from-vocabulary", kind: "vocabulary", on: "tags", value: vocab, message: "Tags come from the list in CONVENTIONS.md; add a new one there first." }, { id: "no-missing-fields", kind: "required-or-TBD", on: ["status", "takeaway", "story_value"], message: "Write TBD rather than leaving a field out." }],
      lifecycle: { persistence: "perpetual", retention: "git history" }, series: { time: "date_last", cadence: "per project", order: "desc" } },
    { id: "collection:vibe-prompt", kind: "collection", label: "Vibe-coding prompt", owner: "vibe-coding", source: "CONVENTIONS.md (prompt context block)", aliases: ["prompt section", "prompt context block"],
      description: "One prompt in a project's prompts.md, with its context block: the tool and date, the session, how long it took, how well its result was verified and what a person changed afterward.",
      tags: ["interop:external", "repo:vibe-coding", "storage:markdown"],
      properties: { project: s("The project folder this prompt belongs to.", { required: true }), number: { type: "integer", required: true, min: 1, description: "Its number in the file (Prompt 1, 2, ...)." }, purpose: s("What the prompt is for (the words in brackets)."),
        tool: s("Tool, model and date; required by the conventions.", { required: true }), date: { type: "date", description: "The date from the Tool line." }, session: s("fresh or continued, and attached files."),
        time_seconds: { type: "integer", min: 0, unit: "s", description: "How long the assistant worked." }, verified: s("not-run, syntax-checked, agent-tested or human-tested; required by the conventions.", { required: true, enum: VERIFIED }),
        human_edits: s("What a person changed afterward, or none; required by the conventions.", { required: true }), has_output: { type: "boolean", description: "Whether its Output section is there." } },
      keys: { surrogate: null, primary: ["project", "number"], natural: [["project", "number"]] }, grain: { statement: "one row per prompt per project", keys: ["project", "number"] },
      relationships: [{ rel: "project", target: "collection:vibe-project", direction: "out", via: "project", cardinality: "1", inverse: "has-prompt" }],
      lifecycle: { persistence: "perpetual", retention: "git history" }, series: { time: "date", cadence: "event", order: "asc", partition: ["project"] } },
  ];
}

function provider({ dir = process.env.VIBE_REPO } = {}) {
  let cache = null; const data = () => (cache ||= dir ? read(dir) : { projects: [], prompts: [], vocabulary: [] });
  return { id: "vibe-coding", about: `Projects and prompts from a vibe-coding checkout${dir ? ` (${dir})` : " (set VIBE_REPO)"}.`,
    describe: () => (dir ? descriptors(data().vocabulary) : []),
    rows: (id) => (id === "collection:vibe-project" ? data().projects : id === "collection:vibe-prompt" ? data().prompts : null) };
}

module.exports = { parse, read, descriptors, provider, vocabulary };
