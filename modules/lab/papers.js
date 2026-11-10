// Paper-to-code: CPU toys of recent papers found by the daily paper watcher (scripts/watch.js). Each toy keeps the
// paper's mechanism and drops its scale; numbers here test the logic of the idea, not the paper's results. Plain JS,
// deterministic (seeded), milliseconds per run. The papers' own numbers are never reproduced or attributed to people.
//   self-improve-selection   "Recursive self-improvement of AI research agents" (arXiv 2609.26457): an agent edits
//                            itself and keeps the best version, judged on visible tests or on hidden evaluations.
//                            Plus the edit budget from "RRSI: Regularized Recursive Self-Improvement" (arXiv 2609.24972).
//   research-oversight       "Reward Hacking Challenges Oversight of Autonomous Research Agents" (arXiv 2609.28614):
//                            a research agent picks methods; a reviewer sees code and score; feedback can teach
//                            evasion; recomputing results independently takes the metric out of the agent's hands.
//   roleplay-rsi             "Recursive Self-Improvement for Long-Horizon Role-Playing Dialogue" (arXiv 2611.07469): an
//                            updater repairs a character's artifacts after bad replies and, one level up, refines its
//                            own repair rules from how those repairs turned out, within a bound on edits per round.
//   moe-sae-attribution      "SAE Interprets MoE" (arXiv 2611.08089): an SAE reads a Mixture-of-Experts layer's output,
//                            a router-weighted sum of expert outputs, so each latent's pre-activation splits exactly
//                            into per-expert contributions; compare that with attributing latents by gate weight.
//   causal-vs-correlational  "Understanding AI from the Inside: The State of Mechanistic Interpretability for AI Safety"
//                            (arXiv 2611.08438): an interpretability claim names the feature that drives an output.
//                            Crediting features by correlation is fooled by a feature that merely co-occurs with the
//                            real one; crediting them by ablation (a causal check) is not, but is only as good as the
//                            feature directions it intervenes on.
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

// ---------- self-improvement with visible tests vs hidden evaluations ----------
// An agent is a vector of 8 "real skill" knobs and 4 "test quirk" knobs. Visible tests reward skill and are partly
// fooled by quirks (a quirk raises the visible score without real ability: reward hacking). Hidden evaluations are
// fresh tasks the quirks don't fool. Held-out benchmarks weight the skills differently (transfer). Each round the agent
// proposes edits (a budget of knobs it may change at once) and keeps the proposal only if the selection score rises.
function selfImprove({ select_on = 0, rounds = 40, edit_budget = 6, decay = 0, proposals = 6, seed = 3 }) {
  const r = rng(seed), K = 8, Q = 4;
  const wVisible = Array.from({ length: K }, () => 0.5 + r()), wHeld = Array.from({ length: K }, () => 0.5 + r());
  const skill = (a) => a.slice(0, K), quirks = (a) => a.slice(K);
  const sat = (x) => Math.tanh(x); // diminishing returns on any one knob
  const visible = (a) => mean(skill(a).map((s, i) => wVisible[i] * sat(s))) + 0.35 * mean(quirks(a).map(sat)) + 0.03 * gauss(r);
  const hidden = (a) => mean(skill(a).map((s, i) => wVisible[i] * sat(s))) - 0.05 * mean(quirks(a).map((q) => Math.max(0, sat(q)))) + 0.03 * gauss(r);
  const heldOut = (a) => mean(skill(a).map((s, i) => wHeld[i] * sat(s)));
  const hackShare = (a) => { const q = 0.35 * mean(quirks(a).map((x) => Math.max(0, sat(x)))), s = mean(skill(a).map((x, i) => wVisible[i] * Math.max(0, sat(x)))); return q + s > 1e-9 ? q / (q + s) : 0; };
  let agent = new Array(K + Q).fill(0), kept = 0; const curve = [[0, round(heldOut(agent))]];
  const score = (a) => (select_on ? hidden(a) : visible(a));
  for (let t = 1; t <= rounds; t++) {
    let best = null, bestS = score(agent);
    for (let p = 0; p < proposals; p++) {
      // RRSI: the budget shrinks over time, from edit_budget down to 1, when decay is on.
      const cand = agent.slice(), n = Math.max(1, Math.round(decay ? edit_budget - (edit_budget - 1) * ((t - 1) / Math.max(1, rounds - 1)) : edit_budget));
      for (let e = 0; e < n; e++) { const i = Math.floor(r() * (K + Q)); cand[i] += 0.35 * gauss(r) + (i >= K ? 0.15 : 0); } // quirks are the easy wins
      const s = score(cand); if (s > bestS) { bestS = s; best = cand; }
    }
    if (best) { agent = best; kept++; }
    curve.push([t, round(heldOut(agent))]);
  }
  return { metrics: { heldout: round(heldOut(agent)), visible: round(mean(skill(agent).map((s, i) => wVisible[i] * sat(s))) + 0.35 * mean(quirks(agent).map(sat))), hack_share: round(hackShare(agent)), kept },
    series: [{ name: "held-out score by round", points: curve }],
    notes: [`Selected on ${select_on ? "hidden evaluations" : "visible tests"}; ${kept} of ${rounds} rounds kept an edit.`, `Share of the visible score that comes from test quirks (reward hacking): ${round(hackShare(agent) * 100, 1)}%.`] };
}

