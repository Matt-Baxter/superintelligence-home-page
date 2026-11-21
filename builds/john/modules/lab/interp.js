// Interpretability toys (docs: the "Mechanistic interpretability toolkits" research report, toy table). Plain JavaScript,
// no dependencies, CPU, deterministic, well under a second each, so they run on the server, in the Arena's browser
// sandbox and in the benchmarks. Each toy has ground truth (the true features are known), which real models lack.
//   superposition      Anthropic's Toy Models of Superposition (2022): n sparse features squeezed into m dimensions.
//   sparse-autoencoder Dictionary learning (Towards Monosemanticity, 2023): an SAE trained on the toy's hidden layer,
//                      scored by how many of the toy's real feature directions it recovers; optional dead-latent resampling.
//   steering           Clamp one SAE latent (Scaling Monosemanticity, 2024) with the SAE error added back (Goodfire's
//                      intervention): how much the target feature moves versus collateral change in the others.
// Gradients are written by hand (h = Wx, x' = ReLU(W^T W x + b)), so the same code ports to numpy line by line.

function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// Adam on a flat Float64Array.
function adam(p, lr = 1e-2, b1 = 0.9, b2 = 0.999) {
  const m = new Float64Array(p.length), v = new Float64Array(p.length); let t = 0;
  return (g) => { t++; const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t; for (let i = 0; i < p.length; i++) { m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i]; p[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8); } };
}
// Sparse synthetic features: each is 0 with probability S, otherwise uniform on [0, 1].
const sample = (r, n, S) => { const x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = r() < S ? 0 : r(); return x; };

// ---------- the toy model: W is m x n (row-major), b is n ----------
function trainToy({ n = 5, m = 2, S = 0.9, decay = 0.9, steps = 3000, batch = 256, lr = 0.01, seed = 1 } = {}) {
  const r = rng(seed), W = new Float64Array(m * n), b = new Float64Array(n), I = Array.from({ length: n }, (_, i) => decay ** i);
  for (let k = 0; k < W.length; k++) W[k] = 0.3 * gauss(r);
  const P = new Float64Array(m * n + n), stepP = adam(P, lr); P.set(W); P.set(b, m * n);
  const gP = new Float64Array(P.length), h = new Float64Array(m), g = new Float64Array(n);
  let loss = 0;
  for (let s = 0; s < steps; s++) {
    gP.fill(0); loss = 0;
    for (let k = 0; k < batch; k++) {
      const x = sample(r, n, S);
      for (let a = 0; a < m; a++) { let acc = 0; for (let i = 0; i < n; i++) acc += P[a * n + i] * x[i]; h[a] = acc; }
      for (let i = 0; i < n; i++) {
        let pre = P[m * n + i]; for (let a = 0; a < m; a++) pre += P[a * n + i] * h[a];
        const out = pre > 0 ? pre : 0, d = out - x[i]; loss += I[i] * d * d;
        g[i] = pre > 0 ? (2 * I[i] * d) / batch : 0;
      }
      // dL/dW = W (x g^T + g x^T): for row a, col i: sum_j W[a,j] (x_j g_i + g_j x_i)
      let wg = new Float64Array(m); for (let a = 0; a < m; a++) { let acc = 0; for (let j = 0; j < n; j++) acc += P[a * n + j] * g[j]; wg[a] = acc; }
      for (let a = 0; a < m; a++) for (let i = 0; i < n; i++) gP[a * n + i] += h[a] * g[i] + wg[a] * x[i];
      for (let i = 0; i < n; i++) gP[m * n + i] += g[i];
    }
    stepP(gP);
  }
  return { n, m, S, W: P.slice(0, m * n), b: P.slice(m * n), loss: loss / batch, importance: I };
}
const col = (W, m, n, i) => Array.from({ length: m }, (_, a) => W[a * n + i]);
const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0), norm = (u) => Math.sqrt(dot(u, u));
// Feature dimensionality D_i = |W_i|^2 / sum_j (W_i_hat . W_j)^2 (the paper's measure; 1 = own dimension, 1/2 = antipodal pair, 2/5 = pentagon).
function dims(toy) {
  const cols = Array.from({ length: toy.n }, (_, i) => col(toy.W, toy.m, toy.n, i));
  return cols.map((wi) => { const ni = norm(wi); if (ni < 1e-6) return 0; const hat = wi.map((x) => x / ni); return (ni * ni) / cols.reduce((s, wj) => s + dot(hat, wj) ** 2, 0); });
}
const geometry = (D, represented) => {
  if (!represented) return "nothing stored";
  const near = (v) => D.filter((d) => d > 0.05 && Math.abs(d - v) < 0.07).length;
  if (near(1) === represented) return `${represented} features, each in its own dimension`;
  if (near(0.4) >= 4) return "a pentagon: 5 features in 2 dimensions";
  if (near(0.5) >= 2) return "antipodal pairs: two features share a line";
  if (near(2 / 3) >= 3) return "a triangle";
  return "a mix of shared and dedicated directions";
};

