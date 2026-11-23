// Arena sandbox: a Web Worker that runs Lab experiments in the reader's browser. It holds only pure computation
// (deterministic runners, the decision gym and the si-expr interpreter), has no access to the page, cookies or the
// server, and the page kills it if a run goes over its time budget. Built to public/m/lab-sandbox.js by npm run build.
const L = require("../lab");
const G = require("../gym");
const { evaluate } = require("../../../lib/expr/eval");
const { rng } = require("../runners");

const handlers = {
  // Run one example with params (the reproduction is the example's own params).
  example({ id, params }) {
    const e = L.BY_ID[id]; if (!e) throw new Error(`No example "${id}"`);
    const base = L.run(e.reproduce.runner, e.reproduce.params);
    const variant = L.run(e.reproduce.runner, { ...e.reproduce.params, ...params });
    return { baseline: base, variant, verdict: L.verdict(e, base, variant) };
  },
  // Score an edited policy (si-expr JSON) on fresh requests and the safety properties; compare with a reference policy.
  policy({ policy, reference, n = 400, seed = 77, rare = 0.35 }) {
    if (!policy || typeof policy !== "object") throw new Error("The policy must be an si-expr JSON object");
    const held = G.gen(rng(seed), n, { rare });
    const score = (p) => {
      const wrong = []; let right = 0;
      for (const h of held) { let d; try { d = G.decide(p, h.text); } catch (err) { throw new Error(`The policy failed to evaluate: ${err.message}`); } if (d === h.action) right++; else if (wrong.length < 12) wrong.push({ text: h.text, want: h.action, got: d }); }
      return { accuracy: Math.round((right / held.length) * 1000) / 1000, wrong, properties: G.PROPERTIES.map((x) => ({ id: x.id, about: x.about, holds: (() => { try { return x.check(p); } catch { return false; } })() })) };
    };
    return { candidate: score(policy), reference: reference ? score(reference) : null, n };
  },
  // Route one request with a policy and show the decision.
  decide({ policy, text }) { return { action: G.decide(policy, text) }; },
  // Evaluate any si-expr rule on data (the rule playground).
  evaluate({ rule, data }) { return { value: evaluate(rule, data || {}) }; },
};

self.onmessage = (ev) => {
  const { id, kind, payload } = ev.data || {};
  const t0 = performance.now();
  try { const result = handlers[kind](payload || {}); self.postMessage({ id, ok: true, result, ms: Math.round(performance.now() - t0) }); }
  catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err), ms: Math.round(performance.now() - t0) }); }
};
