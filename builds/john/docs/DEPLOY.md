# Deploying to Vercel

The site runs on Vercel from John's v0/Vercel account, with the code on Matt's GitHub repo and a Neon Postgres database. Each push to `main` deploys to production; each pull request gets its own preview link.

**Who touches what:** John builds in v0 and owns the Vercel project. Matt builds in Claude and pushes to GitHub. Matt doesn't need a Vercel login: his pushes deploy through the GitHub link, and preview links appear on his pull requests. If Matt wants his own Vercel project (for example for his bake-off version), he can import the same repo into his Vercel account the same way.

## One-time setup

### 1. Matt: let Vercel see the repo

Vercel can only link a repo its GitHub app can read, and only the repo owner can grant that.

1. Go to **github.com/apps/vercel** → **Configure** (or **Install**) → pick the **Matt-Baxter** account.
2. Choose **Only select repositories**, add `superintelligence-home-page`, and save.

If Vercel still won't link the repo from John's account, use the fallback at the end of this guide.

### 2. John: create the Vercel project

1. In Vercel (the account v0 uses), click **Add New → Project** and import `Matt-Baxter/superintelligence-home-page`.
2. Leave the settings alone. `vercel.json` already sets the build (`npm run build`), the output folder (`public`), the API function (`api/index.js`), clean URLs and the cron job. Framework preset: **Other**.
3. Don't deploy yet; add the database first.

### 3. John: add Neon

1. In the project, open **Storage → Create Database → Neon (Serverless Postgres)**, accept Neon's terms, and pick the free plan and a US region close to Chicago (`us-east-1` or `us-east-2`).
2. Connect it to the project for **Production, Preview and Development**. This sets `DATABASE_URL` and `POSTGRES_URL` automatically. The app reads either one.
3. Optional but tidy: turn on Neon's **branch per preview deployment**, so pull-request previews get their own copy of the data instead of writing into production.

The tables are created automatically on the first API request. There's no migration step.

### 4. John: environment variables

In **Settings → Environment Variables**, add:

| Name | Value | Environments |
| --- | --- | --- |
| `CRON_SECRET` | A long random string (run `openssl rand -hex 32`) | Production |
| `APP_TZ` | `America/Chicago` | All |

Never commit these; `.env` is git-ignored.

### 5. Deploy and claim admin

1. Click **Deploy**. When it's done, open the URL.
2. **Create the first account right away.** The first account becomes the admin and gets an **Admin** link in the top bar.
3. Open **Admin → Harvest all now**. The message says how many sources worked; **Admin → Overview → Needs attention** lists any that failed, with the error.
4. Open **Admin → Add sources → Source catalog**, tick the sources you want and press **Enable selected and test them**. Each one is test-fetched; none of the catalog URLs could be checked from the build sandbox, so expect a few to need fixing or deleting on the **Sources** tab.
5. Make Matt an admin on **Admin → Users** after he signs up.

## How feeds stay fresh

`vercel.json` schedules `/api/cron/fetch` four times a day (00, 06, 12 and 18 UTC). Vercel's Hobby plan allows each cron job to run at most once a day, but allows many jobs, so there are four daily jobs. Hobby runs each within the hour it's set for. Admins can also press **Harvest all now** on the Admin page at any time. The cron route only runs when the request carries `Authorization: Bearer $CRON_SECRET`, which Vercel adds automatically.

Each source has its own interval (default 6 hours, set on **Admin → Sources**). A harvest fetches only sources that are due, asks servers for changes only (ETag / Last-Modified), backs off a failing source (2×, 4× … up to 32× its interval) and stops starting new fetches after 45 seconds (`HARVEST_BUDGET_MS`) so it fits in one function call; sources it didn't reach go first next time. Every fetch is written to **Admin → Harvest log**.

## Staying on the free tiers

Checked Nov 5, 2026. Plans change, so check the links before relying on these numbers.

