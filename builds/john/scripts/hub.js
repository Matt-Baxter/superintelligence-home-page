#!/usr/bin/env node
// Hub: one generated page (docs/HUB.md) that indexes the repo's skills, specs, checks, measures, tips and open decisions,
// built from the files themselves so it can't drift. Edit the sources (SKILL.md, tasks.md, preflight.js, ...), not the hub.
//   node scripts/hub.js                 write docs/HUB.md (npm run hub)
//   node scripts/hub.js --check         fail if docs/HUB.md is stale or has a broken relative link (preflight runs this)
//   node scripts/hub.js --links [paths] report broken relative links in Markdown files (default: docs handoff agent-kit)
//   --out <file>                        write or check another file instead (links still resolve from docs/; for tests)
const fs = require("node:fs"), path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const P = path.posix;

// ---------- small helpers ----------
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const has = (root, rel) => fs.existsSync(path.join(root, rel));
const ls = (root, rel) => (has(root, rel) ? fs.readdirSync(path.join(root, rel)).sort() : []);
const fm = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---\n?/); const meta = {}; if (m) for (const l of m[1].split("\n")) { const i = l.indexOf(":"); if (i > 0 && !/^\s/.test(l)) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"(.*)"$/, "$1"); } return { meta, body: m ? text.slice(m[0].length) : text }; };
// Escape text for a Markdown table cell: no pipes, no newlines, and no bare <tags> outside code spans.
const cell = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").split(/(`[^`]*`)/).map((x, i) => (i % 2 ? x : x.replace(/</g, "&lt;"))).join("").trim();
const plain = (s) => String(s ?? "").split(/(`[^`]*`)/).map((x, i) => (i % 2 ? x : x.replace(/<(?=[a-z/])/gi, "&lt;"))).join("");
const sentence = (s, max = 170) => { s = String(s || "").replace(/\s+/g, " ").trim(); const m = s.match(/^.+?[.!?](?=\s|$)/); let out = m && m[0].length >= 20 ? m[0] : s; if (out.length > max) out = out.slice(0, max - 1).replace(/\s+\S*$/, "") + "…"; return out; };
const before = (s, re) => { const i = s.search(re); return i > 0 ? s.slice(0, i).trim() : s; };
const h1 = (text) => (text.match(/^# (.+)$/m) || [])[1]?.trim() || "";
// First prose line under the title, before the first "##" section (skips bylines, metadata, lists, tables, quotes and code);
// a file that opens straight into sections is summarised by their headings.
function lede(text) {
  const { body } = fm(text), lines = body.split("\n"); let fence = false, skip = false; const para = [];
  for (const raw of lines) { const l = raw.trim();
    if (/^## /.test(l)) break;
    if (l.startsWith("```")) { fence = !fence; continue; }
    if (!l) { if (para.length) break; skip = false; continue; }
    if (fence || skip) continue;
    if (!para.length && (/^(#|\||<!--|>|---|[-*] |\d+\. )/.test(l) || /^\*\*[^*]+(:\*\*|\*\*:)/.test(l) || /^John Affolter/.test(l) || (/ · /.test(l) && l.length < 100))) { skip = !/^#/.test(l); continue; }
    para.push(l);
  }
  if (para.length) return para.join(" ");
  const h2 = lines.map((l) => (l.match(/^## (.+)$/) || [])[1]).filter(Boolean);
  return h2.length ? `Sections: ${h2.slice(0, 6).join("; ")}${h2.length > 6 ? "; …" : "."}` : "";
}

// The body of the section under a heading matching re (until the next heading of the same or higher level).
function sections(text, re) {
  const lines = text.split("\n"), out = [];
  for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{1,6}) (.+)$/); if (!m || !re.test(m[2])) continue;
    const lvl = m[1].length, body = []; for (let j = i + 1; j < lines.length; j++) { const n = lines[j].match(/^(#{1,6}) /); if (n && n[1].length <= lvl) break; body.push(lines[j]); }
    out.push({ heading: m[2].trim(), body: body.join("\n") });
  }
  return out;
}

// ---------- links ----------
// Rewrite relative links in text quoted from `fromRel` so they resolve from docs/ (where the hub lives).
const rebase = (text, fromRel) => text.replace(/\]\(([^)\s]+)\)/g, (all, t) => {
  if (/^([a-z]+:|#|\/)/i.test(t)) return all; const [p, a] = t.split("#");
  const abs = P.normalize(P.join(P.dirname(fromRel), p)); return `](${P.relative("docs", abs) || "."}${a ? "#" + a : ""})`;
});
// Every relative link in a Markdown text whose target doesn't exist, resolved from baseDir. Code spans and fences are skipped.
function brokenLinks(text, baseDir) {
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const bad = [];
  for (const m of prose.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const t = m[1].replace(/^<|>$/g, ""); if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(t)) continue;
    const p = decodeURIComponent(t.split("#")[0].split("?")[0]); if (!p) continue;
    if (!fs.existsSync(path.resolve(baseDir, p))) bad.push(t);
  }
  return [...new Set(bad)];
}
function markdownFiles(root, rels) {
  const out = [];
  const walk = (rel) => { const abs = path.join(root, rel); if (!fs.existsSync(abs)) return; const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) return; if (st.isDirectory()) { for (const f of fs.readdirSync(abs).sort()) if (f !== "node_modules") walk(P.join(rel, f)); } else if (rel.endsWith(".md")) out.push(rel); };
  for (const r of rels) walk(r);
  return out;
}

// ---------- collectors ----------
function collect(root) {
  const L = (rel, text) => `[${text ?? rel}](${P.relative("docs", rel) || "."})`;
  const out = { L };

  // Rules: the bold lead of each hard rule in AGENTS.md.
  const agentsMd = read(root, "AGENTS.md");
  out.rules = (sections(agentsMd, /^Hard rules$/)[0]?.body || "").split("\n").map((l) => (l.match(/^- \*\*(.+?)\*\*/) || [])[1]).filter(Boolean).map((r) => r.replace(/[:.]$/, ""));
  const handoff = read(root, "handoff/README.md");
  const who = handoff.match(/\*\*Matt builds with ([^*]+)\*\*[^*]*\*\*John builds with ([^*]+)\*\*/);
  out.who = who ? { matt: who[1].trim(), john: who[2].trim() } : { matt: "Claude Code", john: "v0 or Codex" };

  // Specs.
  out.specs = ls(root, "specs").filter((d) => has(root, `specs/${d}/spec.md`)).map((d) => {
    const dir = `specs/${d}`, spec = read(root, `${dir}/spec.md`);
    const reqs = [...new Set([...spec.matchAll(/\*\*(REQ-\d{3})\*\*/g)].map((m) => m[1]))].sort();
    const status = (spec.match(/^\*\*Status\*\*:\s*(.+)$/m) || [])[1] || "";
    const docs = ["spec.md", "plan.md", "tasks.md", "research.md"].filter((f) => has(root, `${dir}/${f}`)).map((f) => L(`${dir}/${f}`, f.replace(/\.md$/, "")));
    for (const f of ls(root, `${dir}/checklists`)) docs.push(L(`${dir}/checklists/${f}`, `checklist: ${f.replace(/\.md$/, "")}`));
    const tasks = [];
    if (has(root, `${dir}/tasks.md`)) for (const m of read(root, `${dir}/tasks.md`).matchAll(/^- \[([ xX])\] (T\d+) \[(agent|rules|people)\](?: \[P\])? (?:\[(REQ-[^\]]+)\] )?(.+)$/gm))
      tasks.push({ done: m[1] !== " ", id: m[2], who: m[3], req: m[4] || "", text: m[5] });
    return { d, dir, title: h1(spec).replace(/^Feature Specification:\s*/, ""), status: sentence(status.replace(/\*\*/g, ""), 120), reqs, docs, tasks };
  });

  // Skills, references, subagents, Spec Kit commands.
  out.skills = ls(root, "agent-kit/skills").filter((d) => has(root, `agent-kit/skills/${d}/SKILL.md`)).map((d) => {
    const base = `agent-kit/skills/${d}`, { meta } = fm(read(root, `${base}/SKILL.md`));
    const refs = ls(root, `${base}/references`).filter((f) => f.endsWith(".md")).map((f) => { const t = read(root, `${base}/references/${f}`); return { f, rel: `${base}/references/${f}`, title: h1(t), line: rebase(sentence(lede(t), 130), `${base}/references/${f}`) }; });
    return { d, rel: `${base}/SKILL.md`, name: meta.name || d, what: before(meta.description || "", /\s(Use (when|first|before|after)|Use it)\b/), when: (meta.description || "").slice(before(meta.description || "", /\s(Use (when|first|before|after)|Use it)\b/).length).trim(), refs };
  });
  out.agents = ls(root, "agent-kit/agents").filter((f) => f.endsWith(".md")).map((f) => ({ rel: `agent-kit/agents/${f}`, ...fm(read(root, `agent-kit/agents/${f}`)).meta }));
  const speckit = [];
  for (const d of ls(root, ".claude/skills").filter((x) => x.startsWith("speckit-"))) if (has(root, `.claude/skills/${d}/SKILL.md`)) speckit.push({ name: d, rel: `.claude/skills/${d}/SKILL.md`, ...fm(read(root, `.claude/skills/${d}/SKILL.md`)).meta });
  for (const f of ls(root, ".claude/commands").filter((x) => /^speckit[.-].*\.md$/.test(x))) speckit.push({ name: f.replace(/\.md$/, "").replace(".", "-"), rel: `.claude/commands/${f}`, ...fm(read(root, `.claude/commands/${f}`)).meta });
  out.speckit = speckit;

  // Checks: every label preflight prints, with the comment above it.
  const pf = read(root, "scripts/preflight.js").split("\n"), checks = new Map(); let note = "", inBlock = false;
  for (const l of pf) {
    const c = l.match(/^\s*\/\/\s*(?:\d+[a-z0-9]*\.\s*)?(.+)$/);
    if (c) { if (!/^(Run:|Cheap checks|a contract reminder)/.test(c[1])) note = inBlock ? `${note} ${c[1]}` : c[1]; inBlock = true; continue; }
    inBlock = false;
    for (const m of l.matchAll(/\b(ok|fail|warn)\("([^"]+)"/g)) if (!checks.has(m[2])) checks.set(m[2], note);
  }
  const rows = [];
  for (const [name, a] of checks) { const about = sentence(a, 200); const prev = rows.at(-1); if (prev && prev.about === about) prev.names.push(name); else rows.push({ names: [name], about }); }
  out.checks = rows.map((r) => ({ name: r.names.join(" / "), about: r.about.replace(new RegExp(`^${r.names[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( reminder)?:\\s*`, "i"), "") }));

  // npm scripts with the purpose their target file states in its header comment.
  const pkg = JSON.parse(read(root, "package.json"));
  out.scripts = Object.entries(pkg.scripts || {}).map(([name, cmd]) => ({ name, cmd, about: cmd.split("&&").map((part) => purpose(root, part.trim())).filter(Boolean).join("; ") }));

  // Measures.
  const base = has(root, "bench/baseline.json") ? JSON.parse(read(root, "bench/baseline.json")) : { metrics: {} };
  const benchSrc = has(root, "scripts/bench.js") ? read(root, "scripts/bench.js") : "";
  const inCode = [...new Set([...benchSrc.matchAll(/"([a-z]+\.[a-z0-9_]+)":\s*\{\s*value:/g)].map((m) => m[1]))];
  out.metrics = Object.entries(base.metrics || {}).map(([k, m]) => ({ k, ...m }));
  out.metricsPending = inCode.filter((k) => !(k in (base.metrics || {})));
  out.baselineDate = base.updated || "";
  const J = (rel) => (has(root, rel) ? JSON.parse(read(root, rel)) : null);
  const edge = J("bench/judge-edge-cases.json"), fid = J("bench/fidelity-cases.json"), rev = J("bench/review-set.json");
  const tally = (xs, k) => xs.reduce((a, x) => ((a[x[k]] = (a[x[k]] || 0) + 1), a), {});
  out.sets = [];
  if (rev) out.sets.push({ rel: "bench/review-set.json", what: "Review desk benchmark set", count: `${rev.items.length} items (${rev.items.filter((i) => i.credible).length} credible, ${rev.items.filter((i) => !i.credible).length} not)`, run: "`npm run bench`" });
  if (edge) { const st = tally(edge.cases, "status"), sg = tally(edge.cases, "stage");
    out.sets.push({ rel: "bench/judge-edge-cases.json", what: `Judge edge cases (v${edge.version})`, count: `${edge.cases.length} cases: ${Object.entries(st).map(([k, v]) => `${v} ${k}`).join(", ")}; stages ${Object.entries(sg).sort().map(([k, v]) => `${k} ${v}`).join(", ")}`, run: "`node test/judge-edge-cases.js`" }); }
  if (fid) { const ps = (fid.sources || []).flatMap((s) => s.paraphrases || []), kd = tally(ps, "kind");
    out.sets.push({ rel: "bench/fidelity-cases.json", what: `Paraphrase-fidelity set (v${fid.version}, ${fid.req || ""})`, count: `${(fid.sources || []).length} sources, ${ps.length} paraphrases (${Object.entries(kd).map(([k, v]) => `${v} ${k}`).join(", ")}); checks: ${(fid.checks || []).join(", ")}`, run: "`node test/fidelity-unit.js`" }); }

  // Tips and pitfalls: quoted from the sections that collect them, deduplicated.
  const tipFiles = [...markdownFiles(root, ["agent-kit", "docs", "handoff"])].filter((f) => f !== "docs/HUB.md");
  const TIP = /pitfall|gotcha|watch for|habits|traps|known false|troubleshoot|^always$/i, seen = [];
  out.tips = [];
  for (const f of tipFiles) {
    const text = read(root, f);
    const secs = sections(text, TIP);
    for (const s of secs) {
      const items = [];
      for (const l of s.body.split("\n")) {
        const b = l.match(/^\s*[-*] (.+)$/); if (b) { items.push(b[1].trim()); continue; }
        const row = l.match(/^\|(.+)\|\s*$/); if (row && !/^\|\s*-/.test(l)) { const c = row[1].split("|").map((x) => x.trim()); if (/^(symptom|term|gate)$/i.test(c[0])) continue; items.push(c.length >= 3 ? `${c[0]}: ${c[1]}. **Fix:** ${c[2]}` : c.join(": ")); }
      }
      const kept = items.filter((t) => { const w = words(t); if (seen.some((x) => jaccard(x, w) >= 0.6)) return false; seen.push(w); return true; });
      if (kept.length) out.tips.push({ rel: f, heading: s.heading, items: kept.map((t) => rebase(t, f)) });
    }
  }

  // Where things live.
  const one = (rel) => { if (!has(root, rel)) return null; const t = read(root, rel); return { rel, what: rebase(sentence(lede(t) || h1(t), 150), rel) }; };
  out.where = [
    { group: "Shared (both humans change these)", files: ["specs/001-superintelligence-homepage/spec.md", ".specify/memory/constitution.md", "CONTRACT.md", "WORKING_AGREEMENT.md"].map(one).filter(Boolean) },
    { group: "Repo", files: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "CLAUDE.md", "AGENT_LOG.md"].map(one).filter(Boolean) },
    { group: "docs/", files: ls(root, "docs").filter((f) => f.endsWith(".md") && f !== "HUB.md").map((f) => one(`docs/${f}`)) },
    { group: "handoff/", files: markdownFiles(root, ["handoff"]).map(one) },
    { group: "Agent kit, measures, proofs", files: ["agent-kit/README.md", "agent-kit/ARCHITECTURE.md", "bench/README.md", "proofs/README.md"].map(one).filter(Boolean) },
  ];
  out.snapshots = ls(root, "docs/snapshots").filter((f) => f.endsWith(".md"));
  out.workflows = ls(root, ".github/workflows").filter((f) => /\.ya?ml$/.test(f));
  out.proofs = ls(root, "proofs").filter((f) => f !== "README.md");

  // Open decisions.
  const state = has(root, "handoff/STATE.md") ? read(root, "handoff/STATE.md") : "";
  out.stateDate = (state.match(/^# State on (\S+)/m) || [])[1] || "";
  out.decisions = (sections(state, /^Waiting for the humans$/)[0]?.body || "").split("\n").map((l) => (l.match(/^\d+\.\s+(.+)$/) || [])[1]).filter(Boolean).map((t) => rebase(t, "handoff/STATE.md"));
  return out;
}

const words = (s) => new Set(s.toLowerCase().replace(/[`*_[\]()]/g, " ").split(/[^a-z0-9#.-]+/).filter((w) => w.length > 2));
const jaccard = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n / (a.size + b.size - n || 1); };

// What an npm script's command does, from the header comment of the file it runs.
function purpose(root, part) {
  const m = part.match(/^node\s+(?:--[\w-]+\s+)*([\w./-]+\.m?js)\s*(.*)$/);
  if (!m) { const o = part.match(/--outfile=(\S+)/), e = part.match(/^(\w+)\s+(\S+)/); return o && e ? `${e[1]}: bundle ${e[2]} into ${o[1]}` : ""; }
  const [, file, args] = m; if (!has(root, file)) return "";
  const head = []; for (const l of read(root, file).split("\n").slice(0, 25)) { if (/^#!/.test(l)) continue; const c = l.match(/^\s*\/\/ ?(.*)$/); if (!c) break; head.push(c[1]); }
  const prose = []; for (const l of head) { if (/^\s+(node|-)\s/.test(l) || /^\s{2,}/.test(l)) break; prose.push(l); }
  const sub = args.replace(/--[\w-]+(=\S+)?/g, "").trim().split(/\s+/)[0];
  if (sub) for (const l of head) { const u = l.match(new RegExp(`node ${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+\\S+)*?\\s{2,}(.+)$`)); if (u) return u[1].trim(); }
  return sentence((prose.length ? prose : head).join(" "), 150).replace(/:$/, ".");
}

// ---------- render ----------
function render(root) {
  const c = collect(root), L = c.L, o = [];
  const push = (...x) => o.push(...x);
  const nTips = c.tips.reduce((a, t) => a + t.items.length, 0);
  push("# Hub: everything in one place", "",
    "<!-- generated by `npm run hub` (scripts/hub.js) from the repo itself; edit the sources, not this file. Preflight fails when it's stale. -->", "",
    `One page that points at every skill, spec, check, measure and pitfall in the repo. It is generated from the files it links to, so it can't drift: ${L("scripts/hub.js", "scripts/hub.js")} reads them, \`npm run hub\` rewrites this page, and preflight's **Hub** check fails when it is stale or a link breaks.`, "",
    `**Contents:** [Start here](#start-here) · [Specs](#specs) · [Skills (${c.skills.length})](#skills) · [Subagents (${c.agents.length})](#subagents) · [Spec Kit (${c.speckit.length})](#spec-kit-commands) · [Checks (${c.checks.length})](#checks) · [Measures (${c.metrics.length})](#measures) · [Tips and pitfalls (${nTips})](#tips-and-pitfalls) · [Where things live](#where-things-live) · [Open decisions](#open-decisions-for-the-humans)`, "");

  push("## Start here", "",
    `- **Who builds with what**: Matt builds with ${c.who.matt}; John builds with ${c.who.john} (${L("handoff/README.md", "handoff")}). Other agents (the paper watch, helpers) follow the same rules.`,
    `- **Rules for every agent**: ${L("AGENTS.md", "AGENTS.md")} (Codex and other tools read this one) and ${L("CLAUDE.md", "CLAUDE.md")} (Claude Code). In short: ${c.rules.join("; ")}.`,
    `- **Picking up work**: ${L("handoff/README.md", "handoff/README.md")}, then ${L("handoff/STATE.md", "STATE.md")}${c.stateDate ? ` (${c.stateDate})` : ""}, then an open task under [Specs](#specs), then the [skill](#skills) for the job. Name the REQ IDs in the commit; tick the task in the commit that finishes it.`,
    `- **Current project index**: ${L("docs/START_HERE.md", "START_HERE.md")} links current authority, measurements, app workspaces and audit findings.`,
    `- **Before handing work back**: \`npm run preflight\` (every [check](#checks) below) and \`npm test\` for bigger changes; report the exact lines (${L("agent-kit/skills/run-tests/SKILL.md", "run-tests")}).`,
    `- **Per tool**: Codex ${L("handoff/prompts/codex.md", "first message")}; v0 ${L("handoff/prompts/v0.md", "first message")} and ${L("docs/V0.md", "setup")}; any MCP client loads the skills from ${L("agent-kit/README.md", "the agent kit")}.`, "");

  push("## Specs", "", "| Spec | Status | Requirements | Files | Tasks (open / done) |", "| --- | --- | --- | --- | --- |");
  for (const s of c.specs) {
    const by = (w) => { const t = s.tasks.filter((x) => x.who === w); return t.length ? `${w} ${t.filter((x) => !x.done).length}/${t.filter((x) => x.done).length}` : ""; };
    const tasks = s.tasks.length ? `${s.tasks.filter((x) => !x.done).length} / ${s.tasks.filter((x) => x.done).length} (${["agent", "rules", "people"].map(by).filter(Boolean).join(", ")})` : "no tasks.md";
    push(`| ${L(s.dir + "/spec.md", s.d)}: ${cell(s.title)} | ${cell(s.status)} | ${s.reqs.length ? `${s.reqs[0]}..${s.reqs.at(-1)} (${s.reqs.length})` : "-"} | ${s.docs.join(" · ")} | ${tasks} |`);
  }
  push("", "Tags: `[agent]` any agent, unattended; `[rules]` changes scoring, only when a person asks; `[people]` the humans. Requirement traceability: " + L("docs/SPEC_TRACE.md", "SPEC_TRACE.md") + "; measured status: " + L("docs/SPEC_STATUS.md", "SPEC_STATUS.md") + "; this build's tables and routes: " + L("docs/INTERFACES.md", "INTERFACES.md") + ".", "");
  const open = c.specs.flatMap((s) => s.tasks.filter((t) => !t.done).map((t) => ({ ...t, s })));
  if (open.length) { push(`**Open tasks (${open.length})**`, ""); for (const t of open) push(`- ${L(t.s.dir + "/tasks.md", `${t.s.d.slice(0, 3)} ${t.id}`)} \`[${t.who}]\`${t.req ? ` ${t.req}` : ""}: ${plain(sentence(t.text, 150))}`); push(""); }

  push("## Skills", "", `Plain Markdown, any tool: open the one that fits, and its references only when it says to. The same list, with when-to-use text, is the index in ${L("AGENTS.md", "AGENTS.md")}.`, "");
  for (const s of c.skills) {
    push(`- **${L(s.rel, s.name)}**: ${plain(s.what)}`);
    for (const r of s.refs) push(`  - ${L(r.rel, `references/${r.f}`)}: ${plain(r.title)}${r.line && r.line !== r.title ? `. ${plain(r.line)}` : ""}`);
  }
  push("");

  push("## Subagents", "", "| Subagent | Does |", "| --- | --- |", ...c.agents.map((a) => `| ${L(a.rel, a.name)} | ${cell(before(a.description || "", /\sUse (when|after|before)\b/))} |`), "");

  push("## Spec Kit commands", "", `How a spec is produced: ${L(".specify/memory/constitution.md", "constitution")}, ${L(".specify/templates", "templates")}, the prompts we used (${L("docs/speckit-prompts.md", "speckit-prompts.md")}) and the ${L("agent-kit/skills/work-from-the-spec/SKILL.md", "work-from-the-spec")} skill. Run as \`/speckit-<name>\` in Claude Code.`, "", "| Command | Does |", "| --- | --- |",
    ...c.speckit.map((k) => `| ${L(k.rel, "/" + k.name)} | ${cell(k.description)} |`), "");

  push("## Checks", "", `\`npm run preflight\` runs every check below (${L("scripts/preflight.js", "scripts/preflight.js")}; also on \`git push\` and in ${L(".github/workflows/preflight.yml", "GitHub Actions")}). A ✗ fails the run; a ! is a reminder.`, "", "| Check | What it covers |", "| --- | --- |",
    ...c.checks.map((k) => `| ${cell(k.name)} | ${cell(k.about)} |`), "", "**npm scripts** (from package.json; the purpose is the header comment of the file each one runs)", "", "| Script | Purpose |", "| --- | --- |",
    ...c.scripts.map((s) => `| \`npm run ${s.name}\` | ${cell(s.about || "`" + s.cmd + "`")} |`), "");

  push("## Measures", "", `Benchmarks with a ratchet (${L("scripts/bench.js", "scripts/bench.js")}, ${L("bench/README.md", "bench/README.md")}): no metric may get worse than ${L("bench/baseline.json", "bench/baseline.json")}${c.baselineDate ? ` (updated ${c.baselineDate})` : ""} allows. "info" metrics are reported, never failed.`, "", "| Metric | Better | Baseline | What it measures |", "| --- | --- | --- | --- |",
    ...c.metrics.map((m) => `| \`${m.k}\` | ${m.better}${m.tol ? ` (tol ${m.tol})` : ""} | ${m.value} | ${cell(m.about)} |`));
  if (c.metricsPending.length) push("", `In scripts/bench.js but not yet in the baseline: ${c.metricsPending.map((k) => `\`${k}\``).join(", ")}.`);
  push("", "**Labelled sets** (synthetic test data)", "", "| Set | Size | Run |", "| --- | --- | --- |", ...c.sets.map((s) => `| ${L(s.rel, s.what)} | ${cell(s.count)} | ${s.run} |`), "");

  push("## Tips and pitfalls", "", "Quoted from the repo's own pitfall, trap, troubleshooting and habits sections (near-duplicates kept once, at their first source). Add new ones there, not here.", "");
  for (const t of c.tips) { push(`**${L(t.rel, `${t.rel.replace(/^agent-kit\/skills\//, "").replace(/\/references\//, " › ")}`)} › ${plain(t.heading)}**`, ""); for (const i of t.items) push(`- ${plain(i)}`); push(""); }

  push("## Where things live", "");
  for (const g of c.where) { push(`**${g.group}**`, ""); for (const f of g.files) push(`- ${L(f.rel, f.rel)}: ${plain(f.what)}`); push(""); }
  push(`**Also**: ${L("docs/snapshots", "docs/snapshots/")} (${c.snapshots.length} build snapshots), ${L("proofs", "proofs/")} (${c.proofs.map((f) => "`" + f + "`").join(", ")}), ${L(".github/workflows", "workflows")} (${c.workflows.map((f) => "`" + f + "`").join(", ")}), the codebase map (\`npm run codemap -- <question>\`) and the ${L("agent-kit/mcp/server.js", "MCP server")}.`, "");

  push("## Open decisions for the humans", "", `From ${L("handoff/STATE.md", "handoff/STATE.md")}${c.stateDate ? ` (${c.stateDate})` : ""}, "Waiting for the humans". Agents don't decide these.`, "", ...c.decisions.map((d, i) => `${i + 1}. ${plain(d)}`));
  const people = open.filter((t) => t.who === "people");
  if (people.length) push("", `Open \`[people]\` tasks: ${people.map((t) => L(t.s.dir + "/tasks.md", `${t.s.d.slice(0, 3)} ${t.id}`)).join(", ")}.`);
  push("");
  return o.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ---------- check ----------
function check(root, file) {
  const problems = [];
  if (!fs.existsSync(file)) return [`${path.relative(root, file)} is missing; run npm run hub`];
  const text = fs.readFileSync(file, "utf8");
  if (text !== render(root)) problems.push(`${path.relative(root, file) || file} is stale; run npm run hub`);
  for (const b of brokenLinks(text, path.join(root, "docs"))) problems.push(`broken link: ${b}`);
  return problems;
}

module.exports = { render, collect, check, brokenLinks, markdownFiles, rebase };

if (require.main === module) {
  const argv = process.argv.slice(2), oi = argv.indexOf("--out");
  const file = oi >= 0 ? path.resolve(argv[oi + 1]) : path.join(ROOT, "docs", "HUB.md");
  if (argv.includes("--check")) {
    const p = check(ROOT, file);
    if (p.length) { console.error(p.map((x) => "  - " + x).join("\n")); process.exit(1); }
    const c = collect(ROOT);
    console.log(`hub: current; ${c.skills.length} skills, ${c.specs.length} specs, ${c.checks.length} checks, ${c.metrics.length} metrics, ${c.tips.reduce((a, t) => a + t.items.length, 0)} tips, links OK`);
  } else if (argv.includes("--links")) {
    const rest = argv.slice(argv.indexOf("--links") + 1).filter((x) => !x.startsWith("--"));
    let n = 0;
    for (const f of markdownFiles(ROOT, rest.length ? rest : ["docs", "handoff", "agent-kit"])) for (const b of brokenLinks(read(ROOT, f), path.dirname(path.join(ROOT, f)))) { console.log(`${f}: ${b}`); n++; }
    console.log(`links: ${n} broken`); process.exit(n ? 1 : 0);
  } else {
    fs.writeFileSync(file, render(ROOT));
    console.log(`wrote ${path.relative(ROOT, file)}`);
  }
}
