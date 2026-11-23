// Renders the scorecard (CONTRACT.md section 5) from criteria.json + evidence.json into REPORT.md.
"use strict";
const fs = require("fs");
const path = require("path");
const { decide } = require("./score");

const criteria = require("./criteria.json");
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, "evidence.json"), "utf8"));

const show = (v) => (v === null || v === undefined ? "unknown" : v);
const mark = (r) => (r === "pass" ? "PASS" : r === "fail" ? "FAIL" : "unknown");
const pct = (x) => (x === null || x === undefined ? "unknown" : `${Math.round(x * 100)}%`);

function render(result) {
  const [a, b] = result.builds;
  const out = [];
  out.push(`# Bake-off scorecard`, ``,
    `Generated from \`criteria.json\` and \`evidence.json\` by \`node bakeoff/report.js\`. Do not edit by hand.`, ``,
    `Every check is pass, fail or unknown. An unknown is never guessed: it widens the range a total can still reach.`, ``);

  const d = result.decision;
  out.push(`## Decision: ${d.status}`, ``, d.base ? `Base: **Build ${d.base}**. ${d.why}` : d.why, ``);
  if (d.needs && d.needs.length) out.push(`Still needed:`, ``, ...d.needs.map((n) => `- ${n}`), ``);

  out.push(`## Weighted scorecard`, ``,
    `| Criterion | Weight | Build A | Build B |`, `|---|---:|---|---|`);
  a.lines.forEach((la, i) => {
    const lb = b.lines[i];
    const cell = (l) => (l.points === null ? `unknown (${l.low}–${l.high})` : `${l.points}`);
    out.push(`| ${la.label} | ${la.weight} | ${cell(la)} | ${cell(lb)} |`);
  });
  out.push(`| **Total** | **100** | **${a.total ?? `${a.low}–${a.high}`}** | **${b.total ?? `${b.low}–${b.high}`}** |`, ``);

  out.push(`## Acceptance tests (on the deployed app only)`, ``,
    `| AT | Feature | Expected | A | B |`, `|---|---|---|---|---|`);
  const ra = a.lines.find((l) => l.id === "acceptance").detail.rows;
  const rb = b.lines.find((l) => l.id === "acceptance").detail.rows;
  ra.forEach((r, i) => out.push(`| ${r.id} | ${r.feature} | ${r.expected} | ${mark(r.result)} | ${mark(rb[i].result)} |`));
  out.push(``);
  const notes = [...ra.map((r) => ["A", r]), ...rb.map((r) => ["B", r])].filter(([, r]) => r.notes.length);
  if (notes.length) {
    out.push(`Notes that do not count toward the score (self-tests, probes):`, ``);
    for (const [id, r] of notes) for (const n of r.notes) out.push(`- ${id} ${r.id}: ${n}`);
    out.push(``);
  }

  out.push(`## Relevance sample`, ``);
  for (const build of result.builds) {
    const rel = build.lines.find((l) => l.id === "relevance").detail;
    const s = (evidence.relevance || {})[build.id] || {};
    out.push(`### Build ${build.id}`, ``,
      `Sampled ${rel.sampled} of ${rel.need} · judged by both partners ${rel.judged} · on-topic ${pct(rel.value)} · target 90%: ${show(rel.meetsTarget)}`, ``,
      `Rule pre-check (a hint, never a score): ${pct(rel.hint)} of sampled titles match an ontology topic.`, ``);
    if ((s.stories || []).length) {
      out.push(`| # | Story | Rule topics | John | Matt |`, `|---:|---|---|---|---|`);
      s.stories.forEach((st, i) => out.push(`| ${i + 1} | ${st.title.replace(/\|/g, "/")} | ${(st.ruleTopics || []).join(", ") || "none"} | ${show(st.judges.john)} | ${show(st.judges.matt)} |`));
      out.push(``);
    }
  }

  out.push(`## How to fill in the unknowns`, ``,
    `1. Run each AT on the deployed app and add \`{ "build", "at", "on": "deployed", "result": "pass" | "fail", "by", "date", "note" }\` to \`evidence.acceptance\`.`,
    `2. In \`evidence.relevance.<build>.stories\`, set each \`judges.john\` and \`judges.matt\` to true (on-topic) or false.`,
    `3. Set \`evidence.manual.<build>.<criterion>.value\` to a number from 0 to 1 for security, maintainability, effort and usability, with a note.`,
    `4. Run \`node bakeoff/report.js\` again.`, ``);
  return out.join("\n");
}

if (require.main === module) {
  const result = decide(criteria, evidence);
  fs.writeFileSync(path.join(__dirname, "REPORT.md"), render(result));
  const [a, b] = result.builds;
  console.log(`A ${a.total ?? `${a.low}-${a.high}`} · B ${b.total ?? `${b.low}-${b.high}`} · ${result.decision.status}: ${result.decision.why}`);
}

module.exports = { render };
