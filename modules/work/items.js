// Work items (REQ-068, proposed): every task the repo plans, from Spec Kit (specs/<nnn>/tasks.md) and OpenSpec
// changes (openspec/changes/<id>/tasks.md), in one shape:
//   { key, source, spec|change, id, who, reqs, done, text, files, areas, phase, dependsOn, blockedBy }
// Pure parsers plus one reader of the repo. Dependencies come from what the files already say: a Spec Kit gate
// ("Nothing below starts until T600 is done"), an OpenSpec "Gate" section (later sections wait for its open tasks),
// and "after T123" / "after 2.1" in a task's text.
const fs = require("node:fs"), path = require("node:path");
const S = require("../project/specs");
const ROOT = path.join(__dirname, "..", "..");
const WHO = ["agent", "rules", "people"];
const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();

// "(modules/responses/plan.js, test/x.js)" or "(`modules/graph/`)" at the end of a task → paths.
function filesIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\(([^()]+)\)/g))
    for (const part of m[1].split(/[,;]| and /)) {
      const p = part.trim().replace(/^`|`$/g, "").replace(/\s.*$/, "");
      if (/^[\w.@-]+(\/[\w.*@{}-]*)+$|^[\w-]+\.(js|mjs|json|md|html|ttl|py|yaml|sql)$/.test(p) && !/^https?:/.test(p)) out.add(p);
    }
  for (const m of String(text).matchAll(/`([\w.@-]+\/[\w./*@-]+)`/g)) out.add(m[1]);
  return [...out];
}
// The part of the repo a path belongs to: modules/<id>, specs/<nnn>, openspec, docs, test, scripts, lib, ...
const areaOf = (p) => { const s = String(p).split("/"); return ["modules", "specs", "agent-kit"].includes(s[0]) && s[1] ? `${s[0]}/${s[1]}` : s[0]; };
const depsIn = (text) => [...String(text).matchAll(/\bafter (T\d{3}|\d+\.\d+)\b/gi)].map((m) => m[1]);

function fromSpecKit(md, spec) {
  const tasks = S.gateTasks(md, S.parseTasks(md), spec);
  const lines = String(md).split("\n"); let phase = 0; const phaseOf = {};
  for (const l of lines) { if (/^## /.test(l)) phase++; const m = l.match(/^- \[[ xX]\] (T\d{3})/); if (m) phaseOf[m[1]] = phase; }
  return tasks.map((t) => {
    const files = filesIn(t.text);
    return { key: `spec:${spec}/${t.id}`, source: "speckit", spec, id: t.id, who: t.who, reqs: t.reqs, done: t.done, text: t.text, files, areas: [...new Set(files.map(areaOf))],
      phase: phaseOf[t.id] || 0, dependsOn: [...(t.blockedBy ? [`spec:${t.blockedBy}`] : []), ...depsIn(t.text).filter((d) => /^T/.test(d)).map((d) => `spec:${spec}/${d}`)] };
  });
}

// "- [ ] 2.1 [people] text" under "## 2. Gate for phase 2"
function fromOpenSpec(md, change, reqs = []) {
  const out = []; let section = 0, title = "", gates = [];
  for (const l of String(md).split("\n")) {
    const h = l.match(/^## (\d+)\.\s*(.*)$/); if (h) { section = +h[1]; title = h[2]; continue; }
    const m = l.match(/^- \[( |x|X)\] (\d+\.\d+)((?: \[[^\]]+\])*) (.+)$/); if (!m) continue;
    const tags = [...m[3].matchAll(/\[([^\]]+)\]/g)].map((t) => t[1]), text = flat(m[4]), files = filesIn(text), done = m[1] !== " ";
    const own = tags.filter((t) => /^REQ-\d{3}$/.test(t)), key = `change:${change}/${m[2]}`;
    const t = { key, source: "openspec", change, id: m[2], who: tags.find((x) => WHO.includes(x)) || "agent", reqs: own.length ? own : reqs, done, text, files, areas: [...new Set(files.map(areaOf))],
      phase: section, dependsOn: [...gates.filter((g) => g.section < section).map((g) => g.key), ...depsIn(text).filter((d) => /\./.test(d)).map((d) => `change:${change}/${d}`)] };
    if (/\bgate\b/i.test(title) && !done) gates.push({ key, section });
    out.push(t);
  }
  return out;
}

// Every item, with blockedBy = the dependencies that aren't done yet, and blocks = the open items waiting on it.
function link(items) {
  const by = new Map(items.map((i) => [i.key, i]));
  for (const i of items) { i.blockedBy = i.done ? [] : i.dependsOn.filter((d) => by.has(d) && !by.get(d).done); i.blocks = []; }
  for (const i of items) for (const d of i.dependsOn) if (by.has(d) && !i.done) by.get(d).blocks.push(i.key);
  return items;
}

function collect(root = ROOT) {
  const rd = (rel) => { try { return fs.readFileSync(path.join(root, rel), "utf8"); } catch { return null; } };
  const items = [];
  const specs = path.join(root, "specs");
  if (fs.existsSync(specs)) for (const dir of fs.readdirSync(specs).filter((d) => /^\d{3}-/.test(d)).sort()) { const md = rd(`specs/${dir}/tasks.md`); if (md) items.push(...fromSpecKit(md, dir.slice(0, 3))); }
  let caps = {}; try { caps = JSON.parse(rd("openspec/capabilities.json") || "{}").inChanges || {}; } catch {}
  const ch = path.join(root, "openspec", "changes");
  if (fs.existsSync(ch)) for (const id of fs.readdirSync(ch).filter((d) => d !== "archive").sort()) { const md = rd(`openspec/changes/${id}/tasks.md`); if (md) items.push(...fromOpenSpec(md, id, caps[id] || [])); }
  return link(items);
}

module.exports = { filesIn, areaOf, depsIn, fromSpecKit, fromOpenSpec, link, collect, WHO };
