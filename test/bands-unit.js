#!/usr/bin/env node
// Score bands (REQ-037, spec 003 T041/T042; modules/review/bands.js) on synthetic numbers and Sample texts (test data):
// half-open bands at the cutoff, at T - m and at T + m; exactly one band; one marker never jumps Low to High (hype
// fixed); the verdict rule copy matches review.js; review() reports bands and a borderline note without changing its
// verdict; the dossier counts only High papers as credible and only checks of credible papers as linked.
const B = require("../modules/review/bands");
const R = require("../modules/review/review");
const D = require("../modules/review/dossier");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

console.log("band(S, T, m)");
ok(B.MARGIN === 5 && 2 * B.MARGIN >= B.MAX_ONE_MARKER, `margin ${B.MARGIN}: 2m = ${2 * B.MARGIN} >= ${B.MAX_ONE_MARKER}, the largest one-marker credibility change`);
ok(B.MAX_ONE_MARKER === Math.ceil(Math.max(...R.MARKERS.map((x) => x.points)) / 2), `that change is ceil(largest marker weight / 2) = ceil(${Math.max(...R.MARKERS.map((x) => x.points))} / 2)`);
for (const T of [35, 60, 70, 40, 55]) {
  ok(B.band(T, T) === "border", `exactly on the cutoff ${T}: Border`);
  ok(B.band(T - 5, T) === "border" && B.band(T - 5.001, T) === "low" && B.band(T - 6, T) === "low", `T - m = ${T - 5} is Border, just below is Low`);
  ok(B.band(T + 5, T) === "high" && B.band(T + 4.999, T) === "border" && B.band(T + 4, T) === "border", `T + m = ${T + 5} is High, just below is Border`);
}
let one = true; for (let s = -10; s <= 110; s += 0.5) for (const T of [35, 60, 70]) for (const m of [1, 3, 5, 8]) {
  const b = B.band(s, T, m), n = [s < T - m, T - m <= s && s < T + m, s >= T + m].filter(Boolean).length;
  if (n !== 1 || !["low", "border", "high"].includes(b)) one = false; }
ok(one, "every score is in exactly one band (scores -10..110, step 0.5, m 1, 3, 5, 8)");
ok(B.band(NaN, 60) === null && B.band(undefined, 60) === null && B.band("60", 60) === null, "no number, no band");
let jump = false; for (let c = 0; c <= 100; c++) for (let d = -B.MAX_ONE_MARKER; d <= B.MAX_ONE_MARKER; d++) for (const T of [35, 60, 70]) {
  const a = B.band(c, T), b = B.band(c + d, T); if ((a === "low" && b === "high") || (a === "high" && b === "low")) jump = true; }
ok(!jump, "a change of at most 7 never moves Low to High or back at m = 5 (Judge.lean flip_low_not_high)");
ok(B.band(56, 60, 3) === "low" && B.band(63, 60, 3) === "high", "at m = 3 a change of 7 can jump Low to High (margin_3_can_jump: 56 -> 63)");
ok(B.label("border", 60) === "Border (60)" && B.describe("credibility", 58, 60) === "credibility 58 is within 5 of 60 (borderline from 55 up to 65)", "label and describe() text");

console.log("Verdict and review()");
let same = true; for (let s = 0; s <= 100; s++) for (let c = 0; c <= 100; c++) {
  const v = c < 35 ? "doubtful" : s >= 55 && c >= 60 ? "major and credible" : c >= 70 ? "solid, modest step" : s >= 40 ? "big if true" : "minor";
  if (v !== B.verdictOf(s, c)) same = false; }
const src = require("node:fs").readFileSync(require.resolve("../modules/review/review"), "utf8").match(/const verdict = ([^;]+);/);
ok(same && src && src[1].includes('credibility < 35 ? "doubtful" : score >= 55 && credibility >= 60 ? "major and credible" : credibility >= 70 ? "solid, modest step" : score >= 40 ? "big if true" : "minor"'), "bands.verdictOf is the same rule as review.js's verdict line");
const j58 = B.judge(50, 58), j70 = B.judge(10, 70), j58minor = B.judge(10, 58), j58comment = B.judge(10, 58, { kind: "comment" });
ok(j58.bands.credibility["60"] === "border" && j58.bands.credibility["35"] === "high" && j58.bands.score["55"] === "border" && j58.bands.score["40"] === "high", "bands per cutoff: credibility 58, score 50");
ok(j58.borderline && j58.verdictNote === "borderline: credibility 58 is within 5 of 60; score 50 is within 5 of 55", `verdict note names each cutoff that could flip the verdict: "${j58.verdictNote}"`);
ok(j70.verdictNote === "borderline: credibility 70 is within 5 of 70" && B.verdictOf(10, 70) === "solid, modest step", "exactly on 70: the verdict stays \"solid, modest step\" but is noted as borderline");
ok(j58minor.verdictNote === null && j58minor.borderline && j58minor.borderlineReasons[0].affects.join() === "dossier", "credibility 58 with a small score: the verdict can't flip (no note), but the dossier's credible test can");
ok(!j58comment.borderline, "...and for a comment, which no dossier counts as a paper, nothing is borderline");
ok(!B.judge(20, 100).borderline && B.judge(20, 100).verdictNote === null, "far from every cutoff: no note");
const r = R.review({ kind: "paper", title: "Sample Paper (test data)", text: "Sample abstract (test data). We trained a small model and compare it with a baseline. Accuracy rose 4% on 50 tasks." });
ok(r.bands && r.bands.credibility["60"] === B.band(r.credibility, 60) && typeof r.borderline === "boolean" && Array.isArray(r.borderlineReasons) && "verdictNote" in r, "review() returns bands, borderline, borderlineReasons and verdictNote");
ok(r.verdict === B.verdictOf(r.score, r.credibility), `review()'s verdict string is unchanged ("${r.verdict}")`);
const S = require("../modules/review/samples.json").samples;
ok(S.every((s) => { const x = R.review(s); return x.verdict === B.verdictOf(x.score, x.credibility) && JSON.stringify(x.bands) === JSON.stringify(B.judge(x.score, x.credibility, { kind: x.kind }).bands); }), "every sample: verdict and bands agree with bands.js");
ok(B.digest({ score: 10, credibility: 58 }) === "Border (60)" && B.digest({ score: 50, credibility: 58 }) === "Border (60, score 55)" && B.digest({ score: 10, credibility: 90 }) === "High (60)" && B.digest({ score: 10, credibility: 40 }) === "Low (60)", "digest Band column: Border (60), Border (60, score 55), High (60), Low (60)");

