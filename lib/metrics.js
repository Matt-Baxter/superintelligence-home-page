// Classifier metrics that can't be fooled by an imbalanced set: the accuracy paradox guard (REQ-029, proposed).
//
// Plain accuracy is misleading when one class dominates: on a set that is 90% "credible", a judge that calls
// everything credible scores 0.9 and has learned nothing. So every labelled check here reports, next to accuracy:
//   balancedAccuracy  the mean recall over the classes that occur (1/k for any constant guess with k classes present)
//   mcc               Matthews correlation (multiclass, Gorodkin's R_K): 0 for a constant or random guess, 1 perfect
//   kappa             Cohen's kappa: agreement beyond what the two label frequencies give by chance
//   majority          the accuracy of always guessing the most common true class (the baseline to beat)
//   accuracyCI        95% Wilson interval for accuracy: 16 items right out of 16 only shows accuracy is above ~0.81
//   paradox           { ok, reasons[] }: fails when accuracy removes too few of the majority baseline's errors, when a
//                     class that occurs is never recognised, or when the set has one class (accuracy says nothing)
//
// One deep function behind a small interface: classify(truth, pred, options). Pure, no dependencies, deterministic.
// Labels are compared as strings, so true/"true" and 1/"1" are the same class. test/metrics-property-unit.js checks
// the properties (ranges, perfect and constant predictors, symmetry, invariance to order and to renaming labels).

// Wilson score interval for a proportion (z = 1.96): sensible at 0 and n, unlike the normal approximation.
function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (c - h) / d), high: Math.min(1, (c + h) / d) };
}
const round = (x, d = 3) => (x == null || !Number.isFinite(x) ? x : Math.round(x * 10 ** d) / 10 ** d);

