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
const eh = P.runners.find((r) => r.id === "experience-handoff"), hq = (m, x = {}) => eh.run({ handoff: m, hint_noise: 0.4, flake: 0.15, trial: 6, episodes: 600, seed: 11, ...x }).metrics;
const scalar = hq(0), keepAll = hq(1), credited = hq(2);
ok(JSON.stringify(hq(2)) === JSON.stringify(credited), "experience-handoff toy is deterministic");
ok(credited.heldout > keepAll.heldout + 0.1 && credited.bad_notes < keepAll.bad_notes, `crediting notes by their effect beats keeping every note (${keepAll.heldout} -> ${credited.heldout} held-out, ${keepAll.bad_notes} -> ${credited.bad_notes} wrong notes)`);
ok(credited.train_success > scalar.train_success + 0.1, `handed-on notes speed up training over the scalar reward alone (${scalar.train_success} -> ${credited.train_success})`);
ok(hq(1, { hint_noise: 0.7 }).heldout < keepAll.heldout, "noisier log hints hurt a playbook that keeps every note");
const ex = ["rsi-hidden-evals", "rrsi-edit-budget", "oversight-recompute", "cosine-sae", "roleplay-bounded-rsi", "experience-handoff-credit"].map((id) => [id, L.runExample(id)]);
ok(ex.every(([, r]) => r.example.source && /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}$/.test(r.example.source.url)), "every paper example links its arXiv source");
ok(ex.filter(([, r]) => !r.verdict.supported).map(([id]) => id).join() === "rrsi-edit-budget,roleplay-bounded-rsi,experience-handoff-credit", "the edit-budget, looser-bound and longer-trial hypotheses are kept as refuted at toy scale");
console.log(`\npapers unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