| Limit | Free allowance | How the app stays under it |
| --- | --- | --- |
| [Neon Free](https://neon.com/faqs/free-plan-limits-and-quotas) storage | 1 GB per project | Harvest log capped at 2,000 runs, audit log at 5,000 rows, expired sessions deleted, story summaries capped at 1,500 characters. **Admin → Overview → Free tier** shows the size. |
| Neon compute | 100 CU-hours a month; scales to zero after 5 idle minutes | The Postgres pool holds at most 2 connections on Vercel and closes them after 5 s idle (`PG_POOL`, `PG_IDLE_MS`), so the database can sleep between visits. No page polls. |
| Neon egress | 5 GB a month | Feed pages return 40 stories at a time. |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) functions | 1M invocations, 4 active CPU-hours | One function for the whole API. Fetching feeds is mostly waiting on the network, which doesn't count as active CPU. |
| [Hobby cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Each job at most daily | Four daily jobs give a harvest every 6 hours. |
| Function duration | Up to 300 s on Hobby | `maxDuration` is 60 s and a harvest stops starting fetches after 45 s; unreached sources go first next time. |
| Bandwidth | 100 GB fast data transfer | Static pages come from the CDN; `/js` and `/css` are cached for an hour. |

## Day to day

- Merging to `main` deploys production.
- Every pull request gets a preview URL in a comment on the PR. Review there.
- Logs: **Project → Logs** (or **Deployments → a deployment → Functions**) shows server errors.
- Rolling back: **Deployments → an older deployment → ⋯ → Promote to Production**.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "To link this repository, check that your Vercel GitHub App has access" | Step 1 not done, or done on the wrong account | Matt grants the Vercel app access to the repo |
| API returns 500 and logs say `ECONNREFUSED` or `password authentication failed` | No database connected to that environment | Storage → connect Neon to Production/Preview |
| Everyone gets logged out after each deploy | The database is SQLite, not Neon | Check `DATABASE_URL` is set; SQLite can't persist on Vercel |
| Sources all show errors | A site blocks the fetch, or its feed URL moved | Fix the URL on the Sources page (admin) or pause that source |
| Cron never runs | `CRON_SECRET` missing, or deployment not on production | Add the variable and redeploy |

## Fallback: deploy from a fork

If Vercel won't link a repo owned by another account:

1. John forks `Matt-Baxter/superintelligence-home-page` to his own GitHub.
2. Import the fork in Vercel instead (steps 2–5 above).
3. Keep the fork in sync: on GitHub, use **Sync fork** after each merge to Matt's `main`. Pull requests still go to Matt's repo.

## Local Postgres (optional)

```bash
DATABASE_URL="<your local Postgres URL>" npm start
# or run the full browser test against Postgres:
DATABASE_URL="<a throwaway database URL>" npm run dev:sample:pg      # resets that database, so use a throwaway one
BASE=http://localhost:3300 npm test
```

## Graph preview readiness — November 7, 2026

John explicitly requested deployment and connected-tool verification. Read-only checks of the connected personal Hobby team and both connected work teams found no matching project. The local checkout has no `.vercel/project.json`. A target project/account and a persistent preview Postgres database are therefore still needed before an honest end-to-end deployment can be verified. No project, paid resource, public test admin, database or production alias was created during these checks.

The graph exists only in `SITE_PROFILE=extended`. Set that profile consistently at **build and runtime** for the selected preview. The default spec build intentionally has no extended blocks. Build from `feature/si-combined`; use Node 22 or 24 and the existing Express API entry point. Never run the destructive fixture browser suite against a hosted database. Real preview smoke tests should read the feed, verify guest writes are refused, sign in with a designated test account, inspect graph evidence and JSON-LD, then inspect deployment/runtime logs through the connected Vercel tools.

Preview must use its own Postgres database; local SQLite and loopback-only demo accounts are not a hosted persistence or authentication setup. Existing first-account-admin behavior also requires controlled account bootstrap before admitting visitors. Confirm whether preview inherits production database variables before making any API request: boot creates/backfills tables.

Research sources: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel deployment protection](https://vercel.com/docs/deployment-protection). Keep the current schedules subject to project/plan validation; this work did not reinterpret the repository's daily-only rule or change schedules.

## Graph logic research and implementation

Keep the existing relational adjacency tables for now. [PostgreSQL recursive queries](https://www.postgresql.org/docs/current/queries-with.html) support traversal with cycle tracking, but this app also targets SQLite. A future multi-hop view should use a portable bounded traversal (explicit relation filter, direction, visited set, depth/node/edge caps) and return paths with source evidence. Do not infer transitive scientific support from shared mentions. No multi-hop inference, graph database dependency or automatic relation generation was added in this pass.

[W3C PROV-O](https://www.w3.org/TR/prov-o/) provides a reference for separating an assertion from its derivation. Applied here: graph edges disclose the recorded origin, direction, weight unit and evidence examples. Co-occurrence means tags share indexed passages; it never proves causation, agreement or independent corroboration. Reviewed relationships are derived from saved reviews, not independently verified facts. Full PROV-O conformance is not claimed.

Local validation of graph explanations: `Graph logic: 6 passed, 0 failed.`, isolated SQLite HTTP/database `19 passed, 0 failed.`, browser `331 passed, 0 failed`; `page errors: none`; preflight `Preflight passed.` [Expanded connection evidence](../shots/graph-connection-evidence.png) uses the synthetic fixture app. No hosted result is claimed.
