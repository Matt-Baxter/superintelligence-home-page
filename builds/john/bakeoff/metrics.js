// Two lenses on an analysis run.
// CLEAR rates the analysis itself: Cost, Latency, Efficacy, Assurance, Reliability.
// CLEF-style ranked-retrieval metrics rate the feed's top-k against binary relevance labels.
// Labels here come from the rule tagger (title only), so they are a lower-bound proxy until both
// partners' judgments in evidence.json replace them.
"use strict";

const round = (x, d = 3) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

function clear(build) {
  const steps = build.steps || [];
  const decided = steps.filter((s) => s.verdict === "pass" || s.verdict === "fail").length;
  const informative = steps.filter((s) => s.verdict !== "unknown").length;
  const grounded = steps.filter((s) => s.shot || s.evidence?.kind === "measure").length;
  return {
    cost: { modelCalls: 0, usd: 0, note: "Browser and rules only; no model calls." },
    latencyMs: build.durationMs,
    efficacy: { decided, informative, of: steps.length, rate: round(decided / (steps.length || 1)) },
    assurance: { grounded, of: steps.length, rate: round(grounded / (steps.length || 1)) },
    reliability: { consoleErrors: (build.consoleErrors || []).length, corrections: (build.critiqueTrace || []).filter((t) => t.changed).length },
  };
}

function dcg(rels) { return rels.reduce((sum, r, i) => sum + r / Math.log2(i + 2), 0); }

function clef(sample, k = 20) {
  const top = (sample || []).slice(0, k);
  const rels = top.map((s) => s.rel);
  const hits = rels.reduce((a, b) => a + b, 0);
  const ideal = [...rels].sort((a, b) => b - a);
  let precSum = 0; let seen = 0;
  rels.forEach((r, i) => { if (r) { seen++; precSum += seen / (i + 1); } });
  return {
    k: top.length,
    labels: "rule tagger on title (proxy)",
    precisionAtK: round(top.length ? hits / top.length : null),
    ndcgAtK: round(dcg(ideal) ? dcg(rels) / dcg(ideal) : null),
    averagePrecision: round(hits ? precSum / hits : null),
    target: 0.9,
  };
}

module.exports = { clear, clef, dcg };
