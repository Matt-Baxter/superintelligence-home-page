// The learning flywheel (REQ-067, proposed): insight -> learning -> rule -> validation -> recall, measured.
//   stages(): where each learning in modules/responses/learnings.json has got to.
//   recall(): mutation testing. For each learning guarded by a QA check, a synthetic case reintroduces its problem;
//     the learning is recalled when its guard fails on that case and passes on the corrected one.
//   evolve(): an evolutionary loop (tournament selection, crossover, mutation, elitism) over the production model's
//     Q-learner settings, scored on training weeks and on held-out weeks; it stops when held-out stops improving or
//     the train/held-out gap passes a threshold (overtraining), and reports time to plateau. It only proposes.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { execFileSync } = require("node:child_process");
const has = (cmd) => { try { execFileSync(cmd, ["-version"], { stdio: "ignore" }); return true; } catch { return false; } };
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

function stages(learnings = require("../responses/learnings.json").learnings, { unitNames = null, recalled = new Set() } = {}) {
  const QA = require("../responses/qa").CHECKS;
  const unitText = unitNames || ["test/responses-unit.js", "test/data-unit.js", "test/graph-unit.js"].map((f) => { try { return fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8"); } catch { return ""; } }).join("\n");
  return learnings.map((l) => {
    const [kind, name] = [l.guard.split(":")[0], l.guard.slice(l.guard.indexOf(":") + 1)];
    const ruled = !!l.guard, validated = kind === "qa" ? !!QA[name] : typeof unitText === "string" ? unitText.includes(name) : unitText.includes(name);
    const stage = recalled.has(l.id) ? "recalled" : validated ? "validated" : ruled ? "ruled" : l.cause && l.fix ? "recorded" : "found";
    return { id: l.id, area: l.area, guard: l.guard, stage };
  });
}

// ---------- recall by mutation ----------
const SIT = "partial+table+mech+res+q";
function basePkg() {
  return { slug: "sample-recall", title: "Sample paper (test data)", analysis: { strength: "partly supported" }, checks: [{ id: "cites", ok: true, why: "3 numbers, all traced" }],
    plan: { search: { situation: SIT }, beats: [{ id: "claims", variant: "question-hook", seconds: 3, start: 0, slots: [2.4, 2.2], lines: [{ text: "Sample title for a recall test.", cue: 0 }, { text: "Does its main claim hold up?", cue: 1 }] }] } };
}
// A tiny render: `seconds` of the background colour, with a light box (centred, at the edge, or none), and a tone.
function tinyVideo(file, { seconds = 4.6, box = "centre", audio = seconds } = {}) {
  const draw = box === "none" ? "null" : box === "edge" ? "drawbox=x=0:y=60:w=40:h=40:color=white:t=fill" : "drawbox=x=120:y=60:w=80:h=60:color=white:t=fill";
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=0x0f1218:s=320x180:d=${seconds}:r=10`, "-f", "lavfi", "-i", `sine=frequency=220:duration=${audio}`, "-vf", draw, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file]);
}
function mutants() {
  const M = [];
  const pkg = (f) => { const p = basePkg(); f(p); return p; };
  M.push({ learning: "L2", check: "speakable", bad: pkg((p) => { p.plan.beats[0].lines[1].text = "It reports spread (seeds, runs, intervals or error bars)."; }), good: basePkg() });
  M.push({ learning: "L17", check: "pace", bad: pkg((p) => { p.plan.beats[0].lines[1].text = Array.from({ length: 34 }, (_, i) => `word${i}`).join(" ") + "."; }), good: basePkg() });
  M.push({ learning: "L3", check: "situation", bad: pkg((p) => { p.plan.search.situation = "strong+table+mech+res+q"; }), good: basePkg() });
  const P = require("../lab/production"), hook = P.UNITS.flatMap((u) => u.variants).find((v) => v.id === "question-hook");
  M.push({ learning: "L4", check: "calibration", bad: pkg((p) => { p.plan.beats[0].seconds = hook.seconds * 2; }), good: pkg((p) => { p.plan.beats[0].seconds = hook.seconds; }) });
  M.push({ learning: "plan:cites", check: "cites", bad: pkg((p) => { p.checks[0] = { id: "cites", ok: false, why: "numbers not found in the paper: 99.9" }; }), good: basePkg() });
  if (has("ffmpeg")) {
    M.push({ learning: "L1", check: "sync", video: { good: {}, bad: { audio: 1.7 } }, bad: pkg((p) => { p.plan.beats[0].seconds = 5.4; }), good: pkg((p) => { p.plan.beats[0].seconds = 4.6; }) });
    M.push({ learning: "L5", check: "edges", video: { good: {}, bad: { box: "edge" } }, bad: basePkg(), good: basePkg() });
    M.push({ learning: "L9", check: "blank", video: { good: {}, bad: { box: "none" } }, bad: basePkg(), good: basePkg() });
  }
  return M;
}
function recall() {
  const QA = require("../responses/qa").CHECKS, results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "si-recall-"));
  for (const m of mutants()) {
    const run = (which) => {
      const dir = path.join(tmp, `${m.check}-${which}`); fs.mkdirSync(dir, { recursive: true });
      if (m.video) { tinyVideo(path.join(dir, "video.mp4"), m.video[which]); }
      const r = QA[m.check](m[which], dir); return r.skip ? null : !!r.ok;
    };
    const bad = run("bad"), good = run("good");
    results.push({ learning: m.learning, check: m.check, caughtBad: bad === false, passedGood: good === true, recalled: bad === false && good === true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const n = results.length, ok = results.filter((r) => r.recalled).length;
  return { results, recall: n ? round(ok / n) : 0, n, ok };
}

// ---------- evolution with an overtraining stop ----------
const GENES = { alpha: [0.01, 0.3], epsilon: [0.05, 0.6], gamma: [0.5, 0.99], minVisits: [0, 80], episodes: [2000, 30000] };
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (g, v) => Math.min(GENES[g][1], Math.max(GENES[g][0], v));
function fitness(ind, P, { weeksSeeds, budget, maxEpisodes = Infinity }) {
  const L = P.qlearn({ alpha: ind.alpha, epsilon: ind.epsilon, gamma: ind.gamma, episodes: Math.round(Math.min(maxEpisodes, ind.episodes)), budget, seed: 7 });
  const pol = P.policyFrom(L.Q, L.visits, Math.round(ind.minVisits));
  return round(weeksSeeds.reduce((s, sd) => s + P.evaluate(pol, { budget, seed: sd, weeks: 60 }).reward, 0) / weeksSeeds.length);
}
function evolve({ population = 8, generations = 10, seed = 3, budget = 800, train = [101, 102], heldout = [901, 902, 903], gapStop = 0.4, patience = 3, maxEpisodes = Infinity } = {}) {
  const P = require("../lab/production"), r = rng(seed), t0 = Date.now();
  const rand = () => Object.fromEntries(Object.entries(GENES).map(([g, [lo, hi]]) => [g, lo + r() * (hi - lo)]));
  let pop = Array.from({ length: population }, rand);
  pop[0] = { alpha: 0.05, epsilon: 0.3, gamma: 0.9, minVisits: 30, episodes: 20000 }; // the hand-set values, as one member
  const history = []; let best = null, bestHeld = -Infinity, since = 0, reason = "ran all generations";
  for (let gen = 0; gen < generations; gen++) {
    const scored = pop.map((ind) => ({ ind, train: fitness(ind, P, { weeksSeeds: train, budget, maxEpisodes }) })).sort((a, b) => b.train - a.train);
    const top = scored[0], held = fitness(top.ind, P, { weeksSeeds: heldout, budget, maxEpisodes }), gap = round(top.train - held);
    history.push({ gen, train: top.train, heldout: held, gap, best: Object.fromEntries(Object.entries(top.ind).map(([k, v]) => [k, round(v, 3)])) });
    if (held > bestHeld + 1e-3) { bestHeld = held; best = { ...history[history.length - 1] }; since = 0; } else since++;
    if (gap > gapStop) { reason = `overtraining: the train/held-out gap reached ${gap} (> ${gapStop})`; break; }
    if (since >= patience) { reason = `plateau: held-out fitness didn't improve for ${patience} generations`; break; }
    // Next generation: keep the best two (elitism), fill with tournament-selected parents, crossover and mutation.
    const pick = () => { const a = scored[Math.floor(r() * scored.length)], b = scored[Math.floor(r() * scored.length)]; return (a.train >= b.train ? a : b).ind; };
    const next = [scored[0].ind, scored[1].ind];
    while (next.length < population) {
      const a = pick(), b = pick(), child = {};
      for (const g of Object.keys(GENES)) { child[g] = r() < 0.5 ? a[g] : b[g]; if (r() < 0.3) child[g] = clamp(g, child[g] + (r() - 0.5) * 0.3 * (GENES[g][1] - GENES[g][0])); }
      next.push(child);
    }
    pop = next;
  }
  const plateau = best ? best.gen : 0, hand = pop.length ? { alpha: 0.05, epsilon: 0.3, gamma: 0.9, minVisits: 30, episodes: 20000 } : null;
  const handSet = { train: fitness(hand, P, { weeksSeeds: train, budget, maxEpisodes }), heldout: fitness(hand, P, { weeksSeeds: heldout, budget, maxEpisodes }) };
  return { history, best, reason, generationsToPlateau: plateau, handSet, seconds: round((Date.now() - t0) / 1000, 1), note: "Simulation: tuned in the production model's synthetic channel; a proposal for a person, never adopted automatically." };
}
module.exports = { stages, recall, mutants, evolve, GENES };
