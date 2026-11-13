# Quickstart: Build A (Matt)

Phase 1 output of `/speckit-plan`. How to run Build A and check that it works. Commands are run
from `builds/matt/`.

## Prerequisites

- Node.js 22 or newer
- Two Neon Postgres databases for Build A: one for development and tests, one for the live site
  (separate from John's; contract, Section 3)
- A Vercel project for Build A with **Root Directory** set to `builds/matt`

## Environment variables

Copy `.env.example` to `.env.local` (git-ignored) and fill in:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon connection string |
| `CRON_SECRET` | Random string; Vercel sends it to `/api/cron/fetch` |
| `SOURCES` | Optional. `fixtures` makes the app read the saved sample feeds instead of the real ones (tests only) |

On Vercel, set the same variables in the project's settings. Never commit them.

## Run locally

```bash
npm install
npm run db:migrate      # applies db/schema.sql and seeds the sources
npm run dev             # http://localhost:3000
```

## Run the acceptance tests

```bash
npx playwright install chromium
npm run test:acceptance
```

The tests start the app with `SOURCES=fixtures` and a small static server for
`tests/fixtures/`. To run them against the live site at a milestone:

```bash
BASE_URL=https://<build-a-url> npm run test:acceptance
```

## What "working" looks like

| Check | Expected | Contract test |
|-------|----------|---------------|
| Open `/` after a fetch | Superintelligence stories from at least 8 sources, newest first | AT-01 |
| Sample off-topic item (AI photo app) | Not in the feed | AT-02 |
| Sample paper in three sources | One story listing three sources | AT-03 |
| Story mentioning "AGI timelines" | Forecasting & timelines topic, matched words shown | AT-04 |
| Sample Twitter/X item | Not in the feed | AT-05 |
| One sample source never answers | Rest of the feed loads | AT-06 |
| Sign up, sign in, come back the next day | Still signed in; duplicate username refused | AT-07 to AT-09 |
| Vote and save as two users | Each sees only their own saves; votes persist | AT-10, AT-11 |
| Post a vote change with another user's ID | Ignored; only the sender's own vote can change | AT-12 |
| Filter by Alignment on a phone-width screen | Only Alignment stories, no sideways scrolling | AT-13 |
| Sample item with script and image tags | Nothing runs or loads | AT-15 |
| Any page | "Not investment advice" notice | AT-16 |
| Keyboard only: filter, sign in, vote, save | Everything works, focus always visible | AT-17 |

## Deploy

1. In Vercel, create a project from this repo with Root Directory `builds/matt`.
2. Add `DATABASE_URL` (the live Neon database) and `CRON_SECRET` in the project's settings.
3. Deploy, then run `npm run db:migrate` once against the live database.
4. Call `/api/cron/fetch` once with the secret to load stories right away (after that the daily
   cron job takes over).
5. Run the acceptance tests against the deployed URL (AT-14 is checked by a classmate).
