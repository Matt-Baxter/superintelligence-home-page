# Writing a judge

```js
// modules/<your-module>/module.js
module.exports = {
  id: "<your-module>", version: "0.1.0", description: "Adds the pairwise judge.", requires: ["decision"],
  setup(ctx) {
    const judges = ctx.point("decision.judges");
    judges.add({
      id: "pairwise", name: "Pairwise", method: "builtin",          // or "external" for a model run elsewhere
      description: "What it computes and when it recommends what, in one or two sentences.",
      judge(input) {                                               // input: { title, criteria, entries, scores, external? }
        const w = judges.weighted(input);                          // shared, transparent totals from the decision module
        // … your rule …
        return { judge: "pairwise", method: "builtin", ...w, recommendation: { entry: w.totals[0].entry, label: w.totals[0].label, reason: "…" } };
      },
    });
  },
};
```

Rules:
- Pure function of its input: no network, no database, no randomness, so the same scores always give the same verdict.
- Always return the weighted totals (or your equivalent) so humans can see the arithmetic behind the recommendation.
- Throw an error with `status: 400` for unusable input (fewer than two entries, no weighted criteria).
- External judges: require `input.external.recommendation`; return `recommendation: null` and a warning when it's missing; add `agreement` comparing it with the computed leader.
- Add a check in `test/kernel-unit.js` with synthetic scores and an exact expected result.

Result shape (rendered by the Verdict and Scorecard blocks): `totals: [{ entry, label, total 0-100, perCriterion: [{ criterion, label, weight, score, weighted, evidence }] }]`.
