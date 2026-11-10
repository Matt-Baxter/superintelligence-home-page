# decision

Pluggable judges for bake-offs and other choices.

- **Owns** the `decision.judges` extension point. A judge is `{ id, name, description, method: "builtin" | "external", inputs?, judge(input) → result }`. Input: `{ title, criteria: [{id, label, weight}], entries: [{id, label, link?}], scores: {entry: {criterion: {score 0-10, evidence}}}, external? }`. Result: `{ judge, method, criteria, totals, ranking, margin, warnings, recommendation, agreement? }`. Use `score.js` (`weighted()`) for the shared arithmetic.
- **Judges**: `weighted-criteria` (builtin: weighted totals; recommends a merge within 3 points), `jev` and `clef` (external: they record a run of that model and cross-check its recommendation against the weighted totals; this repo doesn't define how JEV or CLEF work).
- **Blocks**: `Scorecard`, `Verdict`. **View**: `bakeoff-sample` (synthetic test data). **Routes**: `GET /api/admin/decision/judges`, `POST /api/admin/decision/judges/:id/run` (admins; nothing is stored). **Page**: `/m/decide`.
