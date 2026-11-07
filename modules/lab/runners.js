// Lab runners: small deterministic simulations that reproduce a superintelligence idea at toy scale.
// Same params + same seed => same result, so every number in the app can be re-run and checked. Each runner is an
// adapter { id, about, params: {name: {default, min, max, step?, about}}, metrics: [{id, label, better}], run(params) }.
// run() returns { metrics: {id: number}, series: [{name, points: [[x, y]...]}], notes: [] }. Runs take milliseconds.
const { createRegistry } = require("../../lib/registry");
const runners = createRegistry("lab runner", { required: ["id", "about", "params", "metrics", "run"] });

// Seeded PRNG (mulberry32) so runs repeat exactly.
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// 1. Compounding self-improvement: each generation improves the next in proportion to capability^alpha, minus a
//    fixed bottleneck share (compute, experiments) that no amount of capability removes.
runners.register({
  id: "compounding", about: "Capability that improves its own rate of improvement, with returns alpha and a bottleneck",
  params: {
    rate: { default: 0.1, min: 0.01, max: 0.5, step: 0.01, about: "Improvement per generation at capability 1" },
    alpha: { default: 1, min: 0, max: 1.5, step: 0.05, about: "Returns to capability: 1 = compounding, <1 diminishing, >1 accelerating" },
    bottleneck: { default: 0, min: 0, max: 0.9, step: 0.05, about: "Share of each step limited by things capability can't speed up" },
    generations: { default: 60, min: 10, max: 200, step: 10, about: "Generations simulated" },
  },
  metrics: [{ id: "steps_to_10x", label: "Generations to 10x", better: "lower" }, { id: "final", label: "Capability at the end", better: "higher" }, { id: "speedup_last", label: "Growth per generation at the end", better: "higher" }],
  run({ rate, alpha, bottleneck, generations }) {
    let c = 1, to10 = null; const pts = [[0, 1]];
    for (let g = 1; g <= generations; g++) {
      const gain = rate * Math.pow(c, alpha) * (1 - bottleneck) + rate * bottleneck * Math.min(1, c) ;
      c += gain; if (to10 === null && c >= 10) to10 = g; pts.push([g, round(c, 3)]);
      if (c > 1e12) break;
    }
    const last = pts.at(-1)[1] / pts.at(-2)[1];
    return { metrics: { steps_to_10x: to10 ?? generations + 1, final: round(Math.min(c, 1e12), 2), speedup_last: round(last, 4) }, series: [{ name: "capability", points: pts, log: true }],
      notes: [to10 ? `Reached 10x at generation ${to10}.` : `Never reached 10x in ${generations} generations.`] };
  },
});

// 2. Goodhart under optimisation pressure: hill-climb a proxy that partly rewards an exploit the true goal dislikes.
//    Optional oversight audits a share of steps with the true goal and rejects steps that lower it.
runners.register({
  id: "goodhart", about: "An optimiser pushes a proxy; the true goal follows at first, then falls as the exploit pays off",
  params: {
    exploit: { default: 0.6, min: 0, max: 1, step: 0.05, about: "How much the proxy rewards the exploit direction" },
    audit: { default: 0, min: 0, max: 1, step: 0.05, about: "Share of steps checked against the true goal (oversight)" },
    steps: { default: 400, min: 50, max: 2000, step: 50, about: "Optimisation steps (pressure)" },
    seed: { default: 7, min: 1, max: 999, step: 1, about: "Random seed" },
  },
  metrics: [{ id: "true_final", label: "True goal at the end", better: "higher" }, { id: "proxy_final", label: "Proxy at the end", better: "higher" }, { id: "gap", label: "Proxy minus true goal", better: "lower" }],
  run({ exploit, audit, steps, seed }) {
    const r = rng(seed); let x = 0, y = 0; // x = real quality, y = exploit
    const trueGoal = (x, y) => x - 0.15 * x * x / 4 - y * y; // real quality has diminishing value; exploiting is harmful
    const proxy = (x, y) => x + exploit * 3 * y;               // the measured score loves the exploit
    const pT = [], pP = [];
    for (let s = 0; s < steps; s++) {
      const dx = 0.05 * gauss(r), dy = 0.05 * gauss(r);
      if (proxy(x + dx, y + dy) > proxy(x, y)) {
        const audited = r() < audit;
        if (!audited || trueGoal(x + dx, y + dy) >= trueGoal(x, y)) { x += dx; y += dy; }
      }
      if (s % Math.max(1, Math.floor(steps / 80)) === 0) { pT.push([s, round(trueGoal(x, y), 3)]); pP.push([s, round(proxy(x, y), 3)]); }
    }
    const t = trueGoal(x, y), p = proxy(x, y);
    return { metrics: { true_final: round(t, 3), proxy_final: round(p, 3), gap: round(p - t, 3) }, series: [{ name: "proxy", points: pP }, { name: "true goal", points: pT }],
      notes: [p - t > 1 ? "The proxy kept rising while the true goal fell: Goodhart's law." : "The proxy and the true goal stayed close."] };
  },
});

