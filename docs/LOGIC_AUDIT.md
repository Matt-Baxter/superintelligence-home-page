# End-to-end logic and readiness audit, 2026-11-07

Scope: shared spec 001, the implemented research layer, and the work-tracking path. This audit does not approve proposed requirements or claim that every optional feature is complete.

## Findings and corrections

| Requirement | Trigger and prior behavior | Correction | Evidence |
| --- | --- | --- | --- |
| REQ-003 | Legacy stories with NULL scope passed the feed filter, including rows beyond a boot backfill batch | Only an explicit positive scope decision admits a story | `test/scope-admission.js`: real feed and detail APIs on SQLite and PostgreSQL |
| REQ-015, SC-007 | Acceptance covered a second sign-in but did not restart the application | Restart the fixture server against the same database and check existing sessions, votes and saves | `test/spec-acceptance.js`: process-restart scenario |
| REQ-010 | Signing in from a workspace fragment returned to its default page instead | Preserve the full local return path and validate its origin | Browser deep-link and return-path checks |
| Proposed 002/REQ-030 | A passing result could mask a failing result for the same requirement; status prose always claimed only delivery remained | Failed evidence takes precedence; uncovered and malformed evidence fails the command; prose distinguishes local checks from production facts | `test/spec-status-unit.js` |
| Proposed 002/REQ-030 | Generated issue descriptions and scope labels went stale; substring sync-key lookup could confuse identifiers | Exact identity matching, duplicate/ambiguity rejection, source-owned context refresh and notes preservation | `test/sync-source-unit.js`, `test/project-sync-unit.js` |
| Proposed 002/REQ-030 | Spec 004 tasks appeared as open work despite its explicit T000 approval prerequisite | Specs view and mirrored task context show the actual approval gate; completed work and people decisions remain separate | `test/project-specs-unit.js`, browser Specs scenarios |

## One source for each question

[START_HERE.md](START_HERE.md) is the navigation entry point. Requirements stay in specs; implementation/check links stay in [SPEC_TRACE.md](SPEC_TRACE.md); measured status stays in [SPEC_STATUS.md](SPEC_STATUS.md); build-specific shapes stay in [INTERFACES.md](INTERFACES.md). The app reads those sources for `/m/project#/specs`; sync mirrors their context into issues without granting approval. Historical handoffs are snapshots, not completion evidence.

## Human and deployment gates

- Shared REQ-019 (live delivery), REQ-020 (human-written log), and live-site SC-001/004/007/008 still need the partners. No deployment or agent-log entry was performed.
- Existing `vercel.json` declares four daily cron slots. Deployment settings must be reviewed against the repository's daily-only/free-tier rules before delivery. This audit did not change platform settings or deployment configuration.
- Proposed requirements remain proposed, and the REQ-032..035 numbering collision needs both partners. Spec 004 explicitly blocks implementation until T000 is resolved.
- Live model panel/advisor behavior, human calibration, full-text paper evidence and compiler-checked Lean proofs remain unverified. Two judge edge cases and two generated property gaps remain tracked by their existing suites.

## Validation

| Check | Result |
| --- | --- |
| Preflight | `Preflight passed.` |
| Shared acceptance, with browser and process restart | 48 passed, 0 failed; 18/20 requirements automated, 2 need people; 19/19 scenarios |
| Full browser, SQLite | `219 passed, 0 failed`; `page errors: none` |
| Full browser, PostgreSQL | `219 passed, 0 failed`; `page errors: none` |
| Scope-admission HTTP regression, SQLite / PostgreSQL | 4 passed, 0 failed on each |
| Tracker-sync integration, SQLite / PostgreSQL | 11 passed, 0 failed on each |
| Status-report regressions | 9 passed, 0 failed |
| Source-block regressions | 6 passed, 0 failed |
| Specs parser and approval gates | 25 passed, 0 failed |

 Synthetic fixture checks verify local code paths and database behavior; they do not prove live-source quality, production deployment, all provider failures or every possible concurrent execution.