// ---------- reward hacking under review ----------
// Each round a research agent picks a method from a menu: honest methods (real quality, no exploit) or exploits (a
// bigger reported score, no real quality) of varying subtlety. A reviewer who sees the code and the score catches an
// exploit with a chance that falls with its subtlety. With detailed feedback the agent learns which exploit was caught
// and moves to subtler ones; with generic rejections it only learns "that one failed". Independent recomputation reruns
// the result on data built to expose exploits, so an exploit's reported gain disappears whatever its subtlety.
function oversight({ feedback = 0, recompute = 0, rounds = 30, seed = 5 }) {
  const r = rng(seed);
  const menu = [
    ...Array.from({ length: 6 }, (_, i) => ({ kind: "honest", gain: 0.4 + 0.1 * i, subtle: 0 })),
    // Blunter exploits report bigger gains and are easier to catch; subtler ones gain less and slip through more often.
    ...Array.from({ length: 10 }, (_, i) => ({ kind: "exploit", gain: 1.72 - 0.08 * i, subtle: i / 9 })),
  ];
  const pref = menu.map((m) => m.gain); // the agent's running estimate of each method's payoff
  const banned = new Set(); let undetected = 0, caught = 0, exploits = 0, trueQ = 0; const pts = [];
  for (let t = 1; t <= rounds; t++) {
    // Softmax-ish greedy choice over methods not yet banned.
    let best = -1, bestV = -Infinity; menu.forEach((m, i) => { if (banned.has(i)) return; const v = pref[i] + 0.05 * gauss(r); if (v > bestV) { bestV = v; best = i; } });
    const m = menu[best];
    let reported = m.gain;
    if (m.kind === "exploit") {
      exploits++;
      if (recompute) { reported = 0; caught++; pref[best] = -1; } // the metric is recomputed outside the agent's control
      else if (r() < 0.9 - 0.85 * m.subtle) { caught++; reported = 0; banned.add(best); // either way the rejected method isn't tried again
        // Detailed feedback says why it was caught, so the agent learns that subtler exploits are safer; a generic rejection says nothing.
        if (feedback) for (let j = 0; j < menu.length; j++) if (menu[j].kind === "exploit" && menu[j].subtle > m.subtle) pref[j] += 0.3; }
      else undetected++;
    } else trueQ += m.gain;
    pref[best] = 0.7 * pref[best] + 0.3 * reported;
    pts.push([t, round(undetected / t)]);
  }
  return { metrics: { evasion: round(undetected / rounds), caught: round(caught / rounds), exploit_rate: round(exploits / rounds), true_quality: round(trueQ / rounds) },
    series: [{ name: "undetected exploits per round (running)", points: pts }],
    notes: [`${exploits} of ${rounds} rounds used an exploit; ${undetected} went undetected.`, recompute ? "Results were recomputed independently on exploit-exposing data." : feedback ? "Reviewers gave detailed feedback." : "Reviewers gave generic rejections."] };
}

