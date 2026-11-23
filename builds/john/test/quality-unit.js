#!/usr/bin/env node
// Quality report (scripts/quality.js) on synthetic review rows (test data): rank correlation is right, and each check
// fails exactly when the judging lumps pieces together or its parts disagree.
const Q = require("../scripts/quality");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
ok(Q.spearman([1, 2, 3, 4], [10, 20, 30, 40]) === 1 && Q.spearman([1, 2, 3, 4], [4, 3, 2, 1]) === -1 && Q.spearman([1, 2], [1, 2]) === null, "rank correlation: +1, -1, and none below 3 points");
const row = (kind, cred, verdict, grade, hype, panel) => ({ kind, title: `Sample ${kind} (test data)`, credibility: cred, verdict, result: { source: { grade }, judges: [{ id: "rigor", score: 50 }, { id: "hype", score: hype }], panel: panel ? { status: panel } : undefined } });
const lumped = Q.analyse([row("article", 50, "minor", "B", 0), row("article", 50, "minor", "D", 0), row("article", 51, "minor", "E", 0), row("paper", 60, "minor", "B", 0)]);
const c = (A, id) => A.checks.find((x) => x.id === id);
ok(!c(lumped, "verdict-spread").ok && !c(lumped, "article-spread").ok && !c(lumped, "papers-minor").ok && !c(lumped, "panel-coverage").ok, "lumped verdicts, bunched articles, papers all minor and no panel are each caught");
const good = Q.analyse([row("article", 80, "solid, modest step", "B", 0, "agreed"), row("article", 55, "plausible, worth checking", "C", 20, "agreed"), row("article", 20, "doubtful", "E", 80, "disagreed"), row("paper", 75, "solid, modest step", "B", 0, "agreed")]);
ok(good.checks.every((x) => x.ok), "spread verdicts, grade and credibility in step, hype against credibility, and a full panel all hold");
console.log(`\nquality unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
