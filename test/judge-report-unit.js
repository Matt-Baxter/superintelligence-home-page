#!/usr/bin/env node
// Judge report (scripts/judge-report.js, REQ-037) on synthetic items (test data): the half-open Border band
// T - m <= value < T + m, the counts per margin and the summary line.
const J = require("../scripts/judge-report");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const item = (i, credibility, score = 10) => ({ title: `Sample paper ${i} (test data)`, credibility, score, verdict: "minor" });

ok(J.isBorder(60, 60, 5), "a value exactly on a cutoff is borderline");
ok(!J.isBorder(65, 60, 5), "a value m above the cutoff is not borderline (the band is open at T + m)");
ok(J.isBorder(55, 60, 5), "a value m below the cutoff is borderline (the band is closed at T - m)");
ok(J.isBorder(64.9, 60, 5) && !J.isBorder(54.9, 60, 5), "the band edges fall on the right sides of T + m and T - m");
ok(!J.isBorder(NaN, 60, 5) && !J.isBorder(undefined, 60, 5), "a missing value is never borderline");
ok(J.CUTOFFS.map((c) => `${c.field}:${c.at}`).join(",") === "credibility:35,credibility:60,credibility:70,score:40,score:55", "the cutoffs are the verdict's and the dossier's");

const r = J.report([item(1, 60), item(2, 65), item(3, 57), item(4, 72, 52), item(5, 20)], 5, "test data");
const c60 = r.cutoffs.find((c) => c.field === "credibility" && c.cutoff === 60);
ok(c60.counts[3] === 2 && c60.counts[5] === 2 && c60.counts[8] === 3, "counts at credibility 60 for m = 3, 5, 8 follow the band rule");
ok(c60.borderline.map((b) => b.title).join("|") === "Sample paper 1 (test data)|Sample paper 3 (test data)", "the listing names the borderline items");
ok(r.cutoffs.find((c) => c.field === "score" && c.cutoff === 55).counts[5] === 1, "a score 3 below 55 is borderline");
ok(r.summary === "judge report: 5 items, 4 borderline at margin 5", "an item is counted once in the summary even when it is near two cutoffs");
ok(J.report([item(1, 60)], 3).summary === "judge report: 1 items, 1 borderline at margin 3" && J.report([], 5).borderline === 0, "the margin flag and an empty input");
ok(JSON.stringify(J.report([item(1, 61), item(2, 37)], 5)) === JSON.stringify(J.report([item(1, 61), item(2, 37)], 5)), "the report is deterministic");

console.log(`\njudge report unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