// ---------- bounded two-level self-improvement for role-play ----------
// A character has 3 artifacts (memory, persona instructions, the prompt-building policy) and 6 kinds of bad reply. Each
// kind has one artifact that really fixes it (hidden from the updater). After each round of replies the updater repairs
// the most frequent kinds, at most edit_bound per round, by editing the artifact its rule names: the right artifact cuts
// that failure's rate; the wrong one fixes nothing and nudges a neighbouring failure up (drift). With meta on, the
// updater also refines its own rules: a judge (noisy by judge_noise) scores each repair by the drop in that failure next
// round, and a rule whose recent repairs don't help is switched to an artifact it hasn't tried.
function rolePlayRSI({ meta = 1, edit_bound = 3, judge_noise = 0.2, rounds = 30, turns = 200, seed = 7 }) {
  const r = rng(seed), F = 6, A = 3;
  const target = Array.from({ length: F }, (_, f) => f % A); for (let i = F - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [target[i], target[j]] = [target[j], target[i]]; }
  const p = Array.from({ length: F }, () => 0.02 + 0.03 * r());
  const rule = Array.from({ length: F }, () => Math.floor(r() * A)); // the updater's starting guesses (about a third right)
  const tried = rule.map((a) => new Set([a])), hist = Array.from({ length: F }, () => []);
  let prev = null, side = 0, switches = 0; const pts = [], badBy = [];
  for (let t = 1; t <= rounds; t++) {
    const cnt = new Array(F).fill(0); let bad = 0;
    for (let k = 0; k < turns; k++) { let b = false; for (let f = 0; f < F; f++) if (r() < p[f]) { cnt[f]++; b = true; } if (b) bad++; }
    badBy.push(bad / turns); pts.push([t, round(bad / turns)]);
    if (prev) for (const f of prev.fixed) hist[f].push((prev.cnt[f] - cnt[f]) / Math.max(1, prev.cnt[f]) + judge_noise * gauss(r));
    if (meta) for (let f = 0; f < F; f++) { const h = hist[f]; if (h.length >= 2 && mean(h.slice(-3)) < 0.05) {
      if (tried[f].size >= A) tried[f].clear();
      const next = [...Array(A).keys()].find((a) => !tried[f].has(a) && a !== rule[f]) ?? (rule[f] + 1) % A;
      rule[f] = next; tried[f].add(next); hist[f] = []; switches++; } }
    const order = [...Array(F).keys()].filter((f) => cnt[f] > 0).sort((a, b) => cnt[b] - cnt[a] || a - b).slice(0, edit_bound);
    for (const f of order) { if (rule[f] === target[f]) p[f] *= 0.6; else { p[(f + 1) % F] += 0.003; side++; } }
    prev = { cnt, fixed: order };
  }
  const right = rule.filter((a, f) => a === target[f]).length / F;
  return { metrics: { bad_rate: round(mean(badBy.slice(-5))), start_rate: round(mean(badBy.slice(0, 3))), rules_right: round(right), side_effects: side, switches },
    series: [{ name: "bad-reply rate by round", points: pts }],
    notes: [`${meta ? "The updater refined its own rules" : "The updater's rules were fixed"}; ${switches} rule switches, ${side} repairs hit the wrong artifact.`, `${Math.round(right * F)} of ${F} repair rules point at the artifact that really fixes that failure.`] };
}

