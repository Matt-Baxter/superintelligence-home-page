#!/usr/bin/env node
// fidelity(source, paraphrase) (modules/review/fidelity.js, REQ-033, T020) on every labelled pair in
// bench/fidelity-cases.json (synthetic test data), plus unit checks of its normalisers. Exit 1 on any miss.
//   node test/fidelity-unit.js           accuracy and misses
//   node test/fidelity-unit.js --cases   also one line per case
const F = require("../modules/review/fidelity"), SET = require("../bench/fidelity-cases.json");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c || process.argv.includes("--cases")) console.log(c ? "  ✓" : "  ✗", m); };

// Normalisers.
const q = (t) => F.quantities(t).map((x) => `${x.value}${x.unit ? " " + x.unit : ""}`).join(", ");
ok(q("forty-one and fifty-eight percent") === "41 %, 58 %", `number words and a range share the unit: ${q("forty-one and fifty-eight percent")}`);
ok(q("1,200 questions, 32 thousand tokens, a 40M-parameter model, 1B parameters") === "1200, 32000, 40000000, 1000000000", `separators and multipliers: ${q("1,200 questions, 32 thousand tokens, a 40M-parameter model, 1B parameters")}`);
ok(q("4 percentage points, 4 pp, 4%, 4 per cent") === "4 pp, 4 pp, 4 %, 4 %", "percentage points and pp are one unit, % and per cent another");
ok(q("3-5% and ~7%") === "3 %, 5 %, 7 %" && F.quantities("about 7%")[0].approx === "about", "ranges and approximations");
ok(q("no false alarms") === "0", "'no X' reads as zero X");
ok(q("Sample-Net-2 scores 5%") === "5 %", "a number glued to a name is part of the name");
ok(F.sentences("We follow Doe et al. 2026 here. Next, e.g. Fig. 2 shows it. Done.").length === 3, "et al., e.g. and Fig. don't end a sentence");
ok(F.stem("evaluation") === F.stem("evaluated") && F.stem("repairs") === F.stem("fixes"), "stems and synonyms meet");
ok(F.fidelity("Sample (test data). We do not evaluate on real data.", "Sample (test data). We evaluate on real data.").failed.includes("negation"), "a negation removed fails negation");
ok(F.fidelity("Sample (test data). Accuracy rose 3-5%.", "Sample (test data). Accuracy rose 3 to 5 pp.").failed.join() === "units", "a range's unit changed fails units only");
const same = F.fidelity("Sample (test data). We release Sample-Set. It may help.", "Sample (test data). We release Sample-Set. It may help.");
ok(same.pass && same.checks.length === 8 && same.checks.every((c) => F.CHECKS.includes(c.id)), "a copy passes all 8 checks, ids from the catalogue");
ok(JSON.stringify(F.fidelity(SET.sources[0].text, SET.sources[0].paraphrases[5].text)) === JSON.stringify(F.fidelity(SET.sources[0].text, SET.sources[0].paraphrases[5].text)), "deterministic");
ok(JSON.stringify(F.CHECKS) === JSON.stringify(SET.checks), "check ids match bench/fidelity-cases.json");

// Every labelled pair.
const ev = F.evaluate(SET);
for (const r of ev.rows) ok(r.right, `${r.id}: expect ${r.expect || "pass"}, failed [${r.failed.join(", ")}]`);
const pc = (x) => `${Math.round(x * 1000) / 10}%`;
console.log(`\nfidelity: ${ev.right} of ${ev.n} right (${pc(ev.accuracy)}); faithful pass ${pc(ev.faithfulPass)}, unfaithful caught ${pc(ev.unfaithfulCaught)}, expected check failed ${pc(ev.expectedCheck)}, only the expected check ${pc(ev.onlyExpected)}`);
if (ev.misses.length) console.log(`  misses: ${ev.misses.map((m) => `${m.id} (expect ${m.expect || "pass"}, got [${m.failed.join(", ")}])`).join("; ")}`);
if (ev.extra.length) console.log(`  also failed another check: ${ev.extra.map((m) => `${m.id} [${m.failed.join(", ")}]`).join("; ")}`);
console.log(`fidelity unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
