# Working agreement

SEIS 606 Project 2 · John Affolter and Matthew Baxter · from our Project 2 Plan doc, Nov 4, 2026

One page, covering the eight points Paul asked for. Items marked **[confirm]** we still need to settle together.

## Project choice: a mix of split and bake-off

- **Split (built once):** accounts, database, API and deployment, so there is one live app to share with the class.
- **Bake-off (built twice):** the homepage experience itself, meaning the feed, story grouping and tagging, and the weekly brief. Each of us builds our own version against the same contract. John reuses his existing work (json-render views, ontology tagging, and the build so far); Matt brings his own approach.
- **Why:** we both have work worth reusing, a bake-off keeps the comparison fair, and splitting the base means we don't build the plumbing twice.
- **How we pick:** a decision model (CLEF or JEV) scores both versions against criteria we agree on before building. It recommends one version, or a merge. We both sign off or override, and the reason goes in the change log in [CONTRACT.md](CONTRACT.md).

## Roles

The lead has the final say in their area; the backup reviews their pull requests and can step in.

| Area | Lead (final say) | Backup | Confirmed (John) | Confirmed (Matt) |
| --- | --- | --- | --- | --- |
| Ingestion, sources, ontology tagging | John | Matt | | |
| Accounts, database, deployment | Matt | John | | |
| Feed UI, reading lists, weekly brief | Matt | John | | |
| Agent log page, tests | Shared | Shared | | |

## Tools

For the bake-off, John builds with **v0** and Matt builds with **Claude**. Shared: GitHub for code and reviews (repo on Matt's account, John as a collaborator), **Vercel** for hosting (deployed from John's Vercel account, connected to Matt's repo), a hosted Postgres database through Vercel **[confirm: Neon or Supabase]**, and our plan doc for planning.

## Communication

One project channel **[confirm: Teams, Slack, Discord or text]**. Reply within 24 hours on weekdays. A 30-minute check-in twice a week **[confirm days]**, plus a message the same day either of us is blocked.

## Repo workflow

`main` is always deployable. Each change goes on its own branch (`feature/short-name`) and into a pull request the other person reviews. Bake-off work lives on `bakeoff/v0-john` and `bakeoff/claude-matt`. Before merging: tests pass, it works for two different signed-in users, no secrets in the diff, and any agent mistake from that work is in the agent log.

## Agent rules

- **Agents may do unattended:** read the code, run tests, write code on a feature branch, and draft pull requests.
- **A human must review:** every merge to `main`, anything touching sign-in, passwords or permissions, database changes, deployments, and anything that costs money.
- **Agents never:** push to `main`, handle real secrets, or deploy.
- **Agent log:** each of us writes our own entries, in our own words, in the app's Agent log page, within a day of the session: what the agent got wrong, how we caught it, and the fix. No AI-written entries, and we don't write each other's.

## Disagreements

Inside an area, the lead decides. Across areas, we take the smaller option and revisit once it ships. To cut scope, we drop could-haves first, then should-haves; must-haves change only after telling Paul. If either of us will miss a gate, we say so as soon as we know. We tell Paul if a gate slips more than a week, or if either of us goes a week without responding.

## Data and costs

Tests use synthetic data: made-up users and recorded sample feeds. The live site reads only public feeds and stores nothing personal beyond a username. Secrets live in the host's environment variables, never in the repo (`.env` is git-ignored). Spending cap: **$10 a month total [confirm]** for hosting and any AI API, with hard limits set in each provider's dashboard. Going over needs both of us to agree.
