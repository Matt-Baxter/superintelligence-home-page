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
| REQ-017 | Filter by topic | topic bar = the seven spec topics | e2e: "topic filter", "US4" |
| REQ-018 | Laptop and phone, no sideways scroll | `public/css/app.css` | e2e: "Phone width" section |
| REQ-019 | Live 2+ weeks before the presentation | `docs/DEPLOY.md` (humans deploy) | not automated |
| REQ-020 | Agent log (open question) | In the app: `/agent-log`, typed vs pasted tracking | e2e: "Agent log" section |

## Beyond the spec

Built before the spec was ratified and not traced to a REQ (constitution principle III): notes, reading lists, the weekly brief, suggested sources, the admin and project modules, the capability tracker and significance score, generative UI and judges, the codebase map and the project timeline (developer and process tooling), the unslop check (tooling), the Learn module (requirements proposed in docs/PLAN_NEXT.md), the agent kit. Under the constitution these stay out of the shared bake-off scope unless both partners add them to the spec. They're kept as modules, so each can be switched off in `modules/modules.json` without touching the core.
