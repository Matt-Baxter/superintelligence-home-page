# Superintelligence Homepage: notes for AI agents

SEIS 606 Project 2 (John Affolter and Matthew Baxter). A multi-source homepage for AI-progress news: stories grouped across sources, tagged against an ontology, with accounts, votes, saves, notes, reading lists, a weekly brief and an agent log.

Read before changing anything: [CONTRACT.md](CONTRACT.md) (what both halves build against), [WORKING_AGREEMENT.md](WORKING_AGREEMENT.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Hard rules

- **Never push to `main`** and never merge. Work on a `feature/`, `fix/` or `bakeoff/` branch; the human opens the pull request and merges it themselves once preflight is green (no review required).
- **Never deploy** or change Vercel, Neon or GitHub settings. Humans do that ([docs/DEPLOY.md](docs/DEPLOY.md)).
- **Never write agent log entries.** The Agent log page holds entries the humans write in their own words about what the agent got wrong. Don't draft, suggest wording for, or fill in an entry, even if asked to "help with the log". You may remind the human to write one.
- **No secrets** in code, commits or messages. Configuration comes from environment variables (`.env.example` lists them).
- **No Twitter/X** as a source, suggestion or submitted link. It's refused on purpose (Paul's feedback).
- **Contract changes need both humans.** If a change alters a table, an API route, or a request or response shape, stop and say so. It needs a change-log row in `CONTRACT.md` and both partners' approval.
- **Test data is synthetic** and labelled "Sample" / "test data". Don't invent real-looking papers, people or quotes.

## Layout

| Path | What |
| --- | --- |
| `server.js` | Express app: auth, stories, lists, sources, agent log, brief, cron route. Exported for Vercel. |
| `api/index.js` | Vercel function entry (re-exports the app). |
| `lib/db.js` | One async query API: Postgres when `DATABASE_URL`/`POSTGRES_URL` is set, otherwise SQLite. Write portable SQL with `?` placeholders. |
| `lib/feeds.js` | RSS/Atom/arXiv/HF parsing and story keys (grouping rules). |
| `lib/tagger.js`, `lib/ontology.json` | Ontology tagging; every tag stores the words that matched. |
| `lib/sources.json` | Default sources. |
| `views/catalog.mjs`, `views/specs.mjs` | json-render catalog and server-built specs (weekly brief, agent log summary). |
| `client/jr.jsx` → `public/js/jr.js` | Browser renderer for the catalog (`npm run build`). |
| `public/` | Pages: feed, story, lists, brief, sources, agent log. |
| `test/` | Synthetic fixtures, sample-data servers, two-user Playwright test. |

## Portable SQL (SQLite and Postgres)

- Use `?` placeholders. `db.insert()` returns the new id; `db.run()`, `db.get()`, `db.all()`, `db.tx(async t => …)`.
- `INSERT OR IGNORE` is translated for Postgres. For upserts, always name the conflict target: `ON CONFLICT (a, b) DO UPDATE …`.
- Pass timestamps from JS (`db.now()`, ISO UTC). Don't use `CURRENT_TIMESTAMP` in queries.
- Booleans from `EXISTS(...)` come back as 0/1 on SQLite and true/false on Postgres. Wrap them with `bool()`.
- No SQLite-only scalars (`MAX(a, b)`) or Postgres-only syntax. Use `CASE WHEN`.

## Checking your work

```bash
npm run preflight                        # ~3 s: syntax, build, secrets, no-Twitter, contract reminder, API smoke test
npm run build && npm run dev:sample      # http://localhost:3200 on synthetic data
npm test                                 # full two-user browser test; must stay at 0 failed
```

Run against Postgres too when you touch SQL (see [docs/DEPLOY.md](docs/DEPLOY.md), "Local Postgres"). Report the exact pass/fail line. Never claim something works that you didn't run.
