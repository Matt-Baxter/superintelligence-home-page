# Superintelligence Homepage

SEIS 606 Vibe Coding · Project 2 · John Affolter and Matthew Baxter

One place to follow progress toward advanced AI, drawn from papers, lab blogs, research organizations, forums, newsletters and academic blogs, with no dependence on any single platform. There's no Twitter/X: as a source, as a suggestion, or as a submitted link.

The plan we build against lives in `docs/` (working agreement, spec, versioned contract), mirrored from our shared Project 2 Plan doc.

- [Working Agreement](WORKING_AGREEMENT.md): how we'll work together
- [Contract](CONTRACT.md): what we're building against
- [Changelog](CHANGELOG.md): project-wide changes and the commits that made them
- [Agent Log](AGENT_LOG.md): what the agent got wrong and how we caught it (human-written)
- [Initial spec](specs/001-superintelligence-homepage/spec.md): written with Spec Kit, under the [constitution](.specify/memory/constitution.md) (prompts used: [docs/speckit-prompts.md](docs/speckit-prompts.md))

## What it does

| Feature | Detail |
| --- | --- |
| **Multi-source feed** | 11 default sources across 7 kinds (`lib/sources.json`): arXiv, Hugging Face Daily Papers, OpenAI, Google DeepMind, Google Research, Alignment Forum, Epoch AI, Import AI, BAIR, Hacker News (AI-filtered). Fetched every 30 minutes. |
| **Story grouping** | The same paper or announcement from several sources becomes one story. An arXiv id beats a URL, and a URL beats a normalized title (`lib/feeds.js`). |
| **Ontology tags that explain themselves** | 17 topics in a tree, plus 11 organizations (`lib/ontology.json`). Every tag stores the words that matched; child topics roll up to their parents. |
| **Accounts and curation** | Votes, saves, private or shared notes, public or private reading lists that others can follow, and submitted links. |
| **Weekly brief** | Top stories and per-topic activity, compared with last week. Built as a json-render spec on the server. |
| **Sources page** | Every feed, its kind, and whether its last fetch worked. Users suggest feeds; the admin (the first account) approves them. |
| **Agent log** | Each partner writes their own entries: what the agent got wrong, how they caught it, what they did. The editor keeps a writing record (active minutes, autosaves, typed vs pasted characters) shown on every entry and in the Markdown export. That record is evidence of how an entry was written, not proof. |

## json-render

The weekly brief and the agent log summary are [json-render](https://github.com/vercel-labs/json-render) specs (v0.22.0). The server builds each spec from the data and validates it against the catalog (`views/catalog.mjs`) before sending it. `GET /api/catalog` exposes the catalog's AI prompt and JSON Schema, so a model could generate new views from only the approved parts later.

## Plan documents

> **To reconcile:** there are two sets of plan docs right now. Matt's templates sit at the repo root ([WORKING_AGREEMENT.md](WORKING_AGREEMENT.md), [CONTRACT.md](CONTRACT.md)) and choose a pure bake-off (Option B). The fuller drafts from the shared Plan doc are in `docs/` and describe a split-plus-bake-off mix. Pick one set and one option together, then delete the other.

- [docs/WORKING_AGREEMENT.md](docs/WORKING_AGREEMENT.md): how we work together, including roles, tools, repo workflow, agent rules and costs.
- [docs/SPEC.md](docs/SPEC.md): the initial spec and open questions.
- [docs/CONTRACT.md](docs/CONTRACT.md): the versioned contract (data models, API, auth, rules, milestones) with its change log.
- [docs/OUR_PARTS.md](docs/OUR_PARTS.md): who does what next, including the Week 9 homework checklist.

## Run locally

```bash
npm install
npm run build          # bundle the json-render renderer
npm start              # http://localhost:3000; SQLite in ./data, or Postgres if DATABASE_URL is set
npm run dev:sample     # http://localhost:3200, a throwaway SQLite database with SYNTHETIC sample feeds
npm test               # two-user browser test against dev:sample (needs Playwright)
```

The same queries run on SQLite (local, tests) and Postgres (production) through `lib/db.js`. To run the test against Postgres, start `DATABASE_URL=… npm run dev:sample:pg`, then run `BASE=http://localhost:3300 npm test`.

## Working on it

- [CONTRIBUTING.md](CONTRIBUTING.md): branches, the pull request checklist, review and merge rules.
- [docs/DEPLOY.md](docs/DEPLOY.md): Vercel + Neon setup, cron, troubleshooting and the fork fallback.
- [docs/V0.md](docs/V0.md): John's v0 workflow for his bake-off version.
- `npm run preflight`: about 3 seconds of checks (syntax, build, secrets, no-Twitter, contract reminder, API smoke test). It runs on `git push` and in GitHub Actions.
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): rules for AI agents working in this repo.
- `.claude/skills/`: Claude Code skills:
  - `open-pull-request`
  - `change-the-contract`
  - `run-tests`
  - `add-feed-source`
  - `bakeoff-entry`

## Tests

`test/e2e.js` drives two signed-in users through the whole app. It runs 49 checks, including:

- grouping and tagging
- votes, saves and notes kept separate per user
- refusing other users' edits on the server
- refusing Twitter/X
- drafts that only their author can see
- typed vs pasted counting
- Markdown export
- the json-render brief and its actions
- no sideways scrolling at phone width

Test data is synthetic: every sample record is labelled "Sample" and "test data". Live feeds weren't reachable from the build sandbox, so real-feed fetching still needs checking after the first deploy.
