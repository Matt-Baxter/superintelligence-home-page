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
const mo = P.runners.find((r) => r.id === "moe-sae-attribution"), mq = (p) => mo.run({ router_info: 0, leak: 0.1, enc_noise: 0.2, tokens: 400, seed: 11, ...p }).metrics;
const moe = mq({});
ok(JSON.stringify(mq({})) === JSON.stringify(moe), "MoE expert-attribution toy is deterministic");
ok(moe.split_error < 1e-6, `per-expert contributions add up exactly to each SAE latent's pre-activation (gap ${moe.split_error})`);
ok(moe.contrib_acc > moe.gate_acc + 0.15 && moe.contrib_conc > moe.gate_conc, `crediting latents by contribution finds the owning expert more often than gate weight (${moe.gate_acc} -> ${moe.contrib_acc}) and is more concentrated (${moe.gate_conc} -> ${moe.contrib_conc})`);
ok(mq({ router_info: 0.5 }).gate_acc > moe.gate_acc, "gate weight only catches up when the router itself knows the fine-grained owner");
const ex = ["rsi-hidden-evals", "rrsi-edit-budget", "oversight-recompute", "cosine-sae", "roleplay-bounded-rsi", "moe-sae-expert-split"].map((id) => [id, L.runExample(id)]);
ok(ex.every(([, r]) => r.example.source && /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(r.example.source.url)), "every paper example links its arXiv source");
ok(ex.filter(([, r]) => !r.verdict.supported).map(([id]) => id).join() === "rrsi-edit-budget,roleplay-bounded-rsi,moe-sae-expert-split", "the edit-budget, looser-bound and noisy-encoder hypotheses are kept as refuted at toy scale");
console.log(`\npapers unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