## Shared performance and analysis pass — 2026-11-07

This pass serves REQ-002/003/005 and fixes existing research dossier/source behavior (REQ-031/033 in spec 002). It does not approve proposed specifications or deploy anything.

### Implemented

- Newest, votes and significance order/page in the database; only the requested page is transferred to the application. Stable timestamp/ID tie breaks prevent arbitrary page overlap. Top still uses the original time-decay calculation over all matching rows. Source links are grouped once instead of repeatedly scanning the whole link list for every story. Guest reads skip personal vote/save/note subqueries.
- Public feed metadata and ontology requests start together; sign-in entry avoids an ontology request. Knowledge graph and passage requests run together, render as one selection and reject stale responses.
- A validated, indexed topic hierarchy supplies every ancestor to tagging, scope-root lookup and dossier descendants. Missing parents, duplicate IDs and cycles fail fast; existing nine top-level topics and terms are unchanged.
- Attention values are finite, nonnegative integer counts within the shared database range. Invalid values cannot create negative or non-finite significance factors. Rising counters on an already linked item now rescore the story. This remains a bounded attention signal, never research evidence.
- Venue names or generic “science” text alone no longer imply the existing peer-review upgrade. Explicit submission/rejection/negation, including contractions, blocks that upgrade. Affirmative acceptance wording remains a heuristic cue, not verified peer-review status. Coverage says linked sources, not independently owned sources.
- Buzz uses valid UTC calendar dates, rejects missing/invalid/future dates and excludes invalid hype values from the mean. Dossiers keep canonical feed scores, preserve zero, exclude unclassified/hidden stories and count source identities rather than names. Uncatalogued links remain represented without a fabricated reader attribution.
- Knowledge text reads enforce current story admission. Rebuilds refresh metadata changes on unchanged text, replace derived edges transactionally, retain forecast edges and purge ineligible chunks. Scheduled pruning also rebuilds co-occurrence from remaining admitted passages, preserving other edge kinds. Stale co-occurrence is withheld pending refresh. Participating Postgres story rows are share-locked during finalization so concurrent moderation cannot invalidate the selected inputs mid-replacement.
- Node diagrams use spaced rows rather than overlapping radial labels, preserve full identifiers in titles/text alternatives, support keyboard exploration and keep chart panning inside its own region on phones.

### Evidence and interpretation

`test/pipeline-quality-unit.js` covers the new hierarchy, scalar, date, evidence, buzz and canonical-score cases. `test/story-page-unit.js` runs real HTTP/database checks on both engines: stable order, bounded row transfer, private state, admission, attention rescore, knowledge reads, stale graph withholding, metadata refresh and forecast-edge preservation. The fixture contains 240 admitted matches plus hidden and unclassified rows. Each new/votes/significance page materializes exactly 40 story rows in the application. This is a verified reduction in row transfer, not a claim of a measured production latency multiplier.

The accepted 25-metric benchmark has no regressions. New targeted regressions demonstrate the additional defects; they are not a new statistically representative paper-quality evaluation. All data in these checks is synthetic.

### Remaining limits

- Top ranking is not yet pushed into portable SQL; large-result-set Top requests still need profiling and a separate design.
- Unicode token-boundary parity remains a known follow-up across Node/Python/Rust. For example, embedded Unicode-letter acronym cases need coordinated portable-operator/vector changes, not a tagger-only patch.
- Existing stored story tags/scores require the normal admin re-tag operation after a future rollout; the Knowledge index must then be rebuilt. This pass did not mutate hosted data or run live harvesting. Old malformed publication metadata needs a separately reviewed backfill; new ingestion is normalized.
- Analysis uses stored titles/summaries and reviewed excerpts under existing rules; it does not independently verify every paper, outlet or community comment. Full-text storage and new source-label vocabulary remain subject to their existing agreements.
- Lab timings and fixture row counts are not field Core Web Vitals or real-device accessibility certification. Broader bundle budgets, production profiling and the remaining research ideas stay tracked separately.