// ---------- the sparse autoencoder on the toy's hidden layer ----------
// cosine = 1: score each latent by the cosine between the input and its encoder direction, then scale by the input's
// norm ("Size Doesn't Matter: Cosine-Scored Sparse Autoencoders", arXiv 2606.15054). Whether a latent fires then depends
// on direction only. normSpread scales each input by a random factor (models with normalization discard that size).
// (Simplification: in cosine mode the encoder's gradient doesn't flow into the pre-encoder bias or through the norm.)
function trainSAE(toy, { latents = 40, l1 = 0.003, steps = 2500, batch = 256, lr = 0.005, resample = 0, seed = 2, cosine = 0, normSpread = 0 } = {}) {
  const { n, m, W, S } = toy, r = rng(seed), d = m, k = latents;
  // params: We (k x d), be (k), Wd (d x k, unit-norm columns), bd (d)
  const P = new Float64Array(k * d + k + d * k + d); const oWe = 0, obe = k * d, oWd = obe + k, obd = oWd + d * k;
  for (let j = 0; j < k; j++) { const v = Array.from({ length: d }, () => gauss(r)), nv = norm(v); for (let a = 0; a < d; a++) { P[oWd + a * k + j] = v[a] / nv; P[oWe + j * d + a] = (0.5 * v[a]) / nv; } }
  const step = adam(P, lr), G = new Float64Array(P.length), fired = new Float64Array(k);
  const hidden = () => { const x = sample(r, n, S), h = new Float64Array(d), rho = normSpread ? Math.exp(normSpread * gauss(r)) : 1; for (let a = 0; a < d; a++) { let s = 0; for (let i = 0; i < n; i++) s += W[a * n + i] * x[i]; h[a] = rho * s; } return h; };
  const fwd = (h) => {
    const c = new Float64Array(d); for (let a = 0; a < d; a++) c[a] = h[a] - P[obd + a];
    const pre = new Float64Array(k), z = new Float64Array(k);
    const nc = cosine ? Math.sqrt(c.reduce((acc, x) => acc + x * x, 0)) || 1e-9 : 1; // input norm (1 when inner-product scoring)
    for (let j = 0; j < k; j++) { let s = P[obe + j]; for (let a = 0; a < d; a++) s += (P[oWe + j * d + a] * c[a]) / nc; pre[j] = s; z[j] = s > 0 ? s * nc : 0; }
    const hh = new Float64Array(d); for (let a = 0; a < d; a++) { let s = P[obd + a]; for (let j = 0; j < k; j++) s += P[oWd + a * k + j] * z[j]; hh[a] = s; }
    return { c, pre, z, hh, nc };
  };
  let resampled = 0;
  for (let s = 0; s < steps; s++) {
    G.fill(0);
    for (let q = 0; q < batch; q++) {
      const h = hidden(), { c, pre, z, hh, nc } = fwd(h);
      const e = new Float64Array(d); for (let a = 0; a < d; a++) e[a] = (2 * (hh[a] - h[a])) / batch;
      const dpre = new Float64Array(k);
      for (let j = 0; j < k; j++) { if (z[j] > 0) fired[j]++; let dz = l1 / batch; for (let a = 0; a < d; a++) dz += P[oWd + a * k + j] * e[a]; dpre[j] = pre[j] > 0 ? dz * nc : 0; }
      for (let a = 0; a < d; a++) { for (let j = 0; j < k; j++) G[oWd + a * k + j] += e[a] * z[j]; G[obd + a] += e[a]; }
      for (let j = 0; j < k; j++) { if (!dpre[j]) continue; G[obe + j] += dpre[j] / (cosine ? nc : 1); for (let a = 0; a < d; a++) { G[oWe + j * d + a] += (dpre[j] * c[a]) / (cosine ? nc * nc : 1); if (!cosine) G[obd + a] -= P[oWe + j * d + a] * dpre[j]; } }
    }
    step(G);
    for (let j = 0; j < k; j++) { let s = 0; for (let a = 0; a < d; a++) s += P[oWd + a * k + j] ** 2; s = Math.sqrt(s) || 1; for (let a = 0; a < d; a++) P[oWd + a * k + j] /= s; }
    // Resample latents that never fired in the last window toward an input the SAE reconstructs badly.
    if (resample && s > 0 && s % 200 === 0 && s < steps * 0.8) {
      for (let j = 0; j < k; j++) if (!fired[j]) {
        let worst = null, we = -1; for (let t = 0; t < 32; t++) { const h = hidden(), { hh } = fwd(h); const err = h.reduce((acc, x, a) => acc + (x - hh[a]) ** 2, 0); if (err > we) { we = err; worst = h.map((x, a) => x - hh[a]); } }
        const nv = norm(Array.from(worst)) || 1; for (let a = 0; a < d; a++) { P[oWd + a * k + j] = worst[a] / nv; P[oWe + j * d + a] = (0.2 * worst[a]) / nv; } P[obe + j] = 0; resampled++;
      }
      fired.fill(0);
    }
  }
  // Evaluate on fresh samples: L0, fraction of variance explained, dead latents.
  let l0 = 0, se = 0, sv = 0; const ever = new Float64Array(k), mean = new Float64Array(d), hs = [];
  for (let t = 0; t < 2000; t++) { const h = hidden(); hs.push(h); for (let a = 0; a < d; a++) mean[a] += h[a] / 2000; }
  for (const h of hs) { const { z, hh } = fwd(h); for (let j = 0; j < k; j++) if (z[j] > 0) { l0++; ever[j]++; } for (let a = 0; a < d; a++) { se += (h[a] - hh[a]) ** 2; sv += (h[a] - mean[a]) ** 2; } }
  const decoder = Array.from({ length: k }, (_, j) => Array.from({ length: d }, (_, a) => P[oWd + a * k + j]));
  return { P, k, d, fwd, decoder, l0: l0 / hs.length, fve: 1 - se / sv, dead: [...ever].filter((x) => !x).length, resampled };
}
// Which of the toy's learned feature directions does the SAE recover (best decoder cosine > 0.9)?
function recovery(toy, sae, thr = 0.9) {
  const learned = Array.from({ length: toy.n }, (_, i) => col(toy.W, toy.m, toy.n, i)).map((w, i) => ({ i, w, nw: norm(w) })).filter((f) => f.nw > 0.5);
  const best = learned.map((f) => Math.max(...sae.decoder.map((dv) => dot(dv, f.w) / f.nw))); // decoder columns are unit norm
  return { learned: learned.length, recovered: best.filter((c) => c > thr).length, median: round([...best].sort((a, b) => a - b)[Math.floor(best.length / 2)] || 0) };
}

