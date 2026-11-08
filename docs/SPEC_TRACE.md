<!-- trace-spec: 001 -->
# Spec traceability: John's build

How this build meets the shared spec ([specs/001-superintelligence-homepage/spec.md](https://github.com/Matt-Baxter/superintelligence-home-page/blob/claude/youthful-fermat-iyku15/specs/001-superintelligence-homepage/spec.md), on Matt's branch until it merges). Test names are the check names printed by `npm test` and `npm run preflight`.

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-001 | 8+ superintelligence sources, 5+ kinds, fetched on a schedule | `lib/sources.json` (11 sources, 5 kinds), `lib/harvest.js`, `vercel.json` crons | unit: "REQ-001: 8+ sources across 5+ kinds" |
| REQ-002 | Feed newest first; title, sources, topics, link | `server.js` default sort `new`; `storyCard` in `public/js/api.js` | e2e: public guest feed and story-detail checks in "Public orientation and account access"; "REQ-002: the feed is newest first by default"; "Reader robustness" covers stale responses, retry and pagination; "Reading quality" covers inline evidence, true factor values and story navigation; "Research wave 1" and `test/ui-date-unit.js` cover exact-date disclosure and sort explanations |
| REQ-003 | Only superintelligence stories | `scope` in `lib/ontology.json`, `scope()` in `lib/analysis.js`, `stories.in_scope`, `storyRows` filter | e2e: "REQ-003 / SC-003" (both); unit: scope checks; HTTP regression `test/scope-admission.js` (unclassified/off-topic rows excluded) |
| REQ-004 | Duplicates grouped into one story | `storyKeys` in `lib/feeds.js`, `addItem` in `lib/harvest.js` | e2e: grouping checks in "Feed" |
| REQ-005 | Topics with the words that matched | `lib/tagger.js`; scope reason on the story page | e2e: "US1-5 / REQ-005", "REQ-005: the story page says why" |
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
| REQ-023 | Concepts in plain words, graph | `modules/learn/data/concepts.json`, `/m/learn`, `/m/map` | e2e: "Learn" section; review demo: "Map" |
| REQ-024 | Background studio jobs | `learn_jobs`, `scripts/learn-worker.js`; the watcher queues `paper-to-code` | e2e: "Learn" section; unit: watch "queued for paper-to-code" |
| REQ-025 | Explainer video and drafts, people publish | `modules/learn` explainer, RSS of published posts | e2e: "Learn" section |
| REQ-026 | Worked examples, refuted kept, sources, sandbox | `modules/lab` (`examples.json`, `runners.js`, `interp.js`, `papers.js`), `/m/lab`, `/m/arena` | unit: lab, papers; arena demo; e2e: "refuted hypotheses are kept" |
| REQ-027 | Review desk with anti-gaming guards | `modules/review` (`review.js`, `store.js`), `/m/review` | unit: review (24 checks); review demo; bench `review.*` |
| REQ-028 | Daily paper watch | `scripts/watch.js`, `modules/review/watch.json`, `.github/workflows/paper-watch.yml` | unit: watch (5 checks) |
| REQ-029 | Benchmarks with a ratchet | `scripts/bench.js`, `bench/` | preflight "Benchmarks"; real-data quality report `scripts/quality.js` (unit: quality, 3 checks) |
| REQ-031 | Topic dossier: traced analysis, blog, posts, video | `modules/review/dossier.js`, `/m/dossier`, `/api/review/dossier/:topic`, worker job `dossier`, `/m/explainer?d=<topic>` | unit: dossier (16 checks); review demo: "Dossier" |
| REQ-032 | Research site that feeds the feed: public write-ups and an RSS feed another site adds as a source | `modules/research/`, `SITE_PROFILE=research`, `/research`, `/research/feed.xml`, `RESEARCH_PUBLIC` | test: research feed (24 checks, in preflight) |
| REQ-033 | Source grades, forecasts as events with track records, buzz versus evidence, published criteria | `modules/review/sources.js`, `CRITERIA` in `modules/review/review.js`, `review_events`, `/api/review/outlets`, `/api/review/events`, `/research/criteria`, `/research/outlets` | unit: sources (31 checks), review (criteria checks); bench item `b-hype-press-words` |
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

## Acceptance suite

`test/spec-acceptance.js` runs every user-story scenario, edge case and success criterion that can be automated, against the **spec version**, with labelled synthetic sources (`test/fixtures/spec`: 9 sources across 7 kinds). Each check names its REQ. The run fails if a testable requirement (REQ-001 to REQ-018, REQ-020) has no passing check (SC-008). Preflight runs the API checks; `npm run test:spec` adds the browser checks at laptop and phone widths. REQ-019 (live two weeks before the presentation) is checked by people.

## Beyond the spec

The site has two versions (`modules/profiles.json`, `SITE_PROFILE`):

- **`spec` (the default)** is exactly the shared spec. Preflight's smoke test runs it and checks that the extras answer 404.
- **`extended`** adds work that serves no REQ (constitution principle III):
  - notes, reading lists, the weekly brief and suggested sources (core, switched by feature);
  - the capability tracker, the project tracker and timeline, the codebase map, the Learn layer, the knowledge layer and the Lab (modules; requirements proposed in docs/PLAN_NEXT.md).

  The browser test (`npm test`) runs the extended version so every feature stays tested.

The admin, generative-UI and decision modules run in both versions: admin runs the site's sources, and decision supports the bake-off comparison. The extended build as it stood before Matt's REQ-020 change is saved as branch `feature/snapshot-john-extended-2026-11-07`, measured in `docs/snapshots/`. The naming convention (`docs/NAMING.md`), the unslop check, the portable rule language (`lib/expr`; REQ-003's rule is `lib/rules/scope.json`) the schema registry (`schema/`) and the hub (`docs/HUB.md`, generated by `scripts/hub.js`; it also lists the open tasks and requirements awaiting approval, as proposed REQ-030 asks of the tracker) are tooling.
