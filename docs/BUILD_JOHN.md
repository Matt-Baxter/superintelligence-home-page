# John's build (Build B)

John's entry in the bake-off ([CONTRACT.md](../CONTRACT.md)): the Superintelligence Homepage built to the shared spec,
[`specs/001-superintelligence-homepage/spec.md`](../specs/001-superintelligence-homepage/spec.md), REQ-001 to REQ-020,
and nothing else. It is exported from John's working branch with `node scripts/export-build.js builds/john`; John's
extra work (research layer, Lab, Learn, agent-ui and the rest) stays on his branch and is not part of the bake-off build.

## See it running (local, with sample data)

```bash
cd builds/john
npm install
npm run dev:sample        # http://localhost:3200
```

`dev:sample` starts the site on a throwaway SQLite database filled with the synthetic, labelled test feeds in
`test/fixtures` (every item says "Sample" or "test data"; some are general AI news the site must leave out). Create two
accounts to try votes and saves. Nothing here reaches a live site.

With real feeds instead: `npm run build && npm start` (http://localhost:3000; SQLite in `data/`, or Postgres when
`DATABASE_URL` is set). With Docker: `docker build -t si-john . && docker run -p 3000:3000 si-john`.

## Deploy (a person does this)

Agents never deploy (WORKING_AGREEMENT.md). On Vercel: import the repository, set **Root Directory** to `builds/john`,
add a Neon Postgres database (its `DATABASE_URL`) and a `CRON_SECRET`, and deploy. `vercel.json` here schedules the
daily fetches and routes `/api/*` to the Express app. `.env.example` lists every setting.

## Check it

```bash
npm run test:api          # the spec acceptance suite against the spec version (API)
npm test                  # the same, plus the browser scenarios at laptop and phone width (needs Playwright's Chromium)
```

Every check names the requirement it proves; the run fails if a testable requirement has no passing check (SC-008).
REQ-019 (live at a public URL two weeks before the presentation) and SC-001 / SC-004 are checked by people.

## What is in the folder

| Path | What it does |
| --- | --- |
| `server.js`, `api/index.js` | The Express app (locally) and its Vercel entry |
| `lib/` | Feeds, grouping, ontology tagging with matched words, scope, significance, database (SQLite or Postgres) |
| `kernel/`, `modules/admin/` | The module loader and the admin tools running the site needs (sources, fetch status) |
| `public/` | The reader pages: feed, story, sources, welcome |
| `test/` | The spec acceptance suite, the sample server and the synthetic fixtures |
