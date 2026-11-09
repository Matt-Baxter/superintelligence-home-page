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
// Research loop (scripts/verification-ratchet.js): converges on the committed rules, and its held-out gate refuses a
// change that helps train but hurts held-out.
const { run } = require("../scripts/verification-ratchet");
const rules = require("../modules/verification/rules.json"), items = require("../bench/verification-set.json").items;
assert.equal(run(rules, items).changed, false, "the committed rules are a fixed point of the loop (re-run the ratchet after editing the set)");
const trap = [{ split: "train", rung: "claimed", gap: false, text: "Sample: lean wins again for proof writers (test data)" }, { split: "heldout", rung: "none", gap: false, text: "Sample startup keeps a lean team (test data)" }];
const t = run(rules, trap);
assert.ok(t.changed && t.log.some((l) => /formal: \/lean\/$/.test(l.kept || "")), "train alone rewards a bare 'lean' pattern");
assert.equal(t.accepted, false, "the held-out gate refuses it, because 'a lean team' would become a proof claim");
// The Lab toy behind the hypothesis: rewarding "it compiles" teaches weaker statements; an exact comparator stops it.
const P = require("../modules/lab/papers"), ag = P.runners.find((r) => r.id === "autoformalize-gate"), w = (p) => ag.run({ steps: 300, batch: 32, seed: 17, difficulty: 0.6, power: 1, subtle_blind: 0, gate: 1, ...p }).metrics;
assert.ok(w({ gate: 0 }).weakened_share > 0.9 && w({}).weakened_share < 0.05, "compile-only reward weakens statements; a comparator gate stops it");
assert.ok(w({ gate: 0 }).compile_rate > w({}).compile_rate, "the compile rate looks better without the gate, though the work is worse");
// The tag adapter uses the same rules as the score.
const kk = createKernel(), ad = kk.store.taggers.find((x) => x.id === "machine-checked");
assert.deepEqual(ad.tag("Sample Lean development builds with no sorry (test data)").map((x) => x.qid), ["topic:formal-verification"]);
assert.deepEqual(ad.tag("Sample startup keeps a lean team (test data)"), [], "no tag without a proof claim");
// Alignment: every term that tags a story Formal verification also links the Statement fidelity explainer.
const onto = require("../lib/ontology.json").topics.find((x) => x.id === "formal-verification").terms, conc = require("../modules/learn/data/concepts.json").concepts.find((x) => x.id === "statement-fidelity").terms;
assert.deepEqual(onto.filter((x) => !conc.includes(x)), [], "concept terms cover the topic's terms");
console.log("verification unit checks: 23 passed");
