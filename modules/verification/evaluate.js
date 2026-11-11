// Scores a set of verification rules on labelled sentences (bench/verification-set.json). Shared by the benchmark
// (scripts/bench.js) and the research loop (scripts/verification-ratchet.js), so both measure the same thing.
// Pure and deterministic.
const { check, compile } = require("./verification");

// Rewordings that must not change a judgement (same idea as the judge-fidelity invariance tests, specs/003): case,
// spacing, the test-data label, and swaps between words that mean the same thing here.
const SYNONYMS = [
  ["statement", "theorem"], ["theorem", "result"], ["development", "project"], ["proof", "argument"],
  ["independent", "outside"], ["audited", "reviewed"], ["weaker", "less strong"],
];
const swap = (t, a, b) => t.replace(new RegExp(`\\b${a}\\b`, "g"), b);
function rewordings(text) {
  const out = [text.toLowerCase(), text.replace(/ /g, "  "), text.replace(/\s*\(test data\)\s*$/i, "")];
  for (const [a, b] of SYNONYMS) if (new RegExp(`\\b${a}\\b`).test(text)) out.push(swap(text, a, b));
  return [...new Set(out)].filter((x) => x !== text);
}

const ORDER = { none: 0, claimed: 1, "statement-checked": 2, "outside-checked": 3 };
const { classify } = require("../../lib/metrics");
function score(rules, items, { augment = false } = {}) {
  const R = compile(rules);
  let rung = 0, gap = 0, n = 0, fp = 0, negatives = 0, fn = 0, positives = 0, inv = 0, invN = 0;
  const misses = [], truthR = [], predR = [];
  for (const it of items) {
    const texts = augment ? [it.text, ...rewordings(it.text)] : [it.text];
    // Invariance: a harmless rewording keeps the judgement the original gets.
    const base = check(it.text, R);
    for (const r of rewordings(it.text)) { invN++; const c = check(r, R); if (c.rung.id === base.rung.id && c.gap === base.gap) inv++; }
    for (const t of texts) {
      const c = check(t, R); n++;
      const okR = c.rung.id === it.rung, okG = c.gap === it.gap; truthR.push(it.rung); predR.push(c.rung.id);
      if (okR) rung++; if (okG) gap++;
      if (it.rung === "none") { negatives++; if (c.rung.id !== "none") fp++; } else { positives++; if (c.rung.id === "none") fn++; }
      if ((!okR || !okG) && t === it.text) misses.push({ text: it.text, want: `${it.rung}${it.gap ? "+gap" : ""}`, got: `${c.rung.id}${c.gap ? "+gap" : ""}`, off: ORDER[c.rung.id] - ORDER[it.rung] });
    }
  }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const m = { rung_accuracy: r3(rung / (n || 1)), gap_accuracy: r3(gap / (n || 1)), false_formal: r3(fp / (negatives || 1)), missed_formal: r3(fn / (positives || 1)), invariance: r3(inv / (invN || 1)) };
  // One number to climb: accuracy, with a false proof claim costing twice a miss (crediting a claim nobody made is
  // worse than missing one), plus invariance.
  m.objective = r3(m.rung_accuracy + m.gap_accuracy - 2 * m.false_formal - m.missed_formal + m.invariance);
  // The accuracy paradox guard (lib/metrics.js): rung accuracy can climb by drifting toward the most common rung, so
  // the ratchet also watches the mean recall over rungs and whether every rung that occurs is still recognised.
  const h = classify(truthR, predR); m.rung_balanced = h.balancedAccuracy; m.rung_paradox_free = h.paradox.ok ? 1 : 0;
  return { metrics: m, misses, honesty: h };
}

module.exports = { score, rewordings, SYNONYMS };
