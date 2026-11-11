#!/usr/bin/env node
// Research loop for the Machine-checked signal (modules/verification/rules.json), a ratchet like the Lab's:
//   hypothesis  an edit to the rules (add a pattern, drop one, toggle an option, change the context window)
//   experiment  score the edited rules on the TRAIN split, with harmless rewordings of each item (modules/verification/evaluate.js)
//   keep        the single best edit per round, only if it strictly raises the train objective; stop when none does
//   accept      the tuned rules only if the HELD-OUT split's objective doesn't drop, its balanced rung accuracy doesn't
//               drop and every rung that occurs is still recognised (the accuracy paradox guard, lib/metrics.js);
//               held-out never picks an edit
// Deterministic, no model calls. Ties go to the edit listed first in CANDIDATES.
//   npm run verification:ratchet             report what the loop would change (writes nothing)
//   npm run verification:ratchet -- --apply  also write rules.json when the held-out gate passes
//   npm run verification:ratchet -- --json   machine-readable report
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), RULES = path.join(root, "modules", "verification", "rules.json");
const { score } = require("../modules/verification/evaluate");
const args = process.argv.slice(2), has = (f) => args.includes(f);

// The space of hypotheses. General patterns sit beside narrow ones and deliberately noisy ones ("lean" on its own,
// "verified", "formal"), so the loop has to show it can tell them apart from the labels, not from our intent.
const CANDIDATES = [
  { list: "formal", add: "lean (statements?|theorems?|developments?|files?|projects?|results?)" },
  { list: "formal", add: "lean (statements?)" },
  { list: "formal", add: "lean" },
  { list: "formal", add: "verified" },
  { list: "contextual", add: "formal" },
  { list: "formal", add: "lean prover" },
  { list: "reference", add: "lean4checker passes" },
  { list: "reference", add: "no sorry" },
  { list: "outside", add: "researchers (say|report|find|found)" },
  { list: "outside", add: "(second|another) group" },
  { list: "gap", add: "less strong" },
  { list: "gap", add: "weaker than claimed" },
  { list: "context", add: "results?" },
  { option: "gap_counts_as_reference", value: false },
  { option: "gap_counts_as_reference", value: true },
  { window: 40 }, { window: 120 },
];
const clone = (x) => JSON.parse(JSON.stringify(x));
function apply(rules, e) {
  const r = clone(rules);
  if (e.list) { if ((r[e.list] || []).includes(e.add)) return null; r[e.list] = [...(r[e.list] || []), e.add]; }
  else if (e.drop) { if (!(r[e.drop] || []).includes(e.pattern)) return null; r[e.drop] = r[e.drop].filter((x) => x !== e.pattern); }
  else if (e.option) { if ((r.options || {})[e.option] === e.value) return null; r.options = { ...(r.options || {}), [e.option]: e.value }; }
  else if (e.window) { if (r.context_window === e.window) return null; r.context_window = e.window; }
  return r;
}
const label = (e) => e.list ? `add to ${e.list}: /${e.add}/` : e.drop ? `drop from ${e.drop}: /${e.pattern}/` : e.option ? `set ${e.option} = ${e.value}` : `context window = ${e.window}`;