### Verification of this pass

- Pipeline quality: `37 passed, 0 failed`.
- Isolated HTTP/database regression: `17 passed, 0 failed` on SQLite and PostgreSQL, including passage-prune graph cleanup.
- Full SQLite and PostgreSQL browser suites: each `330 passed, 0 failed`; `page errors: none`. The extended profile bundle was rebuilt before the Postgres suite; the default preflight bundle intentionally contains no extended blocks.
- Preflight: `Preflight passed.`
- Local demo emulations: `24 passed, 0 failed`; guest, reader and admin; 390/1280 pixels; light/dark; `page errors: none`.
- Benchmark: `25 metrics, 0 uplift, 0 regressions` against the accepted baseline.
- Phone graph screenshot: [synthetic Knowledge fixture](../shots/optimization-knowledge-phone.png).

## Connected navigation and content management — 2026-11-07

The Content desk previews imported research records, traces source coverage and harvest history, and reversibly moderates visibility with an atomic audit receipt. It never rewrites publisher titles, summaries or relevance outcomes. Shared breadcrumbs and a searchable directory derive from the active role-filtered navigation; story records link directly to their explanation, topic feed, dossier, graph node and admin record. Qualified graph references resolve the exact saved review rather than dropping readers at an unrelated catalog.

Original publishing lives in its own extended-only Editorial CMS. Admins create drafts, preview plain text, save revisions, restore retained versions, publish a specific snapshot and unpublish it. Draft edits/restores leave the live snapshot unchanged. Expected-revision comparisons reject stale concurrent edits; every successful mutation includes the post, retained revision and admin audit receipt in one transaction. Public APIs return only published snapshots. Guest and reader access to authoring APIs is denied.

Limits: 200 original posts, 20 retained revisions per post, 20,000 body characters, plain text only. No automatic publishing, rich HTML, imported full articles, media uploads, collaborative live editing, scheduled releases, hosted deployment or external CMS integration is claimed. Existing proposed requirements remain proposed; no shared specification or approval gate was changed.

### Validation of connected content workflows

- Full browser suite: SQLite and PostgreSQL each `334 passed, 0 failed`; `page errors: none`.
- Content desk HTTP/database regression: SQLite and PostgreSQL each `14 passed, 0 failed`, including atomic moderation/audit rollback and stale-visibility rejection.
- Editorial HTTP/database regression: SQLite and PostgreSQL each `18 passed, 0 failed`, including serialized near-cap creation, concurrent revisions, live/draft separation, unpublish, revision retention, audit rollback and spec-profile exclusion.
- Dedicated CMS browser journey: SQLite and PostgreSQL each `32 passed, 0 failed`; `CMS page errors: none` (`npm run test:cms` after the full fixture suite): private draft, safe preview, explicit publication, preserved live text during edits, restore, unpublish, exact graph-to-review navigation, protected authoring APIs, and 390/1280-pixel light/dark layouts. Every record used is synthetic.

The independent review found and corrected a pending-save data-loss risk: inputs are now disabled with `aria-busy` while a save or restore is pending. A held-request browser regression verifies that newer keystrokes cannot be silently overwritten. The first browser run also caught short-viewport feed geometry; root navigation now shares the existing results row instead of adding another row above the first story.

The module validation command in the extended profile still reports pre-existing review/research cross-module imports and missing README files. The new editorial module uses kernel extension points without those imports. Default-profile preflight and both full browser suites remain the reported checks; this pass does not claim all extended architectural boundaries were repaired.

Final review also identified and corrected a concurrent-create quota race. Postgres now holds a database-local advisory transaction lock while checking and admitting original posts; the near-cap test accepts exactly one of two simultaneous creates at 199 records and verifies the 200-record limit.

Final checks: `Preflight passed.`; demo role emulations `24 passed, 0 failed`; `page errors: none`. The local demo includes one clearly labeled, unpublished sample draft for trying the editor. [Editor screenshot](../shots/cms-editorial-demo.png).