// 3. Weak-to-strong: a weak supervisor with noisy labels trains a stronger learner (k-nearest neighbours).
//    Does the student end up more accurate than its teacher? Filtering the teacher's least confident labels may help.
runners.register({
  id: "weak-to-strong", about: "A strong learner trained only on a weak supervisor's noisy labels",
  params: {
    noise: { default: 0.25, min: 0, max: 0.45, step: 0.05, about: "Share of the weak supervisor's labels that are wrong" },
    k: { default: 15, min: 1, max: 51, step: 2, about: "Neighbours the strong student averages" },
    filter: { default: 0, min: 0, max: 0.5, step: 0.05, about: "Drop this share of labels the supervisor is least sure of" },
    n: { default: 400, min: 100, max: 2000, step: 100, about: "Training examples" },
    seed: { default: 3, min: 1, max: 999, step: 1, about: "Random seed" },
  },
  metrics: [{ id: "student_acc", label: "Student accuracy (true labels)", better: "higher" }, { id: "teacher_acc", label: "Supervisor accuracy", better: "higher" }, { id: "gain", label: "Student minus supervisor", better: "higher" }],
  run({ noise, k, filter, n, seed }) {
    const r = rng(seed), truth = (p) => (Math.sin(3 * p[0]) + p[1] > 0.2 ? 1 : 0);
    const pts = Array.from({ length: n }, () => [r() * 2 - 1, r() * 2 - 1]);
    // the supervisor is unsure near the boundary; it errs there more often
    const margin = (p) => Math.abs(Math.sin(3 * p[0]) + p[1] - 0.2);
    let train = pts.map((p) => { const t = truth(p), flip = r() < noise * (margin(p) < 0.3 ? 1.6 : 0.6); return { p, y: flip ? 1 - t : t, conf: margin(p), t }; });
    const teacherAcc = train.filter((e) => e.y === e.t).length / n;
    if (filter > 0) train = train.sort((a, b) => b.conf - a.conf).slice(0, Math.floor(n * (1 - filter)));
    const test = Array.from({ length: 300 }, () => [r() * 2 - 1, r() * 2 - 1]);
    let right = 0;
    for (const q of test) {
      const near = train.map((e) => [(e.p[0] - q[0]) ** 2 + (e.p[1] - q[1]) ** 2, e.y]).sort((a, b) => a[0] - b[0]).slice(0, k);
      const vote = near.reduce((s, x) => s + x[1], 0) / near.length;
      if ((vote >= 0.5 ? 1 : 0) === truth(q)) right++;
    }
    const sa = right / test.length;
    return { metrics: { student_acc: round(sa, 3), teacher_acc: round(teacherAcc, 3), gain: round(sa - teacherAcc, 3) }, series: [],
      notes: [sa > teacherAcc ? "The student beat its own supervisor." : "The student did no better than its supervisor."] };
  },
});

// 4. Scaling: fit loss against model size (polynomial degree) on synthetic data, then fit a power law to the curve.
runners.register({
  id: "scaling", about: "Loss falls as a power law in model size until data runs out",
  params: {
    data: { default: 2000, min: 50, max: 5000, step: 50, about: "Training examples" },
    sizes: { default: 10, min: 4, max: 14, step: 1, about: "Model sizes tried (1..sizes features)" },
    seed: { default: 11, min: 1, max: 999, step: 1, about: "Random seed" },
  },
  metrics: [{ id: "exponent", label: "Power-law exponent (steeper is better)", better: "higher" }, { id: "best_loss", label: "Best test loss", better: "lower" }, { id: "plateau_at", label: "Size where gains stop", better: "higher" }],
  run({ data, sizes, seed }) {
    const r = rng(seed);
    // target with a long tail of ever-smaller components: each extra feature explains a little less
    const f = (x) => { let s = 0; for (let j = 1; j <= 20; j++) s += Math.cos(j * x) / Math.pow(j, 1.2); return s; };
    const mk = (m) => Array.from({ length: m }, () => { const x = r() * 2 * Math.PI; return [x, f(x) + 0.05 * gauss(r)]; });
    const train = mk(data), test = mk(500);
    const feats = (x, d) => Array.from({ length: d }, (_, j) => Math.cos((j + 1) * x));
    const pts = []; let plateau = sizes, prev = Infinity;
    for (let d = 1; d <= sizes; d++) {
      // least squares by normal equations with a tiny ridge (d <= 14, so this is cheap)
      const A = Array.from({ length: d }, () => new Float64Array(d)), b = new Float64Array(d);
      for (const [x, y] of train) { const v = feats(x, d); for (let i = 0; i < d; i++) { b[i] += v[i] * y; for (let j = 0; j < d; j++) A[i][j] += v[i] * v[j]; } }
      for (let i = 0; i < d; i++) A[i][i] += 1e-6 * train.length;
      const w = solve(A, b);
      const loss = test.reduce((s, [x, y]) => { const v = feats(x, d); const p = v.reduce((a, vi, i) => a + vi * w[i], 0); return s + (p - y) ** 2; }, 0) / test.length;
      pts.push([d, round(loss, 5)]);
      if (plateau === sizes && prev - loss < 0.02 * prev) plateau = d - 1;
      prev = loss;
    }
    // fit log(loss) = a - k log(size) on the improving part
    const use = pts.slice(0, Math.max(2, plateau));
    const xs = use.map(([d]) => Math.log(d)), ys = use.map(([, l]) => Math.log(Math.max(l, 1e-9)));
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const kExp = -xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return { metrics: { exponent: round(kExp, 3), best_loss: round(Math.min(...pts.map((p) => p[1])), 5), plateau_at: plateau }, series: [{ name: "test loss", points: pts, log: true }],
      notes: [`Loss falls roughly as size^-${round(kExp, 2)} until size ${plateau}.`] };
  },
});
function solve(A, b) { const n = b.length, M = A.map((row, i) => [...row, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; } } return M.map((row, i) => row[n] / row[i]); }

// 5. Decision gym: recursive self-improvement on decision making (see gym.js).
runners.register(require("./gym").runner);
// Interpretability toys (superposition, sparse autoencoder, steering): modules/lab/interp.js.
for (const r of require("./interp").runners) runners.register(r);
// Paper-to-code toys from the daily paper watcher: modules/lab/papers.js.
for (const r of require("./papers").runners) runners.register(r);

module.exports = { runners, rng, gauss, round };
