# Tasks: Feature parity with AI-news and research apps

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Survey**: [`docs/PARITY.md`](../../docs/PARITY.md)

Any agent (Codex, v0, Claude or another) picks up work here. `scripts/project-sync.js` mirrors every task below into the Project tracker (`/m/project`) as one issue, and its status follows the checkbox: tick a task in the same commit that finishes it.

**Who may do a task**

- `[agent]`: any agent may do it unattended, on a `feature/` branch: extended-version features behind a profile flag, tests, synthetic sets, docs. It changes no scoring rule.
- `[rules]`: changes how items are scored or ranked. An agent does it only when a person asks for it in a session, on a `feature/` branch, with `npm run bench` showing no regressions.
- `[people]`: John and Matt decide.

Nothing below starts until T000 is done. **Format**: `- [ ] T### [who] [REQ-0xx] description (files)`. Mark `[P]` when it can run in parallel with others.

## Phase 0: approval and decisions

- [ ] T000 [people] [REQ-041] Approve, change or drop REQ-041..REQ-052 (this spec), and confirm that mute rules and an opt-in reader model count as preferences kept like votes and saves under REQ-012. Until then it's extended-version only and unbuilt.
- [ ] T001 [people] [REQ-045] Decide whether the Atom feeds are public (titles and links only) or need a per-reader token in the URL
- [ ] T002 [people] [REQ-044] Agree the source-label vocabulary (role, review status, independence) and who labels the catalog
- [x] T003 [agent] Public-features survey of 35 apps and our column checked against the code; ranked gaps (docs/market/apps.json, docs/PARITY.md)

## Phase 1: find and filter (REQ-042, REQ-046)

- [ ] T010 [agent] [P] [REQ-042] Synthetic search set (Sample stories, queries and expected hits, incl. hyphenated and accented terms) and bench metric `parity.search_recall` (bench/search-cases.json, scripts/bench.js)
- [ ] T011 [agent] [REQ-042] Full-text index: FTS5 on SQLite, `tsvector` + GIN on Postgres, `db.search()` with LIKE fallback, rebuilt on re-tag; same top 10 on both databases (lib/db.js, server.js, lib/harvest.js, docs/INTERFACES.md)
- [ ] T012 [agent] [P] [REQ-046] Mute rules: `user_mutes` table, `/api/mutes` routes, applied in feed and brief queries with a hidden count; profile feature `mute` (server.js, lib/db.js, public/index.html, modules/profiles.json, docs/INTERFACES.md)
- [ ] T013 [agent] [REQ-046] Mute leak check on the fixtures: 0 muted stories in any sort or the brief; bench metric `parity.mute_leak` (test/mute-unit.js, scripts/bench.js)

## Phase 2: coverage and labels (REQ-043, REQ-044)

- [ ] T020 [agent] [P] [REQ-043] Return `seen_at` per link; coverage panel ordered by first seen with lag (server.js `shapeStory`, public/story.html)
- [ ] T021 [agent] [REQ-043] Brief block listing significant single-source stories of the week (views/specs.mjs, server.js `/api/brief`)
- [ ] T022 [agent] [P] [REQ-044] Source-label field in the default sources and the catalog, shown on cards and the panel, "unlabelled" when absent (lib/sources.json, lib/source-catalog.json, public/js/api.js, schema/types.json)
- [ ] T023 [rules] [REQ-044] Use the label as a visible significance input, every point explained (lib/analysis.js, bench/baseline.json)

## Phase 3: take it with you (REQ-045, REQ-049, REQ-050)

- [ ] T030 [agent] [REQ-045] Atom 1.0 feeds per topic and for the brief, edge-cached, validated in a unit check (modules/feeds-out or server.js, test/atom-unit.js, docs/INTERFACES.md)
- [ ] T031 [agent] [P] [REQ-045] "New since your last visit" marker from a time kept in localStorage only (public/index.html, public/js/api.js)
- [ ] T032 [agent] [P] [REQ-049] `GET /api/me/export?format=json|csv` (own saves, lists, notes only) and public `/sources.opml` of active sources (server.js, modules/admin/routes.js, docs/INTERFACES.md)
- [ ] T033 [agent] [REQ-050] Web app manifest and service worker caching the shell and saved-list cards, cleared on sign-out; phone-width check (public/manifest.webmanifest, public/sw.js, public/index.html)

## Phase 4: research layer (REQ-047, REQ-048)

- [ ] T040 [agent] [REQ-047] Keep code, model and dataset URLs from abstracts and HF paper entries as `artifact` entities, refuse Twitter/X, badge on cards, offer to the Lab (lib/feeds.js, lib/harvest.js, public/js/api.js, modules/lab/papers.js)
- [ ] T080 [people] [REQ-048] Check the free tier and terms of the Semantic Scholar Graph API and OpenAlex for on-demand, cached use, and pick one
- [ ] T041 [agent] [REQ-048] Citation neighbourhood route with a 30-day cache table, pruned, failures shown on the page; tested with a fixture in place of the API (modules/review or a new module, test/neighbours-unit.js, docs/INTERFACES.md)

## Phase 5: personalisation (REQ-041)

- [ ] T050 [agent] [P] [REQ-041] Synthetic reader set (Sample readers with votes and saves, expected top topics) and bench metric `parity.foryou_precision_at_10` (bench/reader-cases.json, scripts/bench.js)
- [ ] T051 [rules] [REQ-041] Opt-in "For you" sort: per-reader logistic regression over TF-IDF of stored titles and summaries, reason words per pick, model deleted on opt-out, at least 5 votes or saves (lib/personal.js, server.js, public/index.html)

## Phase 6: votes and the public log (REQ-052, REQ-051)

- [ ] T060 [agent] [REQ-052] Daily vote cap with a clear message; un-voting always allowed (server.js `limit`, test)
- [ ] T061 [rules] [REQ-052] Lower rank weight for accounts under a day old, listed in the rank explanation (server.js `storyRows`, lib/analysis.js)
- [ ] T062 [agent] [REQ-052] Optional agree/disagree mark in its own table, shown apart from votes, never read by rank (lib/db.js, server.js, public/story.html, docs/INTERFACES.md)
- [ ] T070 [agent] [REQ-051] Public append-only change log of rule and ontology versions and moderation actions without admin names, pruned to a year (lib/audit.js, lib/db.js, a public page, docs/INTERFACES.md)

## Phase 7: keep the survey current

- [ ] T090 [agent] When a gap closes, update our column in docs/market/apps.json and docs/PARITY.md; the count of missing and partial dimensions only goes down (SC-406)
