#!/usr/bin/env node
// Two readings of one piece (modules/review/fulltext.js) and the event-report rubric (modules/review/review.js).
// Synthetic test data only: every text below is invented and labelled "Sample" / "test data".
const R = require("../modules/review/review"), F = require("../modules/review/fulltext");
const reader = require("../modules/responses/reader"), A = require("../modules/responses/analysis");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

const paperText = (absNum, bodyNum, withEnd = true) => `Sample: a careful agent study (test data)

Abstract
We study a sample self-improving agent on held-out tasks and find that our gate keeps ${absNum} of good updates while rejecting bad ones, across 5 seeds with 95% confidence intervals. Code is available at github.com/sample-org/sample.

1 Introduction
We propose a gate for self-improvement. We show that it keeps good updates and rejects harmful ones on held-out tasks.

2 Method
The gate compares each update with the incumbent on held-out tasks, with a sequential test. Compared with the greedy baseline, it rejects more harmful updates.

3 Experiments
Across 5 seeds the gate keeps ${bodyNum} of good updates (95% confidence interval 2.1 to 3.4 points). An ablation without the test keeps 61.0% of harmful updates.

4 Limitations
We only evaluated short tasks; the gate may not transfer to long-horizon work.
${withEnd ? "\n5 Conclusion\nThe gate keeps good updates and rejects harmful ones.\n\nReferences\n[1] Sample reference (test data)." : ""}`;
function readPaper(absNum, bodyNum, withEnd = true) {
  const doc = reader.fromText(paperText(absNum, bodyNum, withEnd), { title: "Sample: a careful agent study (test data)" });
  const abstractReview = R.review({ kind: "paper", title: doc.title, text: doc.abstract });
  return F.paper({ abstractReview, analysis: A.analyse(doc), doc, truncated: !withEnd });
}
const same = readPaper("92.5%", "92.5%"), again = readPaper("92.5%", "92.5%");
ok(JSON.stringify(same) === JSON.stringify(again), "the full-text reading is deterministic");
ok(same.abstractNumbers.traced === 1 && same.rigor > 0 && same.checks.includes("ablation") && same.checks.includes("variance"), `a sample paper's abstract number is found in its body and its checks are read from the body (rigor ${same.rigor})`);
const moved = readPaper("97.5%", "92.5%");
ok(moved.reasons.some((r) => /97\.5%/.test(r)) && !moved.agree, "an abstract number found nowhere in the body is reported when the abstract was judged credible");
ok(readPaper("97.5%", "92.5%", false).reasons.every((r) => !/found nowhere/.test(r)), "a cut-off text never reports a missing number");
ok(F.RULES.credibility && F.RULES.disagree && R.CRITERIA.fulltext === F.RULES, "the full-text rules are published with the criteria");

const md = reader.fromText("Source: https://example.org/sample\n# Sample paper (test data)\nURL: https://example.org/sample\n\n## 3 Results\nTable 1: Sample accuracy\n| Method | Accuracy |\n| --- | --- |\n| Ours | 92.5 |\n| Baseline | 80.1 |\n", {});
ok(md.tables.length === 1 && md.tables[0].rows.length === 3 && md.tables[0].caption === "Sample accuracy" && md.sections.some((s) => /^3 Results/.test(s.heading)), "markdown from a web reader keeps its headings and tables");
ok(A.analyse(reader.fromText("Abstract\nSample (test data): the gate improves accuracy by 38 points over the baseline on held-out tasks with five seeds.\n\n1 Results\nThe gate improves accuracy by 38 points.", {})).abstractNumbers.every((n) => n.inBody), "abstract numbers are traced by their digits (\"38 points\" in the body traces the abstract's figure)");

const event = R.review({ kind: "article", title: "Sample: a county board passes a data center rule (test data)", text: "The Sample County board voted 5 to 2 on Nov. 3 to approve Ordinance 2026-14, which requires new data centers to report water use. The board chair said the rule takes effect in January and will be reviewed every year. Two members said they would revisit it if costs rise. The text of the ordinance is posted on the county site.", sourceKind: "news" });
ok(event.rubric === "event" && event.credibility >= 70, `a careful event report is judged on how it reports the event (${event.rubric}, credibility ${event.credibility})`);
ok(JSON.stringify(event.judges.find((j) => j.id === "rigor").why.map((w) => w.factor)) === JSON.stringify(R.CRITERIA.event.checks.filter((c) => event.judges.find((j) => j.id === "rigor").why.some((w) => w.factor === c.label)).map((c) => c.label)), "the event checks it earned are the published ones");
const relay = R.review({ kind: "article", title: "Sample: a startup announces AGI (test data)", text: "Sample Labs announced on Nov. 3 that its system is superhuman at every task and that AGI is already here, its chief executive said. The company said the system will replace most jobs soon.", sourceKind: "news" });
ok(relay.credibility < 50, `relaying a claim of progress is not reported speech that earns trust (credibility ${relay.credibility})`);
const study = R.review({ kind: "article", title: "Sample: a study finds agents improve (test data)", text: "A new study by Sample University found that agents improved 12% on 300 tasks, the authors said. The paper has not been peer reviewed.", sourceKind: "news" });
ok(study.rubric !== "event", "an article about a study is judged as reporting on research, not as an event");
console.log(`\nfulltext unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