function run(start, items, { rounds = 10 } = {}) {
  const train = items.filter((x) => x.split === "train"), held = items.filter((x) => x.split === "heldout");
  // Dropping an existing pattern is a hypothesis too.
  const drops = ["formal", "contextual", "reference", "outside", "gap"].flatMap((l) => (start[l] || []).map((p) => ({ drop: l, pattern: p })));
  let rules = clone(start), cur = score(rules, train, { augment: true }).metrics.objective;
  const log = [];
  for (let i = 0; i < rounds; i++) {
    let best = null;
    for (const e of [...CANDIDATES, ...drops]) {
      const r = apply(rules, e); if (!r) continue;
      const s = score(r, train, { augment: true }).metrics.objective;
      if (s > cur + 1e-9 && (!best || s > best.s)) best = { e, r, s };
    }
    const tried = CANDIDATES.length + drops.length;
    if (!best) { log.push({ round: i + 1, tried, kept: null, train: cur }); break; }
    log.push({ round: i + 1, tried, kept: label(best.e), train: best.s, gain: Math.round((best.s - cur) * 1000) / 1000 });
    rules = best.r; cur = best.s;
  }
  const before = { train: score(start, train, { augment: true }).metrics, heldout: score(start, held).metrics };
  const after = { train: score(rules, train, { augment: true }).metrics, heldout: score(rules, held).metrics };
  const changed = JSON.stringify(rules) !== JSON.stringify(start);
  // Held-out gate: the objective may not drop, and neither may the balanced view of it (no drifting toward the common
  // rung while plain accuracy holds), and no rung that occurs may become unrecognised (lib/metrics.js).
  const gate = heldoutGate(before.heldout, after.heldout, changed), accepted = gate.accepted;
  return { rules, log, before, after, changed, accepted, gate, heldoutMisses: score(accepted ? rules : start, held).misses };
}

// The held-out gate as a pure function, so it can be tested on its own (test/metrics-property-unit.js).
function heldoutGate(before, after, changed) {
  if (!changed) return { accepted: false, reasons: ["no edit improved train"] };
  // Refuse on anything unmeasured: an empty held-out split, or a metric missing on either side, is not a pass.
  const missing = ["objective", "rung_balanced"].filter((k) => !Number.isFinite(before?.[k]) || !Number.isFinite(after?.[k]));
  if (missing.length) return { accepted: false, reasons: [`held-out ${missing.join(" and ")} not measured on both sides`] };
  const reasons = [];
  if (after.objective < before.objective) reasons.push(`objective ${before.objective} -> ${after.objective}`);
  if (after.rung_balanced < before.rung_balanced) reasons.push(`balanced rung accuracy ${before.rung_balanced} -> ${after.rung_balanced} (accuracy paradox)`);
  if (before.rung_paradox_free && !after.rung_paradox_free) reasons.push("a rung that occurs is no longer recognised, or the gain is no better than a majority guess");
  return { accepted: !reasons.length, reasons };
}

if (require.main === module) {
  const start = JSON.parse(fs.readFileSync(RULES, "utf8"));
  const items = JSON.parse(fs.readFileSync(path.join(root, "bench", "verification-set.json"), "utf8")).items;
  const r = run(start, items);
  if (has("--json")) console.log(JSON.stringify({ ...r, rules: undefined }, null, 2));
  else {
    for (const l of r.log) console.log(`round ${l.round}: ${l.tried} hypotheses tried; ${l.kept ? `kept "${l.kept}" (train objective ${l.train}, +${l.gain})` : `none improved train (${l.train}); stop`}`);
    const f = (m) => `objective ${m.objective}, rung ${m.rung_accuracy} (balanced ${m.rung_balanced}), gap ${m.gap_accuracy}, false formal ${m.false_formal}, missed ${m.missed_formal}, invariance ${m.invariance}`;
    console.log(`\ntrain (with rewordings)  before: ${f(r.before.train)}\n                         after:  ${f(r.after.train)}`);
    console.log(`held-out                 before: ${f(r.before.heldout)}\n                         after:  ${f(r.after.heldout)}`);
    console.log(!r.changed ? "\nratchet: no edit improved train; rules unchanged" : r.accepted ? "\nratchet: held-out gate passed" : `\nratchet: REJECTED (${r.gate.reasons.join("; ")}); rules unchanged`);
    if (r.heldoutMisses.length) { console.log("still wrong on held-out (needs new train evidence, not more tuning):"); for (const m of r.heldoutMisses) console.log(`  want ${m.want}, got ${m.got}: ${m.text}`); }
  }
  if (has("--apply") && r.accepted) {
    const out = { ...r.rules, version: (start.version || 1) + 1 };
    fs.writeFileSync(RULES, JSON.stringify(out, null, 2) + "\n");
    console.log(`ratchet: wrote modules/verification/rules.json (version ${out.version})`);
  }
}
module.exports = { run, CANDIDATES, heldoutGate };
