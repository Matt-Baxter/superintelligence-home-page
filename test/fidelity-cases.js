#!/usr/bin/env node
// Paraphrase-fidelity catalogue (bench/fidelity-cases.json, synthetic test data) for the future
// fidelity(source, paraphrase) check (specs/003-judge-fidelity, REQ-033, task T020). This script only checks the
// file's shape and prints its counts; it does NOT implement the fidelity check. Exit code 1 on a malformed file.
//   node test/fidelity-cases.js              shape check and counts
//   node test/fidelity-cases.js --baseline   also: does today's Review desk give a paraphrase the same credibility as
//                                            its source? (information only, never fails)
const path = require("path");
const FILE = path.join(__dirname, "..", "bench", "fidelity-cases.json");
const errors = [];
const fail = (msg) => errors.push(msg);

let SET;
try { SET = require(FILE); } catch (e) { console.error(`fidelity cases: cannot read ${FILE}: ${e.message}`); process.exit(1); }

const list = (k) => (Array.isArray(SET[k]) && SET[k].length && SET[k].every((x) => typeof x === "string") ? SET[k] : (fail(`"${k}" must be a non-empty list of strings`), []));
const DEFECTS = new Set(list("defects")), CHECKS = new Set(list("checks")), REWORDINGS = new Set(list("rewordings"));
if (typeof SET.about !== "string" || !/synthetic/i.test(SET.about)) fail(`"about" must say the data is synthetic`);
const DC = SET.defectCheck || {};
for (const d of DEFECTS) if (!CHECKS.has(DC[d])) fail(`defectCheck["${d}"] must name one of the checks (got ${JSON.stringify(DC[d])})`);
for (const d of Object.keys(DC)) if (!DEFECTS.has(d)) fail(`defectCheck names unknown defect "${d}"`);

const ids = new Set(), byDefect = {}, byRewording = {}, byCheck = {};
let faithful = 0, unfaithful = 0;
const pairs = [];
const sample = (where, s) => { if (typeof s !== "string" || !s.includes("Sample")) fail(`${where}: text must be a string containing "Sample"`); };
const uniq = (id, where) => { if (typeof id !== "string" || !id) fail(`${where}: missing id`); else if (ids.has(id)) fail(`duplicate id "${id}"`); else ids.add(id); };

if (!Array.isArray(SET.sources) || !SET.sources.length) fail(`"sources" must be a non-empty list`);
for (const s of SET.sources || []) {
  uniq(s.id, "source"); sample(`${s.id} title`, s.title); sample(`${s.id} text`, s.text);
  if (!Array.isArray(s.paraphrases) || !s.paraphrases.length) { fail(`${s.id}: no paraphrases`); continue; }
  for (const p of s.paraphrases) {
    const at = `${s.id}/${p.id}`;
    uniq(p.id, at); sample(at, p.text);
    if (typeof p.why !== "string" || !p.why.trim()) fail(`${at}: missing "why"`);
    if (p.text === s.text) fail(`${at}: paraphrase is identical to its source`);
    const e = p.expect || {};
    if (typeof e.pass !== "boolean") fail(`${at}: expect.pass must be true or false`);
    if (p.kind === "faithful") {
      faithful++;
      if (p.defect !== null) fail(`${at}: a faithful paraphrase has defect null`);
      if (e.pass !== true) fail(`${at}: a faithful paraphrase must expect pass true`);
      if (e.check !== null) fail(`${at}: a faithful paraphrase has expect.check null`);
      if (!REWORDINGS.has(p.rewording)) fail(`${at}: rewording "${p.rewording}" is not in the rewordings list`);
      byRewording[p.rewording] = (byRewording[p.rewording] || 0) + 1;
    } else if (p.kind === "unfaithful") {
      unfaithful++;
      if (!DEFECTS.has(p.defect)) fail(`${at}: defect "${p.defect}" is not in the defects list`);
      if (e.pass !== false) fail(`${at}: an unfaithful paraphrase must expect pass false`);
      if (!CHECKS.has(e.check)) fail(`${at}: expect.check "${e.check}" is not in the checks list`);
      else if (DC[p.defect] && DC[p.defect] !== e.check) fail(`${at}: defect "${p.defect}" should fail check "${DC[p.defect]}", not "${e.check}"`);
      if (!("where" in p)) fail(`${at}: missing "where" (the source text concerned, or null for an addition)`);
      else if (p.where !== null && !(typeof p.where === "string" && s.text.includes(p.where))) fail(`${at}: "where" is not in the source text: ${JSON.stringify(p.where)}`);
      byDefect[p.defect] = (byDefect[p.defect] || 0) + 1;
      byCheck[e.check] = (byCheck[e.check] || 0) + 1;
    } else fail(`${at}: kind must be "faithful" or "unfaithful"`);
    pairs.push({ s, p });
  }
}
for (const d of DEFECTS) if (!byDefect[d]) fail(`no case for defect "${d}"`);
const total = faithful + unfaithful;
if (total < 40) fail(`need at least 40 paraphrases (have ${total})`);
if (total && (faithful / total < 0.35 || faithful / total > 0.65)) fail(`faithful share should be roughly half (have ${faithful} of ${total})`);

const row = (o) => Object.entries(o).sort().map(([k, n]) => `${k} ${n}`).join(", ");
console.log(`fidelity cases v${SET.version}: ${(SET.sources || []).length} sources, ${total} paraphrases (${faithful} faithful, ${unfaithful} unfaithful)`);
console.log(`  defects:    ${row(byDefect)}`);
console.log(`  checks:     ${row(byCheck)}`);
console.log(`  rewordings: ${row(byRewording)}`);

if (process.argv.includes("--baseline") && !errors.length) {
  // Information only: today's judge scores whatever text it gets, so this shows how often it can't tell a defect
  // apart from the source (same credibility) and how often a faithful rewording moves the score anyway.
  const R = require("../modules/review/review");
  const cred = (title, text) => R.review({ kind: "paper", title, text }).credibility;
  const blind = {}, moved = [];
  let blindN = 0;
  for (const { s, p } of pairs) {
    const a = cred(s.title, s.text), b = cred(s.title, p.text);
    if (p.kind === "unfaithful" && a === b) { blindN++; blind[p.defect] = (blind[p.defect] || 0) + 1; }
    if (p.kind === "faithful" && a !== b) moved.push(`${p.id} ${a}->${b}`);
    if (p.kind === "unfaithful" && a !== b) moved.push(`${p.id} ${a}->${b} (defect, so a change is fine)`);
  }
  console.log(`\nbaseline (today's Review desk, credibility of source vs paraphrase; information only):`);
  console.log(`  unfaithful with the same credibility as the source: ${blindN} of ${unfaithful} (${row(blind)})`);
  const fm = moved.filter((m) => !m.includes("defect"));
  console.log(`  faithful rewordings that moved credibility: ${fm.length} of ${faithful}${fm.length ? `: ${fm.join("; ")}` : ""}`);
  const um = moved.filter((m) => m.includes("defect"));
  if (um.length) console.log(`  unfaithful that moved credibility: ${um.map((m) => m.replace(" (defect, so a change is fine)", "")).join("; ")}`);
}

if (errors.length) { console.error(`\nfidelity cases: ${errors.length} problem(s) in ${path.relative(process.cwd(), FILE)}:`); for (const e of errors) console.error(`  ✗ ${e}`); process.exit(1); }
console.log(`\nfidelity cases: file ok (${total} cases)`);
