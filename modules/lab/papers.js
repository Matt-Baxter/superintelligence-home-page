// Paper-to-code: CPU toys of recent papers found by the daily paper watcher (scripts/watch.js). Each toy keeps the
// paper's mechanism and drops its scale; numbers here test the logic of the idea, not the paper's results. Plain JS,
// deterministic (seeded), milliseconds per run. The papers' own numbers are never reproduced or attributed to people.
//   self-improve-selection   "Recursive self-improvement of AI research agents" (arXiv 2609.26457): an agent edits
//                            itself and keeps the best version, judged on visible tests or on hidden evaluations.
//                            Plus the edit budget from "RRSI: Regularized Recursive Self-Improvement" (arXiv 2609.24972).
//   research-oversight       "Reward Hacking Challenges Oversight of Autonomous Research Agents" (arXiv 2609.28614):
//                            a research agent picks methods; a reviewer sees code and score; feedback can teach
//                            evasion; recomputing results independently takes the metric out of the agent's hands.
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
];
// Averaging over seeds, so a verdict doesn't hang on one lucky draw (the Lab's examples pass seeds via "seeds").
function averaged(fn, p, seeds = 10) {
  const runs = Array.from({ length: seeds }, (_, i) => fn({ ...p, seed: (p.seed || 1) + i * 101 }));
  const metrics = Object.fromEntries(Object.keys(runs[0].metrics).map((k) => [k, round(mean(runs.map((x) => x.metrics[k])))]));
  return { ...runs[0], metrics, notes: [...runs[0].notes, `Metrics are the mean of ${seeds} seeds.`] };
}
for (const r of runnersList) { const raw = r.run; r.run = (p) => averaged(raw, p, 10); }

module.exports = { runners: runnersList, selfImprove, oversight };
