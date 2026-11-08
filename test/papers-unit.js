#!/usr/bin/env node
// Paper-to-code toys (modules/lab/papers.js and the cosine SAE in interp.js): deterministic, and each shows the
// mechanism its example claims. Toy scale and synthetic data: these check the logic, not any paper's numbers.
const P = require("../modules/lab/papers"), I = require("../modules/lab/interp"), L = require("../modules/lab/lab");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const [sel, over] = P.runners;
const base = { edit_budget: 1, decay: 0, rounds: 40, proposals: 6, seed: 3 };
const vis = sel.run({ ...base, select_on: 0 }).metrics, hid = sel.run({ ...base, select_on: 1 }).metrics;
ok(JSON.stringify(sel.run({ ...base, select_on: 1 }).metrics) === JSON.stringify(hid), "self-improvement toy is deterministic");
ok(hid.hack_share < vis.hack_share - 0.1, `hidden evaluations cut the quirk share (${vis.hack_share} -> ${hid.hack_share})`);
ok(hid.heldout >= vis.heldout - 0.02, `...without losing held-out score (${vis.heldout} -> ${hid.heldout})`);
const big = sel.run({ ...base, select_on: 1, edit_budget: 12 }).metrics;
ok(big.hack_share > hid.hack_share, `bundled edits let quirks ride along even on hidden evaluations (${hid.hack_share} at budget 1, ${big.hack_share} at 12)`);
const o = (f, r) => over.run({ feedback: f, recompute: r, rounds: 30, seed: 5 }).metrics;
ok(o(0, 0).evasion > 0.5 && o(0, 1).evasion === 0 && o(1, 1).evasion === 0, "recomputing results independently stops undetected exploits, whatever the feedback");
ok(o(0, 1).true_quality > o(0, 0).true_quality, "...and the agent goes back to honest methods");
const sae = I.runners.find((r) => r.id === "sparse-autoencoder");
const std = sae.run({ latents: 24, l1: 0.1, resample: 0, steps: 1200, seed: 2, cosine: 0, norm_spread: 0.8 }).metrics, cos = sae.run({ latents: 24, l1: 0.1, resample: 0, steps: 1200, seed: 2, cosine: 1, norm_spread: 0.8 }).metrics;
ok(cos.recovered >= std.recovered + 4, `cosine scoring recovers more true features when input sizes vary (${std.recovered} -> ${cos.recovered} of 12)`);
const rp = P.runners.find((r) => r.id === "roleplay-rsi"), rq = (m, b) => rp.run({ meta: m, edit_bound: b, judge_noise: 0.2, rounds: 30, turns: 200, seed: 7 }).metrics;
const fixed = rq(0, 3), refine = rq(1, 3), loose = rq(1, 6);
ok(JSON.stringify(rq(1, 3)) === JSON.stringify(refine), "role-play self-improvement toy is deterministic");
ok(fixed.bad_rate > fixed.start_rate, `with fixed repair rules, wrong-artifact repairs cause drift (${fixed.start_rate} -> ${fixed.bad_rate})`);
ok(refine.bad_rate < fixed.bad_rate - 0.1 && refine.rules_right > fixed.rules_right, `refining its own rules cuts the bad-reply rate (${fixed.bad_rate} -> ${refine.bad_rate})`);
ok(loose.rules_right < refine.rules_right, `a looser edit bound makes rules thrash rather than settle (${refine.rules_right} at 3, ${loose.rules_right} at 6)`);
const cv = P.runners.find((r) => r.id === "causal-vs-correlational"), cq = (o) => cv.run({ method: 1, rho: 0.9, probe_noise: 1.5, dims: 48, features: 8, trials: 30, seed: 11, ...o }).metrics;
const abl = cq({}), cor = cq({ method: 0 }), indep = cq({ method: 0, rho: 0 });
ok(JSON.stringify(cq({})) === JSON.stringify(abl), "causal-check toy is deterministic");
ok(cor.confound_rate > abl.confound_rate + 0.1, `crediting by correlation names the co-occurring decoy far more often than ablation (${abl.confound_rate} -> ${cor.confound_rate})`);
ok(indep.confound_rate < 0.05 && indep.accuracy > 0.9, `without co-occurrence, correlation is right (${indep.accuracy}), so the decoy is what fools it`);
ok(abl.accuracy < 0.95 && abl.passes > cor.passes, `ablation costs a forward pass per feature and is only as good as the blurred direction it removes (accuracy ${abl.accuracy})`);
const ex = ["rsi-hidden-evals", "rrsi-edit-budget", "oversight-recompute", "cosine-sae", "roleplay-bounded-rsi", "interp-causal-check"].map((id) => [id, L.runExample(id)]);
ok(ex.every(([, r]) => r.example.source && /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(r.example.source.url)), "every paper example links its arXiv source");
ok(ex.filter(([, r]) => !r.verdict.supported).map(([id]) => id).join() === "rrsi-edit-budget,roleplay-bounded-rsi", "the edit-budget and looser-bound hypotheses are kept as refuted at toy scale");
console.log(`\npapers unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
