// Properties of lib/metrics.js (the accuracy paradox guard, REQ-029 proposed) over generated labelled sets, plus the
// worked examples a person can check by hand. Seeded, so a failure names the trial that broke and replays.
const assert = require("node:assert/strict"), { classify, summary } = require("../lib/metrics");
let seed = 2611, n = 0; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>>0) / 4294967296);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const close = (a, b, e = 2e-6) => Math.abs(a - b) <= e;
const shuffle = (xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// A generated set: 2-5 classes, skewed frequencies (the paradox lives in skew), predictions right with some chance.
function gen() {
  const k = 2 + Math.floor(rnd() * 4), labels = Array.from({ length: k }, (_, i) => `c${i}`), skew = 0.3 + rnd() * 0.65;
  const len = 1 + Math.floor(rnd() * 80), hit = rnd();
  const truth = Array.from({ length: len }, () => (rnd() < skew ? labels[0] : pick(labels)));
  const pred = truth.map((t) => (rnd() < hit ? t : pick(labels)));
  return { labels, truth, pred };
}
const D = 6; // compare at full precision
for (let trial = 0; trial < 800; trial++) {
  const { labels, truth, pred } = gen(), s = classify(truth, pred, { digits: D }), at = `trial ${trial}`;
  // Ranges and bookkeeping.
  assert.ok(s.accuracy >= 0 && s.accuracy <= 1 && s.balancedAccuracy >= 0 && s.balancedAccuracy <= 1, at);
  assert.ok(s.mcc >= -1 - 1e-9 && s.mcc <= 1 + 1e-9 && s.kappa <= 1 + 1e-9, at);
  const total = Object.values(s.confusion).reduce((x, row) => x + Object.values(row).reduce((a, b) => a + b, 0), 0);
  assert.equal(total, truth.length, at);
  for (const c of s.present) assert.equal(s.perClass[c].support, truth.filter((x) => x === c).length, at);
  // Order doesn't matter.
  const idx = shuffle(truth.map((_, i) => i)), s2 = classify(idx.map((i) => truth[i]), idx.map((i) => pred[i]), { digits: D });
  for (const k of ["accuracy", "balancedAccuracy", "mcc", "kappa", "macroF1"]) assert.ok(close(s[k], s2[k]), `${at}: ${k} changes with order`);
  // Renaming the classes (a bijection) doesn't matter.
  const ren = Object.fromEntries(labels.map((l, i) => [l, `renamed-${(i * 7) % labels.length}-${l}`])), s3 = classify(truth.map((x) => ren[x]), pred.map((x) => ren[x]), { digits: D });
  for (const k of ["accuracy", "balancedAccuracy", "mcc", "kappa"]) assert.ok(close(s[k], s3[k]), `${at}: ${k} changes when labels are renamed`);
  // Accuracy, MCC and kappa are symmetric in truth and prediction.
  const s4 = classify(pred, truth, { digits: D });
  for (const k of ["accuracy", "mcc", "kappa"]) assert.ok(close(s[k], s4[k]), `${at}: ${k} not symmetric`);
  // A perfect judge: everything 1 when two classes occur, and no paradox unless the set is one class.
  const perfect = classify(truth, truth, { digits: D });
  assert.equal(perfect.accuracy, 1, at); assert.equal(perfect.balancedAccuracy, 1, at);
  if (perfect.present.length >= 2) { assert.equal(perfect.mcc, 1, at); assert.equal(perfect.kappa, 1, at); assert.equal(perfect.paradox.ok, true, at); }
  else assert.equal(perfect.paradox.ok, false, at);
  // A constant guess of the majority class: accuracy equals the majority rate, balanced = 1/k, MCC = kappa = 0, and the
  // guard always fails it. This is the accuracy paradox itself.
  const constant = classify(truth, truth.map(() => s.majority.label), { digits: D });
  assert.ok(close(constant.accuracy, s.majority.accuracy), at);
  assert.ok(close(constant.balancedAccuracy, 1 / s.present.length), at);
  assert.ok(close(constant.mcc, 0) && close(constant.kappa, 0), at);
  assert.equal(constant.paradox.ok, false, `${at}: a constant guess passed the guard`);
  // The 95% interval holds the accuracy, and more of the same evidence narrows it.
  assert.ok(s.accuracyCI.low <= s.accuracy + 1e-9 && s.accuracy <= s.accuracyCI.high + 1e-9, at);
  const twice = classify([...truth, ...truth], [...pred, ...pred], { digits: D });
  assert.ok(twice.accuracyCI.high - twice.accuracyCI.low <= s.accuracyCI.high - s.accuracyCI.low + 1e-9, `${at}: doubling the set widened the interval`);
  // Binary: balanced accuracy is the mean of sensitivity and specificity.
  if (s.present.length === 2) { const [a, b] = s.present; assert.ok(close(s.balancedAccuracy, (s.confusion[a][a] / s.perClass[a].support + s.confusion[b][b] / s.perClass[b].support) / 2), at); }
}
n += 800;
// Worked examples (by hand): 90 "credible" and 10 "doubtful".
const truth = [...Array(90).fill("credible"), ...Array(10).fill("doubtful")];
const lazy = classify(truth, truth.map(() => "credible"));
assert.equal(lazy.accuracy, 0.9); assert.equal(lazy.balancedAccuracy, 0.5); assert.equal(lazy.mcc, 0); assert.equal(lazy.paradox.ok, false);
assert.deepEqual(lazy.paradox.reasons.map((r) => r.code).sort(), ["blind-class", "imbalance-hides", "no-lift"]); n++;
const decent = classify(truth, [...Array(85).fill("credible"), ...Array(5).fill("doubtful"), ...Array(8).fill("doubtful"), ...Array(2).fill("credible")]);
assert.equal(decent.accuracy, 0.93); assert.equal(decent.balancedAccuracy, 0.872); assert.ok(decent.mcc > 0.6 && decent.paradox.ok, summary(decent)); n++;
// Edge cases: empty, one class, mismatched lengths, non-arrays, booleans and strings as the same label.
assert.equal(classify([], []).paradox.reasons[0].code, "empty"); n++;
assert.equal(classify(["a", "a"], ["a", "a"]).paradox.reasons[0].code, "one-class"); n++;
assert.throws(() => classify(["a"], []), RangeError); assert.throws(() => classify("ab", "ab"), TypeError); n++;
assert.equal(classify([true, false], ["true", "false"]).accuracy, 1); n++;
assert.ok(classify(["x", "y"], ["x", "z"], { labels: ["x", "y", "z"] }).classes.includes("z")); n++;
assert.match(summary(lazy), /majority "credible" 0\.9/); n++;
const w = require("../lib/metrics").wilson(16, 16); assert.ok(w.low > 0.8 && w.low < 0.82 && w.high === 1, "16 of 16 right only shows accuracy above about 0.81"); n++;
assert.ok(classify([...Array(8).fill("a"), ...Array(8).fill("b")], [...Array(8).fill("a"), ...Array(8).fill("b")]).paradox.reasons.some((r) => r.code === "small-sample"), "16 items warn as a small sample"); n++;
// The verification ratchet's held-out gate refuses a gain in accuracy that comes from drifting to the common rung.
const { heldoutGate } = require("../scripts/verification-ratchet");
const before = { objective: 2.5, rung_balanced: 0.8, rung_paradox_free: 1 };
assert.equal(heldoutGate(before, { objective: 2.6, rung_balanced: 0.7, rung_paradox_free: 1 }, true).accepted, false, "higher objective with lower balanced accuracy is refused"); n++;
assert.equal(heldoutGate(before, { objective: 2.6, rung_balanced: 0.85, rung_paradox_free: 0 }, true).accepted, false, "losing a rung entirely is refused"); n++;
assert.equal(heldoutGate(before, { objective: 2.6, rung_balanced: 0.85, rung_paradox_free: 1 }, true).accepted, true, "a real improvement passes"); n++;
assert.equal(heldoutGate(before, before, false).accepted, false, "no change, nothing to accept"); n++;
console.log(`Metrics properties: ${n} passed, 0 failed; 800 generated labelled sets.`);