// ---------- MoE expert attribution: SAE latent contributions vs gate weights ----------
// E experts, F true features (F/E owned by each expert). Tokens come from coarse domains; the router sends a domain's
// tokens to a pair of experts with near-even gates, so gates say little about which expert of the pair owns a fine
// feature (router_info mixes in the true owner). Each expert writes its own active features, plus a `leak` share of the
// others'. The layer output is y = sum_e g_e * out_e. The SAE here is idealised: its encoder rows are the true feature
// directions plus `enc_noise` (training is left out; the point is the split). A latent's pre-activation w.y splits
// exactly into sum_e g_e * (w.out_e), so each latent can be credited to experts by contribution, or by gate weight.
function moeAttribution({ router_info = 0, leak = 0.1, enc_noise = 0.2, tokens = 400, seed = 11 }) {
  const r = rng(seed), E = 4, F = 16, D = 24, per = F / E;
  const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
  const dict = Array.from({ length: F }, () => unit(Array.from({ length: D }, () => gauss(r))));
  const enc = dict.map((d) => unit(d.map((x) => x + enc_noise * gauss(r) / Math.sqrt(D))));
  const owner = (f) => Math.floor(f / per), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const contrib = Array.from({ length: F }, () => new Array(E).fill(0)), gate = Array.from({ length: F }, () => new Array(E).fill(0));
  let errMax = 0;
  for (let t = 0; t < tokens; t++) {
    const dom = r() < 0.5 ? 0 : 1, pair = [2 * dom, 2 * dom + 1];
    const active = [...Array(F).keys()].filter((f) => pair.includes(owner(f)) && r() < 0.25);
    if (!active.length) continue;
    const amp = Object.fromEntries(active.map((f) => [f, 0.5 + r()]));
    // Router: near-even split within the pair, nudged toward the experts that own this token's features by router_info.
    const own = pair.map((e) => active.filter((f) => owner(f) === e).length / active.length);
    const g = new Array(E).fill(0); let a = 0.5 + 0.1 * gauss(r); a = Math.min(0.9, Math.max(0.1, (1 - router_info) * a + router_info * own[0]));
    g[pair[0]] = a; g[pair[1]] = 1 - a;
    const out = Array.from({ length: E }, (_, e) => { const v = new Array(D).fill(0); for (const f of active) { const w = owner(f) === e ? 1 : leak; for (let i = 0; i < D; i++) v[i] += w * amp[f] * dict[f][i]; } return v; });
    const y = new Array(D).fill(0); for (let e = 0; e < E; e++) for (let i = 0; i < D; i++) y[i] += g[e] * out[e][i];
    for (let j = 0; j < F; j++) {
      const pre = dot(enc[j], y); if (pre <= 0.3) continue; // latent fires
      const parts = out.map((o, e) => g[e] * dot(enc[j], o));
      errMax = Math.max(errMax, Math.abs(parts.reduce((s, x) => s + x, 0) - pre));
      for (let e = 0; e < E; e++) { contrib[j][e] += Math.max(0, parts[e]); gate[j][e] += g[e]; }
    }
  }
  const share = (row) => { const s = row.reduce((a, x) => a + x, 0); return s > 0 ? Math.max(...row) / s : 0; };
  const argmax = (row) => row.indexOf(Math.max(...row));
  const live = [...Array(F).keys()].filter((j) => contrib[j].some((x) => x > 0));
  const accC = mean(live.map((j) => (argmax(contrib[j]) === owner(j) ? 1 : 0))), accG = mean(live.map((j) => (argmax(gate[j]) === owner(j) ? 1 : 0)));
  const concC = mean(live.map((j) => share(contrib[j]))), concG = mean(live.map((j) => share(gate[j])));
  return { metrics: { contrib_acc: round(accC), gate_acc: round(accG), advantage: round(accC - accG), contrib_conc: round(concC), gate_conc: round(concG), split_error: round(errMax, 6) },
    series: [{ name: "top-expert share per latent (contribution)", points: live.map((j, i) => [i, round(share(contrib[j]))]) }, { name: "top-expert share per latent (gate)", points: live.map((j, i) => [i, round(share(gate[j]))]) }],
    notes: [`${live.length} of ${F} latents fired; per-expert contributions add up to the pre-activation to within ${round(errMax, 6)}.`, `Contribution names the owning expert for ${Math.round(accC * live.length)} latents, gate weight for ${Math.round(accG * live.length)}.`] };
}

