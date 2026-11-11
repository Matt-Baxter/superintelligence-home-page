<!-- trace-spec: 001 -->
# Spec traceability: John's build

How this build meets the shared spec ([specs/001-superintelligence-homepage/spec.md](https://github.com/Matt-Baxter/superintelligence-home-page/blob/claude/youthful-fermat-iyku15/specs/001-superintelligence-homepage/spec.md), on Matt's branch until it merges). Test names are the check names printed by `npm test` and `npm run preflight`.

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-001 | 8+ superintelligence sources, 5+ kinds, fetched on a schedule | `lib/sources.json` (11 sources, 5 kinds), `lib/harvest.js`, `vercel.json` crons | unit: "REQ-001: 8+ sources across 5+ kinds" |
| REQ-002 | Feed newest first; title, sources, topics, link | `server.js` default sort `new`; `storyCard` in `public/js/api.js` | e2e: public guest feed and story-detail checks in "Public orientation and account access"; "REQ-002: the feed is newest first by default"; "Reader robustness" covers stale responses, retry and pagination; "Reading quality" covers inline evidence, true factor values and story navigation; "Research wave 1" and `test/ui-date-unit.js` cover exact-date disclosure and sort explanations; unit: lineage (docs/LINEAGE.md) |
| REQ-003 | Only superintelligence stories | `scope` in `lib/ontology.json`, `scope()` in `lib/analysis.js`, `stories.in_scope`, `storyRows` filter | e2e: "REQ-003 / SC-003" (both); unit: scope checks; HTTP regression `test/scope-admission.js` (unclassified/off-topic rows excluded); `test/story-page-unit.js` extends admission to dossiers and knowledge reads; unit: lineage (docs/LINEAGE.md) |
| REQ-004 | Duplicates grouped into one story | `storyKeys` in `lib/feeds.js`, `addItem` in `lib/harvest.js` | e2e: grouping checks in "Feed" |
| REQ-005 | Topics with the words that matched | `lib/tagger.js`; scope reason on the story page | e2e: "US1-5 / REQ-005", "REQ-005: the story page says why"; `test/pipeline-quality-unit.js` checks full ancestor closure and valid graph references; unit: lineage (docs/LINEAGE.md) |
| REQ-006 | No Twitter/X, as source or link | `addItem` drops x.com/twitter.com links; admin and suggest refuse them; preflight and guard hook | e2e: "REQ-006: an item linking to Twitter/X is dropped", "Twitter/X is refused" |
| REQ-007 | Link out, no full text | Stories store title, summary (capped at 1,500 chars) and URL only | e2e: story links |
| REQ-008 | A failing source doesn't stop the feed | `harvestSource` never throws; backoff | e2e: "catalog: … failures reported", "a failing source backs off" |
| REQ-009–012 | Accounts, stay signed in, hashed passwords, no extra personal data | `server.js` auth (scrypt, session cookie, 30-day sessions) | e2e: "Accounts" and "Public orientation and account access" sections; `test/demo-access.js` verifies isolated local role testing; `test/demo-e2e.js` emulates guest/reader/admin flows at phone/desktop widths in both themes |
| REQ-013–016 | One vote per user per story, saves, kept per user, enforced by the server | `server.js` votes and saves routes | e2e: "Votes and saves" section, "saves are per user"; "Reader robustness" covers pending actions, failures and saved-page removal; acceptance: session/vote/save persistence across a server process restart |
| REQ-017 | Filter by topic | topic bar = the nine spec topics | e2e: "topic filter", "US4"; "Reader robustness" covers URL state, Back and clear filters; "Reading quality" covers individual filter removal and paginated return context; "Research wave 1" covers preserved topic filters and active-topic visibility |
| REQ-018 | Laptop and phone, no sideways scroll | `public/css/app.css` | e2e: "Phone width" and "Reader robustness": 320, 390, 768 and 1280px, both themes, mobile menu and filter disclosure; "Reading quality" checks 676×504 content visibility, evidence reflow and reduced motion; "Research wave 1" checks direct guest navigation at 320/390px |
| REQ-019 | Live 2+ weeks before the presentation | `docs/DEPLOY.md` (humans deploy) | not automated |
| REQ-020 | Human-written agent log in the repo | `AGENT_LOG.md` (the partners write it; agents never do). The app has no agent log page: `/agent-log` redirects to the file; old in-app entries can be exported once from `/api/admin/agent-log.md` | e2e: "Agent log" section; preflight smoke "no in-app agent log" |


<!-- trace-spec: 002 -->

## Research layer (proposed, `specs/002-research-layer/spec.md`; extended version; needs both partners)

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-021 | "How it works" teardown | `modules/learn` (teardown) | e2e: "Learn" section |
| REQ-022 | Dependent form fields stay consistent | not built (proposed, low priority) | not automated |
| REQ-023 | Concepts in plain words, graph | `modules/learn/data/concepts.json`, `/m/learn`, `/m/map` | e2e: "Learn" section, graph connection evidence; `test/graph-logic-unit.js`; `test/cms-e2e.js`; review demo: "Map" |
| REQ-024 | Background studio jobs | `learn_jobs`, `scripts/learn-worker.js`; the watcher queues `paper-to-code` | e2e: "Learn" section; unit: watch "queued for paper-to-code" |
| REQ-025 | Explainer video and drafts, people publish | `modules/learn` explainer, RSS of published posts | e2e: "Learn" section |
| REQ-026 | Worked examples, refuted kept, sources, sandbox | `modules/lab` (`examples.json`, `runners.js`, `interp.js`, `papers.js`), `/m/lab`, `/m/arena` | unit: lab, papers; arena demo; e2e: "refuted hypotheses are kept" |
| REQ-027 | Review desk with anti-gaming guards | `modules/review` (`review.js`, `store.js`), `/m/review` | unit: review (24 checks); review demo; bench `review.*` |
| REQ-028 | Daily paper watch | `scripts/watch.js`, `modules/review/watch.json`, `.github/workflows/paper-watch.yml` | unit: watch (5 checks) |
| REQ-029 | Benchmarks with a ratchet, and the accuracy paradox guard | `scripts/bench.js`, `bench/`; `lib/metrics.js` (balanced accuracy, MCC, kappa, Wilson interval, majority baseline) on every labelled classifier in the bench, the verification ratchet's held-out gate (`heldoutGate`), person-labelled verdicts on the Review desk and the control room (`honestyBlock`) | preflight "Benchmarks", "Accuracy paradox guard" (`test/metrics-property-unit.js`, 800 generated sets); e2e "REQ-029" in the control room; real-data quality report `scripts/quality.js` (unit: quality, 3 checks) |
| REQ-031 | Topic dossier: traced analysis, blog, posts, video | `modules/review/dossier.js`, `/m/dossier`, `/api/review/dossier/:topic`, evidence index `/m/evidence` and `/api/review/evidence-index`, worker job `dossier`, `/m/explainer?d=<topic>` | unit: dossier and pipeline-quality; `test/story-page-unit.js` checks canonical scores, source IDs and admission; review demo: "Dossier" |
| REQ-032 | Research site that feeds the feed: public write-ups and an RSS feed another site adds as a source | `modules/research/`, `SITE_PROFILE=research`, `/research`, `/research/feed.xml`, `RESEARCH_PUBLIC` | test: research feed (24 checks, in preflight) |
| REQ-033 | Source grades, forecasts as events with track records, buzz versus evidence, published criteria | `modules/review/sources.js`, `CRITERIA` in `modules/review/review.js`, `review_events`, `/api/review/outlets`, `/api/review/events`, `/research/criteria`, `/research/outlets` | unit: sources (31 checks), pipeline-quality (valid buzz windows/hype), review (criteria checks); bench item `b-hype-press-words` |
| REQ-034 | Two-model judge panel with identity, prestige and wording masks | `modules/review/panel.js`, `scripts/watch.js`, `PANEL_MODELS`, `CRITERIA.panel` | unit: panel (22 checks, stand-in models, including the advisor); `scripts/advise.js` |
| REQ-030 | Project tracker mirrors spec and agents | `scripts/project-sync.js`, `modules/project`, Specs view `/m/project#/specs`, `modules/project/specs.js`, `scripts/spec-index.js` | unit: project-sync, sync-source, project-specs and spec-status; `scripts/checkin.js` (`npm run checkin`), run daily by the scheduled agent task; research control room `/m/control` (research feed test: control room checks; e2e: "Research control room (REQ-030, REQ-018)" tests disclosure, navigation, saved actions, access, light/dark and phone width) |

<!-- trace-spec: 003 -->

| REQ-032–038 | Judge fidelity and stability (proposed, `specs/003-judge-fidelity`) | REQ-037 bands built (`modules/review/bands.js`; review result `bands`/`verdictNote`, dossier counts High only, digest Band column; T041, T042); canonical text, negation, type detection and abstract-first fidelity are built in `review.js`, `fidelity.js` and `scripts/watch.js`; measured by `bench/judge-edge-cases.json`, `bench/fidelity-cases.json`, `scripts/judge-report.js`, Lean model in `proofs/` (unchecked) | preflight: judge edge cases (known gaps reported; `ok` cases must pass), judge properties (`test/judge-properties.js`), fidelity set, near-cutoff report, bands (`test/bands-unit.js`) and Lean vectors units |
| REQ-039–040 | Peer reviews and reader comments (proposed, `specs/003-judge-fidelity`) | not built yet | none yet (tasks T060, T061) |

<!-- trace-spec: 004 -->

## Feature parity (proposed, `specs/004-parity/spec.md`; extended version; needs both partners)

From the public-features survey in `docs/PARITY.md` (data `docs/market/apps.json`). Proposed, not built: none of these exists in the code yet; "today" is what the survey's code check found.

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-041 | Opt-in "For you" order with reason words | proposed, not built (today: sorts top/new/votes/signal in `storyRows`, `server.js`) | none yet (tasks T050, T051) |
| REQ-042 | Full-text search on SQLite and Postgres | proposed, not built (today: substring `q` on `GET /api/stories`) | none yet (tasks T010, T011) |
| REQ-043 | Coverage panel per story group, single-source list | proposed, not built (today: "covered by" table in `public/story.html`) | none yet (tasks T020, T021) |
| REQ-044 | Source-type labels | proposed, not built (today: source `kind` sets the evidence level in `lib/analysis.js`) | none yet (tasks T002, T022, T023) |
| REQ-045 | Atom feeds out, "since last visit" | proposed, not built (today: `GET /api/learn/feed.xml` for Learn posts only) | none yet (tasks T001, T030, T031) |
| REQ-046 | Mute words, tags and sources | proposed, not built | none yet (tasks T012, T013) |
| REQ-047 | Code, model and dataset links on papers | proposed, not built | none yet (task T040) |
| REQ-048 | Citation neighbourhood from a free API, cached | proposed, not built | none yet (tasks T080, T041) |
| REQ-049 | Reader data export, public OPML | proposed, not built (today: admin-only `GET /api/admin/opml`) | none yet (task T032) |
| REQ-050 | Installable app, offline saved list | proposed, not built | none yet (task T033) |
| REQ-051 | Public change log of rules and moderation | proposed, not built (today: admin-only `GET /api/admin/audit`) | none yet (task T070) |
| REQ-052 | Vote cap, new-account weight, separate agree mark | proposed, not built | none yet (tasks T060, T061, T062) |

<!-- trace-spec: 005 -->

## Appearance, CMS delivery and content generation (proposed, `specs/005-appearance-and-publishing/spec.md`; extended version; needs both partners)

Built on `feature/themes-layouts-cms-2026-11-11` at John's request; not in scope until both partners approve (task T500).

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-053 | Design concepts, themes, feed layouts; admin default, reader switch | `modules/appearance/` (catalog, settings, routes, `/m/appearance`), `resolveLook`/`appearanceMenu` in `public/js/api.js`, `[data-theme\|layout\|type\|size]` in `public/css/app.css`, theme contrast in `scripts/unslop.js` | unit: publishing (REQ-053 checks); e2e: "REQ-053" in "Appearance and publishing" |
| REQ-054 | RSS, JSON Feed, per-post JSON and embed card for published posts | `modules/editorial/routes.js` (`/api/editorial/feed.xml`, `/api/editorial/feed.json`), `rss`/`jsonFeed` in `modules/editorial/content.js`, `?embed=1` in `modules/editorial/pages/journal.html` | unit: publishing (REQ-054 checks); e2e: "REQ-054" |
| REQ-055 | Rule-written drafts and channel versions, no posting, no Twitter/X | `weeklyDigest`, `topicRoundup`, `storyExplainer`, `channels` in `modules/editorial/content.js`; `/api/admin/editorial/generate`, `/api/admin/editorial/posts/:id/channels`; Editorial CMS page | unit: publishing (REQ-055 checks); e2e: "REQ-055" |

<!-- trace-spec: 006 -->
## Paper responses (proposed, `specs/006-paper-responses/spec.md`; extended version; needs both partners)

Built on `feature/paper-responses-2026-11-11` at John's request; not in scope until both partners approve (task T600).

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-056 | Read a paper's full text (HTML, PDF, text), polite cached fetch | `modules/responses/reader.js` (`read`, `fromHtml`, `fromPdf`, `fromText`) | unit: responses ("REQ-056: reading the full text") |
| REQ-057 | Claims matched to their evidence, abstract numbers in the body, full-text rigor checklist, open questions | `modules/responses/analysis.js` (`analyse`, `CHECKS`) | unit: responses ("REQ-057: analysis") |
| REQ-058 | Plan, narrated Manim explainer with captions, article and posts; a person publishes | `modules/responses/plan.js`, `video.js`, `write.js`, `respond.js`; `scripts/respond.js`; Learn job `response`; `/m/explainer?r=` | unit: responses ("REQ-058: plan, video, article and posts") |
| REQ-060 | A* beats, Q-learned offering, render QA, learnings with guards, calibration | `modules/lab/production.js` (runners `response-astar`, `response-qlearn`), `modules/responses/qa.js`, `learnings.json`, `video.js` line alignment, `scripts/respond.js --render --learn` | unit: responses ("REQ-060: production planning, QA and what it learned"); bench: production suite |
| REQ-059 | Feature flag (off, staff, public) in the CMS meta layer, audited | `modules/responses/flags.js`, `routes.js` (`/api/admin/features`, gated `/api/responses*`), `pages/responses.html` | unit: responses ("REQ-059: feature flag in the CMS meta layer") |

<!-- trace-spec: 007 -->
## Data layer and builders (proposed, `specs/007-data-and-builders/spec.md`, planned in `openspec/changes/add-data-layer-and-builders`; extended version; needs both partners)

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-061 | Named sources and actions: permissions, input schemas, audit | `modules/data/` (`registry.js`, `routes.js`, points `data.sources`, `data.actions`) | unit: data ("REQ-061: input schemas"; routes section) |
| REQ-062 | Versioned artifacts with file references; restore as a new version | `modules/data/artifacts.js`, `responses/store.js` | unit: data ("REQ-062: versioned artifacts") |
| REQ-063 | Knowledge graph: oxilite or Oxigraph, read-only SPARQL, limit | `modules/data/kg.js`, `responses/store.js` (`triples`) | unit: data ("REQ-063: knowledge graph") |
| REQ-064 | Response builder and Studio bindings and actions | `modules/responses/data.js`, `pages/builder.html`, `modules/data/bindings.js`, `/api/ui/resolve`, `runAction` and `refresh` in `views/actions.mjs`, `jrLive` in `public/js/api.js` | unit: data ("REQ-061, REQ-064: routes, builder actions and Studio bindings") |

<!-- trace-spec: 008 -->
## The system as a graph, and the learning flywheel (proposed, `specs/008-graph-model-and-flywheel/spec.md`, planned in `openspec/changes/add-graph-model-and-flywheel`; extended version; needs both partners)

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-065 | App graph as typed nodes and edges, SHACL shapes | `modules/graph/appgraph.js`, `shacl.js`, `shapes.ttl`; sources `graph.summary`, `graph.validate`; action `graph.export` | unit: graph ("REQ-065: the system as a typed graph, checked by shapes") |
| REQ-066 | DAG check, quantified path patterns, A* | `modules/graph/algorithms.js`; sources `graph.paths`, `graph.route` | unit: graph ("REQ-066: DAG, quantified path patterns, A*") |
| REQ-067 | Learnings to rules, recall by mutation, evolution with an overtraining stop | `modules/graph/flywheel.js`, `scripts/graph.js` (`report`, `evolve`), `modules/responses/learnings.json` | unit: graph ("REQ-067: the learning flywheel"); bench: graph suite |

## Acceptance suite

`test/spec-acceptance.js` runs every user-story scenario, edge case and success criterion that can be automated, against the **spec version**, with labelled synthetic sources (`test/fixtures/spec`: 9 sources across 7 kinds). Each check names its REQ. The run fails if a testable requirement (REQ-001 to REQ-018, REQ-020) has no passing check (SC-008). Preflight runs the API checks; `npm run test:spec` adds the browser checks at laptop and phone widths. REQ-019 (live two weeks before the presentation) is checked by people.

## Beyond the spec

The site has two versions (`modules/profiles.json`, `SITE_PROFILE`):

- **`spec` (the default)** is exactly the shared spec. Preflight's smoke test runs it and checks that the extras answer 404.
- **`extended`** adds work that serves no REQ (constitution principle III):
  - notes, reading lists, the weekly brief and suggested sources (core, switched by feature);
  - the capability tracker, the project tracker and timeline, the codebase map, the Learn layer, the knowledge layer and the Lab (modules; requirements proposed in docs/PLAN_NEXT.md).
  - the verification module: a "Machine-checked" significance signal for formal-proof claims (claimed, statement checked against a reference, checked outside the authors; fidelity gaps flagged), a Formal verification topic under Math, the Axiom Math organisation and the Learn concept "Statement fidelity", a labelled benchmark with a research loop that tunes the signal's rules (train split) behind a held-out gate, and four Lab examples (autoformalization, recursive self-improvement drift above and below the comparator threshold, review order in a formal library) with the analysis in docs/RESEARCH_FORMAL_VERIFICATION.md (also in the research version).

  The browser test (`npm test`) runs the extended version so every feature stays tested.

The admin, generative-UI and decision modules run in both versions: admin runs the site's sources, and decision supports the bake-off comparison. The extended build as it stood before Matt's REQ-020 change is saved as branch `feature/snapshot-john-extended-2026-11-07`, measured in `docs/snapshots/`. The naming convention (`docs/NAMING.md`), the unslop check, the portable rule language (`lib/expr`; REQ-003's rule is `lib/rules/scope.json`) the schema registry (`schema/`) and the hub (`docs/HUB.md`, generated by `scripts/hub.js`; it also lists the open tasks and requirements awaiting approval, as proposed REQ-030 asks of the tracker) are tooling.

## Original content and navigation evidence

The existing extended REQ-031/032 authoring and publication paths now include `modules/editorial`: admin drafts, independent published snapshots, retained revisions and a public journal. `test/editorial-unit.js` verifies both databases, concurrency, audit rollback and exclusion from the spec profile; `test/cms-e2e.js` verifies the human publishing journey. Imported-story provenance and reversible moderation serve REQ-002/004/005/007/018 through `modules/admin/pages/content.html` and `test/content-desk-unit.js`. Graph-to-review navigation extends existing REQ-023/027 checks without changing shared specifications or the pending approval gates.

## Term, symbol and function pointers

Existing extended REQ-023/027 now share `modules/learn/data/glossary.json` across definition pages, mention tagging and curated graph pointers. `public/js/term-model.js` holds literal matching and stable bounded teaching functions; `test/terms-property-unit.js` checks generated vectors, symbol identity and span invariants. `test/terms-e2e.js` checks guest navigation, source pointers, safe dynamic decoration, editor/code exclusion and phone layouts. `test/story-page-unit.js` verifies public registry access, term graph lookup and fail-closed Learn story admission on both databases. Shared REQ-005/007/018 remain served without changing scoring rules or hosting full source texts.

## Research foundations and alignment caveats

REQ-001/003/005 and extended REQ-023 research pointers: `docs/research/spec-alignment-and-frontiers.json`, the four new Learn/glossary entries, two unverified candidate catalog searches, and `test/research-foundations-unit.js`. The original shared spec hash is recorded; no requirement was edited or approved. `scripts/spec-status.js` preserves the unresolved relevance-policy caveat across regeneration, tested by `test/spec-status-unit.js`. A local acceptance pass is not evidence that live delivery or human relevance checks are complete.

Reliable research navigation (REQ-018, extended REQ-023/025/027): `test/navigation-e2e.js` exercises graph URL history/reload, stale Learn responses, broken-pointer recovery, distinct Feed/Saved selection and public RSS publication boundaries. `test/terms-e2e.js` preserves Σ/σ identity.

Product planning (002/REQ-030): `docs/research/product-backlog.json` retains IDEA-001–200; `docs/PRODUCT_ROADMAP.md` orders dependency phases. `modules/project/product-backlog.js` validates and projects proposals through `scripts/project-sync.js`; `test/project-sync-unit.js` verifies identity, idempotency, human-edit preservation and malformed-input rejection. The tracker machinery does not approve individual feature scope. Bounded dossier workflow (002/REQ-031, shared REQ-018): session-local question framing, traced brief and reference navigation in `modules/review/pages/dossier.html`; `test/dossier-workflow-e2e.js` checks workflow and recovery. Full IDEA-101/121/151 capabilities remain proposed.

Simplicity pass (REQ-018, existing extended002/REQ-030/031): shorter roadmap/dossier copy, one primary brief action, and optional secondary section links preserve the existing routes, source pointers and session-only question behavior.

Backend vocabulary alignment (REQ-005/007; extended002/REQ-027/031): `lib/ids.js` owns lexical grammar; schema1.2.0 retains wire enum numbers while recognizing existing doc/event/outlet/lab identities. `lib/vocabulary.js` and `scripts/dictionary.js` validate controlled references and generate `docs/DATA_DICTIONARY.md`; `test/vocabulary-unit.js`, `test/identity-contract-unit.js`, and `test/tagger-contract-unit.js` cover dictionary drift and adapter output admission. No public UI or route is added; publication approval remains required.

Tracker cleanup (002/REQ-030): delivery task labels are derived from declared requirement pointers rather than a fixed REQ-031. Full spec-qualified references remain authoritative in source context. `test/product-backlog-contract-unit.js` covers source-label migration and missing review/acceptance metadata; project sync preserves human notes and progress.

Local verification reliability (REQ-018; existing extended002/REQ-030/031): `test/helpers/api-settlement.js` observes real API completion in isolated browser contexts for stale-response probes. Explicit fixture-week and empty-week checks in `test/e2e.js` remove wall-clock assumptions without altering fixture records or application behavior. Independent negative-control evidence is recorded in `docs/LOGIC_AUDIT.md`.

Entity/publication resolution (REQ-004/005/007): `lib/publication-identity.js` and `lib/harvest.js` prioritize recognized publication IDs, preserve original links and reject conflicting strong-ID title merges; `idx_links_url` supports exact replay lookup. `lib/vocabulary.js.resolveEntity` preserves alias ambiguity and qualified candidates. Schema1.3.0 and `npm run resolve -- ...` provide backend-only standardized review outputs. `test/entity-resolution-unit.js` covers identifier/URL/alias contracts; `test/entity-grouping-unit.js` checks real SQL persistence, source-coverage explanations, legacy replay and concurrent admission. No shared-spec or scoring-weight changes; publication remains gated.

Resolver readability (REQ-004/007): URL admission, DOI recognition, tracking-key filtering and resolution outputs in `lib/publication-identity.js` use explicit control flow; existing `test/entity-resolution-unit.js` and `test/entity-grouping-unit.js` preserve recognition and persistence behavior. No matching policy, interface or publication change.

Private research intake (REQ-001/003/004/005/007; extended002/REQ-024/026/027/030/034): `handoff/routines/research-intake.md` defines bounded approved-source collection, traced private insights, local-only optional inference and review-only training candidates. `scripts/watch.js` reuses canonical arXiv recognition; `test/watch-unit.js` checks version grouping and rejection of false authoritative IDs. Lab guidance requires disjoint reviewed splits. No training service, source activation, scoring change or publishing is authorized.

Intake verification (REQ-018): fixed-date feed/grouping and source-kind count checks in `test/e2e.js` explicitly select all-time fixtures rather than depending on the current rolling week; default application filtering remains unchanged.

Formal/runtime verification (existing003/REQ-038;002/REQ-024/026;sharedREQ-004/005/007/018): `test/judge-differential.js` builds pinned Lean4.15.0, audits58 judge and3 Learn toy theorems, and executes actual Lean against current JS-derived vectors. `test/lean-worker-e2e.js` checks authorized HTTP queue creation, real worker execution, persisted status/artifacts, incomplete-statement handling and no automatic publication. `docs/VERIFICATION.md` separates formal claims from bounded runtime evidence. T050/T051 remain open; completed T052 records this arithmetic-only slice. Fixed story-detail fixtures explicitly select all-time results in `test/e2e.js`.

Deeper proof admission (existing003/REQ-038 and002/REQ-024): `lib/lean-proof.js` is the shared controlled-source admission facade for model audits and worker completion. `test/lean-proof-unit.js` exercises real Lean acceptance/rejection, proposition elaboration and assumption policies. `test/lean-worker-e2e.js` checks receipt source/tool/axiom pointers through the persisted job path. New T053 records the bounded worker gate; no shared spec, arithmetic rule or publishing policy changes.

Proof job completion (002/REQ-024 and 003/REQ-038) requires the audited worker. The admin API and CLI reject manual success. The queue test covers result overwrite, manual completion and requeue of audited proof records.

Historical proof recheck (002/REQ-024 and 003/REQ-038) compares referenced source with the curated statement, runs the audited worker and updates the job against its previous snapshot. Queue tests cover new receipts and mismatched-source review on both database engines.