// The SAE and steering toys share one trained toy (12 features in 4 dimensions), trained once per process.
let TOY; const sharedToy = () => (TOY ||= trainToy({ n: 12, m: 4, S: 0.9, decay: 0.95, steps: 1200, batch: 64, seed: 11 }));

const runnersList = [
  {
    id: "superposition", about: "Toy Models of Superposition: n sparse features of falling importance squeezed into m = 2 dimensions",
    params: {
      sparsity: { default: 0.9, min: 0, max: 0.99, step: 0.01, about: "Chance each feature is zero (S)" },
      features: { default: 5, min: 2, max: 8, step: 1, about: "Number of features (n)" },
      decay: { default: 0.9, min: 0.5, max: 1, step: 0.05, about: "Importance of feature i is decay^i" },
      steps: { default: 2500, min: 500, max: 6000, step: 500, about: "Training steps" },
      seed: { default: 1, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "represented", label: "Features stored (|W_i| > 0.5)", better: "higher" }, { id: "mean_dim", label: "Mean dimensionality of stored features", better: "lower" }, { id: "superposed", label: "Features sharing a dimension", better: "higher" }, { id: "loss", label: "Weighted loss", better: "lower" }],
    run({ sparsity, features, decay, steps, seed }) {
      const toy = trainToy({ n: features, m: 2, S: sparsity, decay, steps, batch: 128, seed });
      const D = dims(toy), norms = Array.from({ length: features }, (_, i) => norm(col(toy.W, 2, features, i)));
      const stored = norms.map((x) => x > 0.5), represented = stored.filter(Boolean).length;
      const sd = D.filter((_, i) => stored[i]);
      return {
        metrics: { represented, mean_dim: round(sd.length ? sd.reduce((a, x) => a + x, 0) / sd.length : 0), superposed: sd.filter((x) => x < 0.85).length, loss: round(toy.loss, 4) },
        // The shape the stored feature directions make in the 2-D hidden space, traced in angle order and closed
        // (a pentagon at high sparsity, a line for antipodal pairs, two axes when features are dense).
        series: [{ name: "shape of the stored features (hidden x vs y)", points: (() => { const v = norms.map((_, i) => col(toy.W, 2, features, i)).filter((w) => norm(w) > 0.5).sort((a, c) => Math.atan2(a[1], a[0]) - Math.atan2(c[1], c[0])).map((w) => [round(w[0]), round(w[1])]); return v.length ? [...v, v[0]] : []; })() }],
        notes: [`Geometry: ${geometry(D, represented)}.`, `Dimensionality per feature: ${D.map((x) => round(x, 2)).join(", ")}.`],
      };
    },
  },
  {
    id: "sparse-autoencoder", about: "A sparse autoencoder trained on a toy model's hidden layer, scored against the toy's true feature directions",
    params: {
      latents: { default: 24, min: 4, max: 64, step: 4, about: "SAE dictionary size" },
      l1: { default: 0.1, min: 0, max: 0.3, step: 0.01, about: "Sparsity penalty" },
      resample: { default: 0, min: 0, max: 1, step: 1, about: "1 = resample dead latents toward badly reconstructed inputs" },
      cosine: { default: 0, min: 0, max: 1, step: 1, about: "1 = score latents by cosine, then scale by the input's norm (cosine-scored SAE)" },
      norm_spread: { default: 0, min: 0, max: 1.5, step: 0.1, about: "How much input sizes vary (0 = all the same size)" },
      steps: { default: 1200, min: 400, max: 3000, step: 200, about: "SAE training steps" },
      seed: { default: 2, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "recovered", label: "True features recovered (cosine > 0.9)", better: "higher" }, { id: "fve", label: "Variance explained", better: "higher" }, { id: "l0", label: "Active latents per input (L0)", better: "lower" }, { id: "dead", label: "Dead latents", better: "lower" }],
    run({ latents, l1, resample, steps, seed, cosine = 0, norm_spread = 0 }) {
      const toy = sharedToy();
      const sae = trainSAE(toy, { latents, l1, resample, steps, batch: 64, lr: 0.01, seed, cosine, normSpread: norm_spread });
      const rc = recovery(toy, sae);
      return { metrics: { recovered: rc.recovered, fve: round(sae.fve), l0: round(sae.l0, 2), dead: sae.dead },
        series: [], notes: [`The toy stored ${rc.learned} of its 12 features in 4 dimensions; the SAE recovered ${rc.recovered} (median best cosine ${rc.median}).`, resample ? `${sae.resampled} dead latents were resampled.` : "No resampling."] };
    },
  },
  {
    id: "steering", about: "Clamp one SAE latent and add the SAE error back (feature steering): target change versus collateral change",
    params: {
      clamp: { default: 4, min: 0, max: 10, step: 0.5, about: "Clamp the chosen latent to this multiple of its typical activation" },
      keep_error: { default: 1, min: 0, max: 1, step: 1, about: "1 = add the SAE's reconstruction error back (exact on unedited inputs)" },
      seed: { default: 2, min: 1, max: 999, step: 1, about: "Random seed" },
    },
    metrics: [{ id: "target_gain", label: "Rise in the target feature's output", better: "higher" }, { id: "collateral", label: "Mean change in the other outputs", better: "lower" }, { id: "selectivity", label: "Target gain / collateral", better: "higher" }, { id: "unedited_error", label: "Output error with no edit", better: "lower" }],
    run({ clamp, keep_error, seed }) {
      const toy = sharedToy();
      const sae = trainSAE(toy, { latents: 24, l1: 0.1, resample: 0, steps: 1200, batch: 64, lr: 0.01, seed });
      const { n, m, W, b, S } = toy, r = rng(seed + 100);
      // Pick the latent best aligned with the most important stored feature: the "target".
      const f0 = col(W, m, n, 0), j = sae.decoder.map((dv, jj) => [dot(dv, f0) / (norm(f0) || 1), jj]).sort((a, c) => c[0] - a[0])[0][1];
      const out = (h) => Array.from({ length: n }, (_, i) => { let s = b[i]; for (let a = 0; a < m; a++) s += W[a * n + i] * h[a]; return Math.max(0, s); });
      let typical = 0, cnt = 0, gain = 0, coll = 0, unedited = 0; const N = 400, xs = [];
      for (let t = 0; t < N; t++) { const x = sample(r, n, S), h = Array.from({ length: m }, (_, a) => { let s = 0; for (let i = 0; i < n; i++) s += W[a * n + i] * x[i]; return s; }); xs.push(h); const { z } = sae.fwd(Float64Array.from(h)); if (z[j] > 0) { typical += z[j]; cnt++; } }
      typical = cnt ? typical / cnt : 1;
      for (const h of xs) {
        const H = Float64Array.from(h), { z, hh } = sae.fwd(H), err = h.map((x, a) => x - hh[a]);
        const rebuild = (zz) => Array.from({ length: m }, (_, a) => { let s = sae.P[sae.k * sae.d + sae.k + sae.d * sae.k + a]; for (let q = 0; q < sae.k; q++) s += sae.decoder[q][a] * zz[q]; return s + (keep_error ? err[a] : 0); });
        const base = out(h), same = out(rebuild(z)); unedited += same.reduce((s, y, i) => s + Math.abs(y - base[i]), 0) / n;
        const z2 = Float64Array.from(z); z2[j] = clamp * typical; const ed = out(rebuild(z2));
        gain += ed[0] - base[0]; coll += ed.slice(1).reduce((s, y, i) => s + Math.abs(y - base[i + 1]), 0) / (n - 1);
      }
      const g = gain / N, c = coll / N;
      return { metrics: { target_gain: round(g), collateral: round(c), selectivity: round(c > 1e-9 ? g / c : g * 1e6, 2), unedited_error: round(unedited / N, 4) }, series: [],
        notes: [`Steered latent ${j}, the one best aligned with feature 0 (typical activation ${round(typical)}).`, keep_error ? "The SAE error is added back, so with no edit the output is exactly the model's." : "No error term: even unedited inputs pass through the SAE's imperfect reconstruction."] };
    },
  },
];

module.exports = { runners: runnersList, trainToy, trainSAE, dims, recovery, geometry };
