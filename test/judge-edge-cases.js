#!/usr/bin/env node
// Review desk edge cases (bench/judge-edge-cases.json, synthetic test data): the behaviour we want from the judges,
// including known gaps in today's rules (proposed REQ-032..REQ-037, specs/003-judge-fidelity). Exit code:
//   - fails if a case marked "ok" breaks (a regression), or if the file is malformed;
//   - never fails because a "gap" case still fails (that's the backlog), but says so when a gap starts passing,
//     so its status can be flipped to "ok" and it becomes a regression check from then on.
//   node test/judge-edge-cases.js            --json   print the results as JSON (for scripts/project-sync.js)
const R = require("../modules/review/review");
const SET = require("../bench/judge-edge-cases.json");
const json = process.argv.includes("--json");

const BASE_TITLE = "Sample Paper (test data)";
function build(spec = {}) {
  let title = spec.title ?? BASE_TITLE, text = spec.text ?? SET.base;
  if (spec.replace) { const pairs = Array.isArray(spec.replace[0]) ? spec.replace : [spec.replace];
    for (const [from, to] of pairs) { if (!text.includes(from)) throw new Error(`replace target not in text: "${from}"`); text = text.replace(from, to); }
    text = text.replace(/ {2,}/g, (m, i) => (pairs.some(([f, t]) => t === "") ? " " : m)).replace(/ \./g, "."); }
  if (spec.append) text = `${text} ${spec.append}`;
  if (spec.longTail) { const filler = Array.from({ length: 900 }, (_, i) => `Sample filler sentence ${i + 1} of the test data.`).join(" "); text = `${text.replace(/Limitations:[^.]*\./, "").trim()} ${filler} ${spec.longTail}`; }
  return { kind: "paper", title, text };
}
const strip = (r) => JSON.stringify({ ...r, trace: undefined, ms: undefined });
function metric(name, input, r) {
  switch (name) {
    case "credibility": return r.credibility;
    case "score": return r.score;
    case "hype": return r.judges.find((j) => j.id === "hype").score;
    case "qid": return r.qid;
    case "survey": return r.survey ? 1 : 0;
    case "injection": return r.guards.find((g) => g.id === "prompt-injection").fired ? 1 : 0;
    case "dropped": return r.dropped.length;
    case "sentences": return R.sentences(input.text).length; // how many sentences the segmenter finds in the text
    case "claims": return r.claims.length; // claims found in the title and kept sentences
    case "backedClaims": return r.claims.filter((c) => c.level === "backed").length; // claims whose own sentence carries the evidence
    case "deterministic": return strip(R.review(input)) === strip(r) ? 1 : 0;
    case "notMajor": return r.verdict !== "major and credible" ? 1 : 0;
    // The review has no truncation flag today; a fix would add r.truncated (and a guard or reason saying so).
    case "truncatedReported": return r.truncated || (r.reasons || []).some((x) => /cut|truncat/i.test(x)) ? 1 : 0;
    default: throw new Error(`unknown metric ${name}`);
  }
}
const REL = { eq: (a, b) => a === b, le: (a, b) => a <= b, lt: (a, b) => a < b, ge: (a, b) => a >= b, gt: (a, b) => a > b };

const results = [];
for (const c of SET.cases) {
  if (!REL[c.check.rel]) throw new Error(`${c.id}: unknown relation ${c.check.rel}`);
  if (!["ok", "gap"].includes(c.status)) throw new Error(`${c.id}: status must be ok or gap`);
  const ia = build(c.a), ra = R.review(ia);
  let got, want;
  if (c.check.metric === "credibilityDelta") { const rb = R.review(build(c.b)); got = Math.abs(ra.credibility - rb.credibility); want = c.check.to; }
  else if (c.check.to !== undefined) { got = metric(c.check.metric, ia, ra); want = c.check.to; }
  else { const ib = build(c.b), rb = R.review(ib); got = metric(c.check.metric, ia, ra); want = metric(c.check.metric, ib, rb); }
  const pass = REL[c.check.rel](got, want);
  results.push({ id: c.id, stage: c.stage, req: c.req, status: c.status, pass, got, want, rel: c.check.rel, about: c.about });
}

const regressions = results.filter((x) => x.status === "ok" && !x.pass), fixed = results.filter((x) => x.status === "gap" && x.pass), gaps = results.filter((x) => x.status === "gap" && !x.pass);
if (json) { console.log(JSON.stringify({ version: SET.version, results, regressions: regressions.length, gaps: gaps.length, fixed: fixed.length }, null, 2)); process.exit(regressions.length ? 1 : 0); }
const show = (v) => (typeof v === "string" ? v.slice(0, 16) : v);
for (const x of results) console.log(`  ${x.pass ? "✓" : x.status === "gap" ? "·" : "✗"} [${x.stage}] ${x.about} (${x.id}: got ${show(x.got)}, want ${x.rel} ${show(x.want)})${x.status === "gap" && x.pass ? "  <- gap now passes: set status to ok" : ""}`);
console.log(`\njudge edge cases: ${results.length - regressions.length - gaps.length} passed, ${regressions.length} regressions, ${gaps.length} known gaps${fixed.length ? `, ${fixed.length} gaps now passing` : ""}`);
process.exit(regressions.length ? 1 : 0);
