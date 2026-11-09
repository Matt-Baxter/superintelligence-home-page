// Fast checks of the "Machine-checked" signal (modules/verification). Synthetic sentences only (test data).
const assert = require("node:assert");
const { check, signal } = require("../modules/verification/verification");
const rung = (t) => check(t).rung.id;
assert.equal(rung("Sample lab says its model is better at maths (test data)"), "none", "no formal claim, no points");
assert.equal(rung("Sample: a lean startup raises money (test data)"), "none", "'lean' as an adjective is not Lean");
assert.equal(rung("Sample team posts a Lean 4 proof of a sample lemma (test data)"), "claimed");
assert.equal(rung("Sample proof is machine-checked; a comparator confirmed it matches Mathlib's statement (test data)"), "statement-checked");
assert.equal(rung("Sample formalization rechecked by a second independent kernel (test data)"), "statement-checked");
assert.equal(rung("An independent team audited the Lean formalization of Sample Theorem (test data)"), "outside-checked");
const gap = check("Outside researchers report the Lean proof states a weaker statement than the paper claims (test data)");
assert.equal(gap.rung.id, "outside-checked"); assert.equal(gap.gap, true, "fidelity gap flagged");
const s = signal.score({ text: "Outside researchers report the Lean proof does not correspond to the prose claim (test data)" });
assert.equal(check("Sample Lean proof does not correspond to the prose claim (test data)").rung.id, "statement-checked", "a reported gap is a statement check");
assert.ok(s.points <= signal.max && /not established/.test(s.detail), "a gap's why line says the claim isn't established");
assert.equal(signal.score({ text: "Sample news about chips (test data)" }), null, "no signal without a formal claim");
// Wired through the kernel into the core analysis: the score stays the sum of its why lines.
process.env.SITE_PROFILE = process.env.SITE_PROFILE || "extended";
const { createKernel } = require("../kernel/kernel");
const analysis = require("../lib/analysis");
const k = createKernel(); assert.ok(k.modules.some((m) => m.id === "verification"), "verification module is enabled");
for (const sig of k.store.signals.filter((x) => x.module === "verification")) analysis.registerSignal(sig);
const story = { title: "Sample Lab formalizes Sample Theorem in Lean (test data)", summary: "A comparator confirmed the final statement matches Mathlib's statement." };
const a = analysis.analyze(story, { kinds: ["lab"] });
const line = a.why.find((w) => w.factor === "Machine-checked");
assert.ok(line && line.points === 5, "the why line shows the statement-checked rung");
assert.equal(a.significance, a.why.reduce((x, w) => x + w.points, 0), "score is the sum of its explained parts");
assert.ok(a.significance > analysis.analyze({ title: "Sample Lab says it proved Sample Theorem (test data)" }, { kinds: ["lab"] }).significance, "a checked statement outranks an unchecked claim");
// The ontology tags formal-verification stories under Math.
const { tag } = require("../lib/tagger");
assert.ok(tag("Sample autoformalization with a proof assistant (test data)", "").topics.some((t) => t.id === "formal-verification"));
console.log("verification unit checks: 16 passed");
