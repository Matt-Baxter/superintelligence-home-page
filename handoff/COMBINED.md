# Combined build, 2026-11-07

Current navigation and logic findings: [project index](../docs/START_HERE.md) and [logic audit](../docs/LOGIC_AUDIT.md). The validation table below is the original integration snapshot.

Proposed REQ-030: integration on `feature/si-combined`, starting at sync head `71cce78`, squashing fidelity head `6e885de` without importing its history, then applying the badge feature. Both original branch tips remain available. The shared spec, constitution, contract and working agreement are unchanged.

Preserved: research site/feed/control room, source grades, forecasts/Brier, bias-masked panel/advisor, reporting rubric and withdrawal guards; canonical text, abstract-first watcher, fidelity checks, bands, proof vectors, MoE toy, Specs view and 35-app survey. Approval issues and trace evidence are scoped by spec while requirement numbers await both partners.

The combined tree was checked locally with synthetic fixtures on both database engines. Historical results in other handoff files are snapshots, not proof of this integration. Quality was rerun using the existing local watcher input, without live model calls: 5 of 6 checks hold; panel coverage remains unavailable. The copied article summaries are inherited inputs, not freshly verified primary-source research.

Human decisions: approve proposals and numbering, check Lean with its compiler, configure live models, write the agent log and deploy. No production settings or shared approvals were changed.

## Validation

| Check | Exact result |
| --- | --- |
| Preflight | `Preflight passed.` |
| Benchmark union (14 labelled review items) | `bench: 25 metrics, 0 uplift, 0 regressions` |
| Judge edge cases | `judge edge cases: 72 passed, 0 regressions, 2 known gaps` |
| Review | `review unit: 59 passed, 0 failed` |
| Sources | `sources unit: 31 passed, 0 failed` |
| Panel, including withdrawal preservation | `panel unit: 24 passed, 0 failed` |
| Bands | `bands unit: 44 passed, 0 failed` |
| Dossier | `dossier unit: 19 passed, 0 failed` |
| Watcher | `watch unit: 15 passed, 0 failed` |
| Project sync | `project sync unit: 7 passed, 0 failed` |
| Specs, including scoped evidence and all proposal sets | `project specs unit: 23 passed, 0 failed` |
| Research feed | `research feed: 24 passed, 0 failed` |
| Badge integration | `rigor badge: 6 passed, 0 failed` |
| Badge with phone browser | `rigor badge: 9 passed, 0 failed` |
| Full browser, SQLite | `193 passed, 0 failed`; `page errors: none` |
| Full browser, PostgreSQL 18.6 (temporary local cluster) | `193 passed, 0 failed`; `page errors: none` |
| Existing watcher-input quality run | `quality: 5 of 6 checks hold` (panel coverage unavailable) |

Browser runs include spec acceptance and phone widths. The badge browser check is opt-in with `BADGE_BROWSER=1 node --no-warnings test/rigor-badge.js`; ordinary preflight remains browser-free. Test tooling and the PostgreSQL cluster were installed outside the repo in a temporary directory; no production database or settings were used. The badge screenshot is generated locally at `out/combined/rigor-badge-phone.png`.

Known limits: two edge cases and two generated property gaps remain reported; the Lean model has not been compiler-checked; model behavior was tested with stand-ins, not live providers. Quality on inherited summaries is an internal-consistency check, not human calibration or primary-source verification.
