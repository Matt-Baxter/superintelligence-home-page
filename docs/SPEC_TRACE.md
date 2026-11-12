# Spec traceability: John's build

How this build meets the shared spec ([specs/001-superintelligence-homepage/spec.md](https://github.com/Matt-Baxter/superintelligence-home-page/blob/claude/youthful-fermat-iyku15/specs/001-superintelligence-homepage/spec.md), on Matt's branch until it merges). Test names are the check names printed by `npm test` and `npm run preflight`.

| REQ | What | Where in the code | Checked by |
| --- | --- | --- | --- |
| REQ-001 | 8+ superintelligence sources, 5+ kinds, fetched on a schedule | `lib/sources.json` (11 sources, 5 kinds), `lib/harvest.js`, `vercel.json` crons | unit: "REQ-001: 8+ sources across 5+ kinds" |
| REQ-002 | Feed newest first; title, sources, topics, link | `server.js` default sort `new`; `storyCard` in `public/js/api.js` | e2e: "REQ-002: the feed is newest first by default" |
| REQ-003 | Only superintelligence stories | `scope` in `lib/ontology.json`, `scope()` in `lib/analysis.js`, `stories.in_scope`, `storyRows` filter | e2e: "REQ-003 / SC-003" (both); unit: scope checks |
| REQ-004 | Duplicates grouped into one story | `storyKeys` in `lib/feeds.js`, `addItem` in `lib/harvest.js` | e2e: grouping checks in "Feed" |
| REQ-005 | Topics with the words that matched | `lib/tagger.js`; scope reason on the story page | e2e: "US1-5 / REQ-005", "REQ-005: the story page says why" |
| REQ-006 | No Twitter/X, as source or link | `addItem` drops x.com/twitter.com links; admin and suggest refuse them; preflight and guard hook | e2e: "REQ-006: an item linking to Twitter/X is dropped", "Twitter/X is refused" |
| REQ-007 | Link out, no full text | Stories store title, summary (capped at 1,500 chars) and URL only | e2e: story links |
| REQ-008 | A failing source doesn't stop the feed | `harvestSource` never throws; backoff | e2e: "catalog: … failures reported", "a failing source backs off" |
| REQ-009–012 | Accounts, stay signed in, hashed passwords, no extra personal data | `server.js` auth (scrypt, session cookie, 30-day sessions) | e2e: "Accounts" section |
| REQ-013–016 | One vote per user per story, saves, kept per user, enforced by the server | `server.js` votes and saves routes | e2e: "Votes and saves" section, "saves are per user" |
| REQ-017 | Filter by topic | topic bar = the nine spec topics | e2e: "topic filter", "US4" |
| REQ-018 | Laptop and phone, no sideways scroll | `public/css/app.css` | e2e: "Phone width" section |
| REQ-019 | Live 2+ weeks before the presentation | `docs/DEPLOY.md` (humans deploy) | not automated |
| REQ-020 | Human-written agent log in the repo | `AGENT_LOG.md` (the partners write it; agents never do). The app has no agent log page: `/agent-log` redirects to the file; old in-app entries can be exported once from `/api/admin/agent-log.md` | e2e: "Agent log" section; preflight smoke "no in-app agent log" |


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
| REQ-030 | Project tracker mirrors spec and agents | `scripts/project-sync.js`, `modules/project` | unit: project-sync; `scripts/checkin.js` (`npm run checkin`), run daily by the scheduled agent task; research control room `/m/control` (research feed test: control room checks); the app's own action catalog `GET /api/admin/meta` (`lib/meta.js`, `meta.actions`) with runnable forms in the control room (unit: meta, 12 checks) |

## Acceptance suite

`test/spec-acceptance.js` runs every user-story scenario, edge case and success criterion that can be automated, against the **spec version**, with labelled synthetic sources (`test/fixtures/spec`: 9 sources across 7 kinds). Each check names its REQ. The run fails if a testable requirement (REQ-001 to REQ-018, REQ-020) has no passing check (SC-008). Preflight runs the API checks; `npm run test:spec` adds the browser checks at laptop and phone widths. REQ-019 (live two weeks before the presentation) is checked by people.

## Beyond the spec

The site has two versions (`modules/profiles.json`, `SITE_PROFILE`):

- **`spec` (the default)** is exactly the shared spec. Preflight's smoke test runs it and checks that the extras answer 404.
- **`extended`** adds work that serves no REQ (constitution principle III):
  - notes, reading lists, the weekly brief and suggested sources (core, switched by feature);
  - the capability tracker, the project tracker and timeline, the codebase map, the Learn layer, the knowledge layer and the Lab (modules; requirements proposed in docs/PLAN_NEXT.md).

  The browser test (`npm test`) runs the extended version so every feature stays tested.

The admin, generative-UI and decision modules run in both versions: admin runs the site's sources, and decision supports the bake-off comparison. The extended build as it stood before Matt's REQ-020 change is saved as branch `feature/snapshot-john-extended-2026-11-07`, measured in `docs/snapshots/`. The naming convention (`docs/NAMING.md`), the unslop check, the portable rule language (`lib/expr`; REQ-003's rule is `lib/rules/scope.json`) and the schema registry (`schema/`) are tooling.
