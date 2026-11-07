// Specs view (REQ-030, proposed): every requirement in specs/<nnn>/spec.md with where it lives (docs/SPEC_TRACE.md),
// its Spec Kit tasks (specs/<nnn>/tasks.md), the people checks (modules/project/sync.json) and the latest measured
// status (docs/SPEC_STATUS.md). Pure parsers plus one reader; the route adds the tracker issues from the database.
// Vercel bundles only {lib,views,kernel,modules,schema}/** (vercel.json includeFiles), so `npm run build` also writes
// a snapshot to modules/project/data/specs.json (git-ignored) and the reader falls back to it when specs/ isn't there.
const fs = require("node:fs"), path = require("node:path");
const ROOT = path.join(__dirname, "..", "..");
const SNAPSHOT = path.join(__dirname, "data", "specs.json");
const WHO = ["agent", "rules", "people"];

const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();
const reqRange = (a, b) => { const out = []; for (let i = +a; i <= +(b || a); i++) out.push(`REQ-${String(i).padStart(3, "0")}`); return out; };

// "**Status**: Proposed, **not approved**." → proposed; the shared spec ("both partners build against it") → approved.
function parseStatus(md) {
  const line = flat((String(md).match(/^\*\*Status\*\*:\s*(.+)$/m) || [])[1]).replace(/\*\*/g, "");
  const status = /\bnot approved\b|\bproposed\b/i.test(line) ? "proposed" : /\bapproved\b|\bshared\b|both partners build/i.test(line) ? "approved" : "proposed";
  return { status, statusLine: line };
}

