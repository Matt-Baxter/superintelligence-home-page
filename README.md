# Superintelligence Homepage

SEIS 606 Vibe Coding · Project 2 · John Affolter and Matthew Baxter

One place to follow progress toward advanced AI, drawn from papers, lab blogs, research organizations, forums, newsletters and academic blogs, with no dependence on any single platform. There's no Twitter/X: as a source, as a suggestion, or as a submitted link.

The plan we build against (working agreement, spec, versioned contract) is in our shared Project 2 Plan doc. Repo copies:

- [Working Agreement](WORKING_AGREEMENT.md): how we'll work together
- [Contract](CONTRACT.md): what we're building against
- Initial spec: to be created with SpecKit

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

## Run

```bash
npm install
npm run build        # bundle the json-render renderer
npm start            # http://localhost:3000, fetches the real feeds
npm run dev:sample   # http://localhost:3200, a throwaway database with SYNTHETIC sample feeds (no network needed)
npm test             # two-user browser test; run dev:sample first (needs Playwright)
```

Environment variables:

- `PORT`
- `DATA_DIR`: where the SQLite file lives; use a persistent volume in production.
- `FETCH_MINUTES`: default 30; `0` turns fetching off.
- `APP_TZ`: default `America/Chicago`.
- `NODE_ENV=production`: makes the session cookie `Secure`.

## Deploy (Railway or any Node 22 container host)

1. Deploy from the repo; the Dockerfile is detected.
2. Mount a volume at `/data` (the Dockerfile sets `DATA_DIR=/data`). Without it, accounts reset on every deploy.
3. Generate a public domain. Sign up first so you're the admin, then share the URL with the class.

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