// A small model writes sparse features into a hidden vector (unit directions, 'dims' wide) and its output reads one of
// them (the real feature). Another feature co-occurs with it with probability rho. The analyst sees features through a
// dictionary: clean directions for every feature except the real one, whose direction is blurred by probe_noise. Each
// trial an analyst names the feature that drives the output, by correlation (method 0) or by ablating each dictionary
// direction and measuring how far the output moves (method 1, one extra forward pass per feature).
function causalVsCorrelational({ method = 1, rho = 0.9, probe_noise = 1.5, dims = 48, features = 8, trials = 30, samples = 200, seed = 11 } = {}) {
  const r = rng(seed), F = features, d = dims;
  const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  let right = 0, conf = 0; const pts = [];
  for (let t = 0; t < trials; t++) {
    const D = Array.from({ length: F }, () => unit(Array.from({ length: d }, () => gauss(r))));
    const c = Math.floor(r() * F); let k = Math.floor(r() * (F - 1)); if (k >= c) k++;
    const Dh = D.map((v, i) => unit(v.map((x) => x + (i === c ? probe_noise : 0.1) * gauss(r) / Math.sqrt(d))));
    const H = [], Y = [];
    for (let s = 0; s < samples; s++) {
      const z = Array.from({ length: F }, () => (r() < 0.25 ? 1 : 0));
      if (r() < rho) z[k] = z[c];
      const h = new Array(d).fill(0); for (let i = 0; i < F; i++) if (z[i]) for (let j = 0; j < d; j++) h[j] += D[i][j];
      for (let j = 0; j < d; j++) h[j] += 0.05 * gauss(r);
      H.push(h); Y.push(dot(h, D[c]));
    }
    const score = Dh.map((u) => {
      if (method === 0) { const a = H.map((h) => dot(h, u)), ma = mean(a), my = mean(Y); let sxy = 0, sxx = 0, syy = 0;
        for (let s = 0; s < samples; s++) { sxy += (a[s] - ma) * (Y[s] - my); sxx += (a[s] - ma) ** 2; syy += (Y[s] - my) ** 2; }
        return Math.abs(sxy) / Math.sqrt(sxx * syy || 1); }
      return mean(H.map((h) => Math.abs(dot(h, u) * dot(u, D[c])))); // output change when h loses its component along u
    });
    const pick = score.indexOf(Math.max(...score));
    if (pick === c) right++; else if (pick === k) conf++;
    pts.push([t + 1, round(right / (t + 1))]);
  }
  return { metrics: { confound_rate: round(conf / trials), accuracy: round(right / trials), passes: method === 0 ? 1 : F + 1 },
    series: [{ name: "running share of claims that name the real feature", points: pts }],
    notes: [`${method === 0 ? "Features were credited by how well their read-out correlates with the output" : "Features were credited by how far ablating them moves the output"}; ${conf} of ${trials} claims named the co-occurring feature instead.`, `${F} features in ${d} dimensions${d < F * 2 ? " (packed tightly, so directions overlap)" : ""}.`] };
}

