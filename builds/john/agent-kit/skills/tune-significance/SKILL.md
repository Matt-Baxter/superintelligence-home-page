---
name: tune-significance
description: Change how stories are judged - update type, evidence level, frontier claims, benchmark points and the 0-100 significance score in lib/analysis.js - and keep every point explainable. Use when the ranking looks wrong, when asked to weight something more or less, or to add a new signal.
---

# Tune significance

`lib/analysis.js` is rule-based on purpose: free to run, deterministic, and every point appears as a `why` line on the story page. Keep it that way: no paid model calls in the request path.

1. **Find the story and its `why` lines**: open `/story?id=…` or `GET /api/stories/:id` → `story.analysis.why`.
2. **Decide which factor is wrong** (evidence, coverage, kind of update, benchmarks, frontier signals, capability areas, watched people, community attention). Current weights and the reasoning behind them: `references/scoring.md`.
3. **Change one thing**: a regex in `TYPES` or `FRONTIER`, a weight, or a cap. A new signal must call `add(points, factor, detail)` so it shows up in the explanation.
4. **Add a unit check** in `test/analysis-unit.js` with a synthetic sentence that shows the change (labelled "(test data)").
5. Run `node test/analysis-unit.js` and the browser test. The browser test checks that every score equals the sum of its `why` lines and that the significance sort is ordered.
6. Existing stories are re-scored by Admin → Ontology → "Re-tag every story".

Changing what's stored in `analysis` (new fields) is additive but still a contract row (change-the-contract skill).
