#!/usr/bin/env node
// Agreement on blind labels (modules/review/agreement.js, REQ-027, REQ-029): Cohen's kappa against a worked example,
// its interval, the undefined case, and the stats people see on /m/labels. Labels here are synthetic test data.
const A = require("../modules/review/agreement");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const rep = (n, pair) => Array.from({ length: n }, () => pair);

// Worked example: 50 pieces; both yes 20, A yes B no 5, A no B yes 10, both no 15. po = .7, pe = .5*.6 + .5*.4 = .5, kappa = .4.
const k = A.kappa([...rep(20, ["yes", "yes"]), ...rep(5, ["yes", "no"]), ...rep(10, ["no", "yes"]), ...rep(15, ["no", "no"])]);
ok(k.n === 50 && k.agree === 0.7 && k.kappa === 0.4, `kappa matches the worked example (0.4 from 70% raw agreement; got ${k.kappa})`);
ok(k.low < 0.4 && k.high > 0.4 && k.low > 0.1 && k.high < 0.7, `the 95% interval brackets it (${k.low} to ${k.high})`);
ok(A.kappa(rep(10, ["yes", "yes"])).kappa === null && /undefined/.test(A.kappa(rep(10, ["yes", "yes"])).why), "two raters who always say yes: kappa is undefined, and says why");
ok(A.kappa([["yes", "no"]]).kappa === null, "one pair: nothing to say");
ok(A.kappa([...rep(10, ["yes", "no"]), ...rep(10, ["no", "yes"])]).kappa === -1, "always opposite: kappa -1");
ok(A.reading(0.4) === "moderate" && A.reading(0.85) === "almost perfect" && A.reading(-0.1) === "worse than chance" && A.reading(null) === "not enough labels yet", "kappa is read in plain words (Landis and Koch's bands)");
ok(A.judgeLabel("doubtful") === "no" && A.judgeLabel("withdrawn") === "no" && A.judgeLabel("minor") === "yes" && A.judgeLabel("solid, modest step") === "yes", "the judge says no exactly when its verdict is doubtful or withdrawn");

// Two people and the judge on six pieces (synthetic).
const rows = [];
const add = (doc, verdict, john, matt) => { rows.push({ doc, verdict, user: 1, name: "Sample Labeller A", credible: john }); if (matt) rows.push({ doc, verdict, user: 2, name: "Sample Labeller B", credible: matt }); };
add(1, "solid, modest step", "yes", "yes"); add(2, "doubtful", "no", "no"); add(3, "doubtful", "no", "yes"); add(4, "minor", "yes", "unsure"); add(5, "solid, modest step", "yes", "yes"); add(6, "doubtful", "no");
const s = A.stats(rows);
ok(s.pieces === 6 && s.people.length === 2 && s.people[1].unsure === 1, "counts pieces, people and unsure answers");
ok(s.pairs.length === 1 && s.pairs[0].n === 4 && s.pairs[0].agree === 0.75, "people against each other: only pieces both answered yes or no (4), 75% agree");
ok(s.judge[0].n === 6 && s.judge[0].agree === 1 && s.judge[1].n === 4 && s.judge[1].agree === 0.75, "the judge against each person");
ok(s.majority.n === 5, "the majority leaves out ties (piece 3) and keeps pieces one person labelled");
ok(s.shared === 4 && s.notes.some((n) => /aim for at least 30/.test(n)), "with fewer than 30 shared pieces it says so");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