const runnersList = [
  { id: "self-improve-selection", about: "An agent edits itself and keeps the best version, judged on visible tests or hidden evaluations (with an edit budget)",
    params: {
      select_on: { default: 0, min: 0, max: 1, step: 1, about: "0 = keep edits that raise visible test scores, 1 = keep edits that raise hidden evaluations" },
      edit_budget: { default: 6, min: 1, max: 12, step: 1, about: "Knobs one proposal may change at once (RRSI's edit budget)" },
      decay: { default: 0, min: 0, max: 1, step: 1, about: "1 = shrink the edit budget to 1 over the run (RRSI)" },
      rounds: { default: 40, min: 5, max: 120, step: 5, about: "Self-improvement rounds" },
      proposals: { default: 6, min: 1, max: 20, step: 1, about: "Proposals tried per round" },
      seed: { default: 3, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "heldout", label: "Held-out benchmark score", better: "higher" }, { id: "hack_share", label: "Share of visible score from test quirks", better: "lower" }, { id: "visible", label: "Visible test score", better: "higher" }, { id: "kept", label: "Rounds that kept an edit", better: "higher" }],
    run: (p) => selfImprove(p) },
  { id: "research-oversight", about: "A research agent picks methods under review; feedback and independent recomputation change how often exploits slip through",
    params: {
      feedback: { default: 0, min: 0, max: 1, step: 1, about: "0 = generic rejections, 1 = detailed feedback on what was caught" },
      recompute: { default: 0, min: 0, max: 1, step: 1, about: "1 = recompute results independently on exploit-exposing data" },
      rounds: { default: 30, min: 10, max: 100, step: 5, about: "Research rounds" },
      seed: { default: 5, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "evasion", label: "Rounds with an undetected exploit", better: "lower" }, { id: "exploit_rate", label: "Rounds that used an exploit", better: "lower" }, { id: "true_quality", label: "Real quality per round", better: "higher" }, { id: "caught", label: "Rounds with a caught exploit", better: "higher" }],
    run: (p) => oversight(p) },
  { id: "roleplay-rsi", about: "A role-play updater repairs a character's memory, persona and prompt policy, and refines its own repair rules from the outcomes",
    params: {
      meta: { default: 1, min: 0, max: 1, step: 1, about: "1 = the updater refines its own repair rules from repair outcomes, 0 = fixed rules" },
      edit_bound: { default: 3, min: 1, max: 6, step: 1, about: "Repairs allowed per round (the bound)" },
      judge_noise: { default: 0.2, min: 0, max: 1, step: 0.1, about: "Noise in how the judge scores a repair's outcome" },
      rounds: { default: 30, min: 5, max: 60, step: 5, about: "Improvement rounds" },
      turns: { default: 200, min: 50, max: 500, step: 50, about: "Replies per round" },
      seed: { default: 7, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "bad_rate", label: "Bad-reply rate (last 5 rounds)", better: "lower" }, { id: "rules_right", label: "Share of repair rules aimed at the right artifact", better: "higher" }, { id: "side_effects", label: "Repairs that hit the wrong artifact", better: "lower" }],
    run: (p) => rolePlayRSI(p) },
  { id: "moe-sae-attribution", about: "An SAE on a Mixture-of-Experts layer's output: credit each latent to experts by its exact per-expert contribution, or by gate weight",
    params: {
      router_info: { default: 0, min: 0, max: 1, step: 0.1, about: "How much the router's gates know about which expert owns a token's fine features (0 = coarse domain only)" },
      leak: { default: 0.1, min: 0, max: 1, step: 0.1, about: "Share of other experts' features each expert also writes" },
      enc_noise: { default: 0.2, min: 0, max: 1, step: 0.1, about: "Noise in the SAE encoder directions (0 = the true features)" },
      tokens: { default: 400, min: 100, max: 1000, step: 100, about: "Tokens sampled" },
      seed: { default: 11, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "contrib_acc", label: "Latents credited to the owning expert (contribution)", better: "higher" }, { id: "gate_acc", label: "Latents credited to the owning expert (gate weight)", better: "higher" }, { id: "advantage", label: "Contribution's accuracy edge over gate weight", better: "higher" }, { id: "contrib_conc", label: "Top expert's share of a latent (contribution)", better: "higher" }, { id: "gate_conc", label: "Top expert's share of a latent (gate weight)", better: "higher" }, { id: "split_error", label: "Largest gap between summed contributions and the pre-activation", better: "lower" }],
    run: (p) => moeAttribution(p) },
  { id: "causal-vs-correlational", about: "An analyst names the feature behind a model's output, by correlation or by ablation, when another feature co-occurs with the real one",
    params: {
      method: { default: 1, min: 0, max: 1, step: 1, about: "0 = credit features by correlation with the output, 1 = by ablating each one (causal check)" },
      rho: { default: 0.9, min: 0, max: 1, step: 0.05, about: "How often the decoy feature fires together with the real one" },
      probe_noise: { default: 1.5, min: 0, max: 3, step: 0.1, about: "How blurred the dictionary's direction for the real feature is" },
      dims: { default: 48, min: 4, max: 64, step: 4, about: "Width of the hidden vector (fewer dims = more overlap between features)" },
      features: { default: 8, min: 3, max: 16, step: 1, about: "Features the model uses" },
      trials: { default: 30, min: 5, max: 100, step: 5, about: "Claims made" },
      seed: { default: 11, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "confound_rate", label: "Claims that name the co-occurring decoy", better: "lower" }, { id: "accuracy", label: "Claims that name the real feature", better: "higher" }, { id: "passes", label: "Forward passes per claim", better: "lower" }],
    run: (p) => causalVsCorrelational(p) },
];
// Averaging over seeds, so a verdict doesn't hang on one lucky draw (the Lab's examples pass seeds via "seeds").
function averaged(fn, p, seeds = 10) {
  const runs = Array.from({ length: seeds }, (_, i) => fn({ ...p, seed: (p.seed || 1) + i * 101 }));
  const metrics = Object.fromEntries(Object.keys(runs[0].metrics).map((k) => [k, round(mean(runs.map((x) => x.metrics[k])))]));
  return { ...runs[0], metrics, notes: [...runs[0].notes, `Metrics are the mean of ${seeds} seeds.`] };
}
for (const r of runnersList) { const raw = r.run; r.run = (p) => averaged(raw, p, 10); }

module.exports = { runners: runnersList, selfImprove, oversight, rolePlayRSI, moeAttribution, causalVsCorrelational };