function classify(truth, pred, { labels, minLift = 0.2, minRecall = 0, warnGap = 0.15, maxCIWidth = 0.15, digits = 3 } = {}) {
  if (!Array.isArray(truth) || !Array.isArray(pred)) throw new TypeError("classify(truth, pred): both must be arrays");
  if (truth.length !== pred.length) throw new RangeError(`classify: ${truth.length} truths but ${pred.length} predictions`);
  const t = truth.map(String), p = pred.map(String), n = t.length;
  const classes = [...new Set([...(labels || []).map(String), ...t, ...p])].sort();
  const present = [...new Set(t)].sort();
  const confusion = Object.fromEntries(classes.map((a) => [a, Object.fromEntries(classes.map((b) => [b, 0]))]));
  for (let i = 0; i < n; i++) confusion[t[i]][p[i]]++;
  const support = (c) => classes.reduce((s, b) => s + confusion[c][b], 0), predicted = (c) => classes.reduce((s, a) => s + confusion[a][c], 0);
  const perClass = Object.fromEntries(classes.map((c) => {
    const tp = confusion[c][c], sup = support(c), pr = predicted(c);
    const recall = sup ? tp / sup : null, precision = pr ? tp / pr : null;
    const f1 = recall != null && precision != null && recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : recall != null || precision != null ? 0 : null;
    return [c, { support: sup, predicted: pr, recall: round(recall, digits), precision: round(precision, digits), f1: round(f1, digits) }];
  }));
  if (!n) return { n, classes, present, confusion, perClass, accuracy: null, accuracyCI: null, balancedAccuracy: null, macroF1: null, mcc: null, kappa: null, majority: null, paradox: { ok: false, reasons: [{ level: "fail", code: "empty", msg: "no labelled items: nothing is measured" }] } };
  const correct = classes.reduce((s, c) => s + confusion[c][c], 0), accuracy = correct / n;
  const recalls = present.map((c) => confusion[c][c] / support(c));
  const balancedAccuracy = recalls.reduce((s, x) => s + x, 0) / present.length;
  const f1s = present.map((c) => { const pr = predicted(c) ? confusion[c][c] / predicted(c) : 0, rc = confusion[c][c] / support(c); return pr + rc > 0 ? (2 * pr * rc) / (pr + rc) : 0; });
  const macroF1 = f1s.reduce((s, x) => s + x, 0) / present.length;
  // Gorodkin's multiclass MCC: (n*c - sum_k p_k t_k) / sqrt((n^2 - sum p_k^2)(n^2 - sum t_k^2)); 0 when undefined.
  let sPT = 0, sP2 = 0, sT2 = 0; for (const c of classes) { const tk = support(c), pk = predicted(c); sPT += pk * tk; sP2 += pk * pk; sT2 += tk * tk; }
  const den = Math.sqrt((n * n - sP2) * (n * n - sT2)), mcc = den ? (n * correct - sPT) / den : 0;
  const pe = sPT / (n * n), kappa = pe < 1 ? (accuracy - pe) / (1 - pe) : 0;
  const ci = wilson(correct, n);
  const maj = present.map((c) => [c, support(c)]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const majority = { label: maj[0], accuracy: maj[1] / n };
  const reasons = [];
  if (present.length < 2) reasons.push({ level: "fail", code: "one-class", msg: `every item is "${present[0]}": accuracy can't tell a judge from a constant guess; add items of the other class` });
  else {
    // Lift as the share of the majority guess's errors that the judge removes, so a 0.9-majority set isn't held to the
    // same absolute margin as a balanced one: 0.93 against 0.9 removes 30% of the errors, 0.9 against 0.9 removes none.
    const lift = (accuracy - majority.accuracy) / (1 - majority.accuracy);
    if (lift < minLift) reasons.push({ level: "fail", code: "no-lift", msg: `accuracy ${round(accuracy)} removes ${round(Math.max(0, lift) * 100, 0)}% of the errors of always answering "${majority.label}" (${round(majority.accuracy)}); needs ${round(minLift * 100, 0)}%` });
    for (const c of present) { const r = confusion[c][c] / support(c); if (r <= minRecall) reasons.push({ level: "fail", code: "blind-class", msg: `class "${c}" (${support(c)} items) is recognised ${round(r * 100, 0)}% of the time` }); }
    if (ci.high - ci.low > maxCIWidth) reasons.push({ level: "warn", code: "small-sample", msg: `${n} items: accuracy is only known to lie between ${round(ci.low)} and ${round(ci.high)} (95%); add labelled items before trusting a change of a few points` });
    if (accuracy - balancedAccuracy > warnGap) reasons.push({ level: "warn", code: "imbalance-hides", msg: `accuracy ${round(accuracy)} is ${round(accuracy - balancedAccuracy)} above balanced accuracy ${round(balancedAccuracy)}: the common class hides errors on the rare one` });
  }
  return { n, classes, present, confusion, perClass, accuracy: round(accuracy, digits), accuracyCI: { low: round(ci.low, digits), high: round(ci.high, digits) }, balancedAccuracy: round(balancedAccuracy, digits), macroF1: round(macroF1, digits), mcc: round(mcc, digits), kappa: round(kappa, digits), majority: { label: majority.label, accuracy: round(majority.accuracy, digits) }, paradox: { ok: !reasons.some((r) => r.level === "fail"), reasons } };
}

// One line a person can read: "acc 0.92, balanced 0.75, MCC 0.61 (majority 0.88): imbalance hides errors".
function summary(s) {
  if (!s.n) return "no items";
  const head = `acc ${s.accuracy} [${s.accuracyCI.low}-${s.accuracyCI.high}], balanced ${s.balancedAccuracy}, MCC ${s.mcc} (majority "${s.majority.label}" ${s.majority.accuracy}, n ${s.n})`;
  return s.paradox.reasons.length ? `${head}: ${s.paradox.reasons.map((r) => `${r.level} ${r.msg}`).join("; ")}` : head;
}

// A person's agree/disagree with a two-way verdict, turned into truth and prediction: agreeing means the truth is the
// verdict, disagreeing means it is the other class. Then the same guard applies to live, person-labelled judging as to
// the fixed benchmark sets: "people agree 90% of the time" means little if 90% of verdicts are "credible".
function fromAgreement(rows, { predict, classes }) {
  const [a, b] = classes, truth = [], pred = [];
  for (const r of rows) { if (r.label !== "agree" && r.label !== "disagree") continue; const p = predict(r); if (p !== a && p !== b) continue; pred.push(p); truth.push(r.label === "agree" ? p : p === a ? b : a); }
  return classify(truth, pred, { labels: classes });
}
// The fields a page shows (no confusion internals): small enough for an API response.
const brief = (s) => ({ n: s.n, accuracy: s.accuracy, accuracyCI: s.accuracyCI, balancedAccuracy: s.balancedAccuracy, mcc: s.mcc, kappa: s.kappa, majority: s.majority,
  recall: Object.fromEntries(Object.entries(s.perClass).map(([k, v]) => [k, v.recall])), paradox: s.paradox, summary: summary(s) });

module.exports = { classify, summary, wilson, fromAgreement, brief };
