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
