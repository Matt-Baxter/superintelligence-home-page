// Shared helpers for the Lab runners (runners.js, interp.js, papers.js): one seeded PRNG, one Gaussian, one rounding
// rule and one seed-averaging rule, so every toy repeats exactly and reports numbers the same way.
// Seeded PRNG (mulberry32) so runs repeat exactly.
function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Standard normal draw (Box-Muller) from a seeded PRNG.
const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// Round to d decimals. Callers that need a different precision say so (runners.js reports 4).
const round = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
// Mean metrics over `seeds` runs (seed, seed + 101, seed + 202, ...); series and notes come from the first seed and say so.
function averaged(fn, p, seeds = 10) {
  const runs = Array.from({ length: seeds }, (_, i) => fn({ ...p, seed: (p.seed || 1) + i * 101 }));
  const metrics = Object.fromEntries(Object.keys(runs[0].metrics).map((k) => [k, round(mean(runs.map((x) => x.metrics[k])))]));
  return { ...runs[0], metrics, notes: [...runs[0].notes.map((n) => `${n} (first seed)`), `Metrics are the mean of ${seeds} seeds.`] };
}
module.exports = { rng, gauss, round, mean, averaged };