// "- **REQ-001**: The system MUST …" (the text may wrap onto indented lines) → {id, text, level}
function parseSpec(md) {
  md = String(md).replace(/\r\n/g, "\n");
  const title = flat((md.match(/^# (?:Feature Specification:\s*)?(.+)$/m) || [])[1]);
  const reqs = [...md.matchAll(/^- \*\*(REQ-\d{3})\*\*: ([\s\S]*?)(?=\n- |\n\n|\n#|(?![\s\S]))/gm)].map((m) => {
    const text = flat(m[2]);
    return { id: m[1], text, level: /\bMUST\b/.test(text) ? "MUST" : /\bSHOULD\b/.test(text) ? "SHOULD" : /\bMAY\b/.test(text) ? "MAY" : "" };
  }).sort((a, b) => a.id.localeCompare(b.id));
  return { title, ...parseStatus(md), reqs };
}

// "- [x] T012 [rules] [REQ-037] Cap any single …" → {id, who, reqs, done, text}
function parseTasks(md) {
  return [...String(md).matchAll(/^- \[( |x|X)\] (T\d{3})((?: \[[^\]]+\])*) ([^\n]+)/gm)].map((m) => {
    const tags = [...m[3].matchAll(/\[([^\]]+)\]/g)].map((t) => t[1]);
    return { id: m[2], who: tags.find((t) => WHO.includes(t)) || "agent", reqs: tags.filter((t) => /^REQ-\d{3}$/.test(t)), done: m[1] !== " ", text: flat(m[4]) };
  });
}

// docs/SPEC_TRACE.md rows "| REQ-009–012 | What | Where in the code | Checked by |" → {REQ-009: {what, code, check}, …}
function parseTrace(md, spec) {
  const out = {}; let scope = null;
  for (const line of String(md).split("\n")) {
    const scoped = line.match(/<!-- trace-spec: (\d{3}) -->/);
    if (scoped) scope = scoped[1];
    if (spec && scope && scope !== spec) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim().replace(/\\\|/g, "|"));
    const m = cells.length >= 4 && cells[0].match(/^REQ-(\d{3})(?:\s*[–-]\s*(?:REQ-)?(\d{3}))?$/);
    if (!m) continue;
    for (const id of reqRange(m[1], m[2])) {
      const prev = out[id], row = { what: cells[1], code: cells[2], check: cells[3] };
      out[id] = prev ? { what: `${prev.what}; ${row.what}`, code: `${prev.code}; ${row.code}`, check: `${prev.check}; ${row.check}` } : row;
    }
  }
  return out;
}

// docs/SPEC_STATUS.md: the measured date, the summary table and each requirement's measured status.
function parseStatusDoc(md) {
  md = String(md || ""); if (!md) return null;
  const measured = (md.match(/Measured on (\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  const summary = [], reqs = {};
  for (const line of md.split("\n")) {
    const c = line.split("|").slice(1, -1).map((x) => x.trim());
    if (c.length === 4 && /^(Functional requirements|Acceptance scenarios|Success criteria) \(\d+\)$/.test(c[0])) summary.push({ part: c[0], passing: c[1], people: c[2], open: c[3] });
    if (c.length === 4 && /^REQ-\d{3}$/.test(c[0])) reqs[c[0]] = c[1];
  }
  const left = flat((md.match(/\*\*What's left[^*]*\*\*([^\n]+)/) || [])[1]);
  return { measured, summary, reqs, left };
}

// Everything the view needs except tracker issues. Reads the repo's files when they're there, else the build snapshot.
function collect({ root } = {}) {
  const base = root || ROOT, specsDir = path.join(base, "specs");
  if (!fs.existsSync(specsDir)) {
    try { return { ...JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")), source: "snapshot" }; }
    catch { return { specs: [], reqs: [], status: null, people: [], source: "missing" }; }
  }
  const rd = (rel) => { try { return fs.readFileSync(path.join(base, rel), "utf8"); } catch { return null; } };
  const trace = parseTrace(rd("docs/SPEC_TRACE.md") || ""), status = parseStatusDoc(rd("docs/SPEC_STATUS.md"));
  let people = {}; try { people = JSON.parse(rd("modules/project/sync.json") || "{}").people || {}; } catch {}
  const specs = [], reqs = [];
  for (const dir of fs.readdirSync(specsDir).filter((d) => /^\d{3}-/.test(d) && fs.statSync(path.join(specsDir, d)).isDirectory()).sort()) {
    const md = rd(`specs/${dir}/spec.md`); if (!md) continue;
    const s = parseSpec(md), tasks = parseTasks(rd(`specs/${dir}/tasks.md`) || ""), id = dir.slice(0, 3);
    const scopedTrace = parseTrace(rd("docs/SPEC_TRACE.md") || "", id);
    for (const r of s.reqs) {
      const ts = tasks.filter((t) => t.reqs.includes(r.id));
      reqs.push({ id: r.id, spec: id, text: r.text, level: r.level, status: s.status,
        trace: scopedTrace[r.id] ? { code: scopedTrace[r.id].code, check: scopedTrace[r.id].check } : null,
        tasks: ts.map(({ id: tid, who, done, text }) => ({ id: tid, who, done, text })), open: ts.filter((t) => !t.done).length, done: ts.filter((t) => t.done).length,
        people: people[r.id] || null, measured: status?.reqs[r.id] || null });
    }
    const mine = reqs.filter((r) => r.spec === id);
    specs.push({ id, dir, title: s.title, status: s.status, statusLine: s.statusLine,
      totals: { reqs: mine.length, must: mine.filter((r) => r.level === "MUST").length, should: mine.filter((r) => r.level === "SHOULD").length,
        traced: mine.filter((r) => r.trace).length, tasks: tasks.length, open: tasks.filter((t) => !t.done).length, done: tasks.filter((t) => t.done).length },
      unlinkedTasks: tasks.filter((t) => !t.reqs.length).map(({ id: tid, who, done, text }) => ({ id: tid, who, done, text })) });
  }
  return { specs, reqs, status: status && { measured: status.measured, summary: status.summary, left: status.left },
    people: Object.entries(people).filter(([k]) => !/^REQ-/.test(k)).map(([id, text]) => ({ id, text })), source: "files" };
}

function writeSnapshot() {
  const { source, ...data } = collect();
  if (source !== "files") throw new Error("specs/ not found; nothing to snapshot");
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ about: "Generated by `npm run build` (scripts/spec-index.js) from specs/, docs/SPEC_TRACE.md, docs/SPEC_STATUS.md and sync.json, for deployments that don't bundle those files. Don't edit; git-ignored.", ...data }, null, 1) + "\n");
  return data;
}

module.exports = { parseSpec, parseStatus, parseTasks, parseTrace, parseStatusDoc, collect, writeSnapshot, SNAPSHOT };
