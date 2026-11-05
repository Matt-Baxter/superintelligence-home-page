---
name: run-a-judge
description: Decide between options (the bake-off between the v0 and Claude versions, or any choice) with a pluggable judge - weighted-criteria, JEV or CLEF - or add a new decision model to decision.judges. Use when asked to judge, score, compare versions, "run JEV/CLEF", or record a bake-off decision.
---

# Run a judge

Judges plug into the `decision.judges` extension point (decision module). Every judge returns transparent weighted totals, a recommendation (or `null`), warnings and, for external models, an agreement check.

1. **Agree on criteria and weights before scoring** (both humans; record them in `docs/BAKEOFF.md`). Never invent the criteria for them.
2. **Score with evidence**: each entry 0-10 per criterion, with a link or a measured fact (test lines, timings, line counts). Missing evidence becomes a warning.
3. **Pick the judge** on `/m/decide` (or `POST /api/judges/:id/run`, or the `run_judge` MCP tool):
   - `weighted-criteria`: computed here; recommends a merge when the top two are within 3 points.
   - `jev`, `clef`: external models. Run them as their owners define; enter their recommendation and rationale. This app only records and cross-checks them. Never make up a JEV or CLEF result or describe how they work.
4. **Read the warnings and the agreement line** before anyone signs off. If an external judge disagrees with the weighted totals, re-check scores and evidence.
5. **Record it**: "Copy result as Markdown" into both bake-off PRs and a change-log row in `docs/CONTRACT.md`; both humans tick their boxes. Agents never sign off.

Adding a decision model (for example a pairwise or ranked-choice judge): `references/judges.md`.