console.log("Dossier: only High counts (T041), only checks of credible papers link (T042)");
const doc = (i, cred) => ({ id: i, qid: `doc:bandsample${i}`, kind: "paper", title: `Sample paper ${i} (test data)`, url: `https://arxiv.org/abs/2611.1000${i}`, score: 20, credibility: cred, verdict: "minor", needs_person: 0, label: null, result: { survey: false, claims: [] } });
const ex = (id, url) => ({ id, title: `Sample check ${id}`, topics: ["topic:recursive-self-improvement"], source: url ? { title: "Sample paper", url } : null, verdict: { supported: true, text: "Supported at toy scale: x." } });
const dos = (docs, examples = []) => D.analyse({ topic: "recursive-self-improvement", ids: ["recursive-self-improvement"], docs, docEdges: [], stories: [] }, { examples });
ok(dos([doc(1, 60)]).counts.credible === 0 && dos([doc(1, 60)]).strength === "thin", "credibility exactly 60 is Border: not credible, rating thin");
ok(dos([doc(1, 64)]).counts.credible === 0 && dos([doc(1, 65)]).counts.credible === 1 && dos([doc(1, 65)]).strength === "early", "64 is Border, 65 (T + m) is High and credible: early");
ok(dos([doc(1, 55)]).counts.borderline === 1 && dos([doc(1, 54)]).counts.borderline === 0, "55 (T - m) is listed as borderline, 54 is Low and isn't");
const b2 = dos([doc(1, 70), doc(2, 58)]);
ok(b2.counts.credible === 1 && b2.counts.borderline === 1 && b2.strength === "early" && /1 borderline paper \(credibility 55 to 64\) not counted/.test(b2.why), `a Border paper never counts as credible: "${b2.why}"`);
const blog = D.blog(b2), posts = D.posts(b2);
ok(/## Borderline papers/.test(blog) && /Sample paper 2 \(test data\)\*\* \[\d+\]: credibility 58\/100/.test(blog) && /credibility 58\/100 \(borderline\)/.test(blog), "the blog lists the Border paper in a Borderline section and marks it in the paper list");
ok(posts.filter((p) => /Borderline, not counted as credible: "Sample paper 2 \(test data\)" \(58\/100\)/.test(p.text)).length === 2 && posts.every((p) => p.text.length && (!/Bluesky/.test(p.channel) || p.text.length <= 280)), "the LinkedIn and Substack drafts name it as borderline; the short post stays within 280");
// T042: two credible papers and a held-up toy check of a paper that isn't credible: still "early", not "some support".
const t42 = dos([doc(1, 80), doc(2, 75), doc(3, 58)], [ex("b", "https://arxiv.org/abs/2611.10003")]);
ok(t42.strength === "early" && t42.counts.linked === 0 && t42.counts.linkedOther === 1, `a held-up check of a Border paper doesn't lift early to some support (linked ${t42.counts.linked}, not counted ${t42.counts.linkedOther})`);
ok(/1 toy check of a paper that isn't credible not counted/.test(t42.why) && /a paper we don't count as credible/.test(D.blog(t42)), "...and the rating text and the blog say why");
const t42low = dos([doc(1, 80), doc(2, 75), doc(3, 30)], [ex("l", "https://arxiv.org/abs/2611.10003")]);
ok(t42low.strength === "early" && t42low.checks[0].tests === "not credible", "the same for a Low paper");
const t42ok = dos([doc(1, 80), doc(2, 75), doc(3, 58)], [ex("c", "https://arxiv.org/abs/2611.10001")]);
ok(t42ok.strength === "some support" && t42ok.counts.linked === 1 && t42ok.checks[0].tests === "credible", "a held-up check of a credible paper still lifts it to some support");
// Adding a Border paper (with or without a check citing it) never raises the rating once there is a paper.
let never = true; const rank = { "none yet": 0, thin: 1, early: 2, "some support": 3 };
for (const creds of [[30], [70], [70, 80], [58, 30], [90, 66]]) for (const withCheck of [false, true]) for (const extra of [55, 58, 60, 64]) {
  const base = creds.map((c, i) => doc(i + 1, c)), add = [...base, doc(9, extra)], exs = withCheck ? [ex("z", "https://arxiv.org/abs/2611.10009")] : [];
  if (rank[dos(add, exs).strength] > rank[dos(base, exs).strength]) never = false; }
ok(never, "adding a Border paper (55, 58, 60, 64), with or without a held-up check citing it, never raises the rating");

console.log(`\nbands unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
