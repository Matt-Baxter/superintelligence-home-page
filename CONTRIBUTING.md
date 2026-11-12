# Contributing

How John and Matt get changes into `main`, built for speed. `main` is always deployable, every change goes through a pull request so there's a record and a preview link, and **you may merge your own pull request**: no review is required. Cheap automatic checks (preflight) stand in for a reviewer.

## Branches

| Branch | Use |
| --- | --- |
| `main` | Always deployable. Vercel deploys it to production. Nobody pushes here directly, and agents never do. |
| `feature/<short-name>` | Any shared-base change: accounts, database, API, deployment, docs. |
| `bakeoff/v0-john` | John's bake-off version of the homepage experience (built with v0). |
| `bakeoff/claude-matt` | Matt's bake-off version (built with Claude). |
| `fix/<short-name>` | A small bug fix. |

Bake-off branches stay separate until the decision model has scored both and we've signed off (see "Mini bake-offs" in [CONTRACT.md](CONTRACT.md)). Only the winner, or the agreed merge, goes to `main`.

## Making a change

```bash
git checkout main && git pull
git checkout -b feature/short-name
# make the change
npm run build                       # if you touched client/ or views/catalog.mjs
npm run dev:sample                  # terminal 1: app on synthetic data at http://localhost:3200
npm test                            # terminal 2: two-user browser test (49 checks)
git add -A && git commit -m "Say what changed and why"
git push -u origin feature/short-name
```

The push runs `npm run preflight` first (installed as a git hook by `npm install`). Then open a pull request on GitHub (the push prints a link), wait for the green **Preflight** check and the Vercel preview, and merge it yourself.

## Preflight (automatic, about 3 seconds)

`npm run preflight` checks:

- JavaScript syntax
- JSON files
- the json-render bundle build
- secrets in tracked files
- the no-Twitter rule
- a contract reminder
- an API smoke test on synthetic data (sign-up, feed, grouping, voting, the brief, the agent log, access control)

It runs on `git push` locally, and in GitHub Actions on every push and pull request, so commits made from v0 get checked too. To skip it once, use `git push --no-verify`.

## Before you merge your own PR

- [ ] Preflight is green.
- [ ] For bigger changes, `npm test` (the full two-user browser test) passes too.
- [ ] You clicked through the Vercel preview.
- [ ] No secrets in the diff: no `.env`, keys, database URLs or passwords.
- [ ] If you changed a table, an API route, a request or a response shape: [CONTRACT.md](CONTRACT.md) has a new change-log row, and the PR says "contract change".
- [ ] If an AI agent got something wrong while you worked: you wrote it up **yourself, in your own words** in the app's Agent log page. Don't have an agent write it.
- [ ] Synthetic test data only. Sample records say "Sample" / "test data".

## Merging

- **Squash and merge**, then delete the branch.
- Reviews are welcome but never required. Ask for one when you want a second pair of eyes.
- The one exception: a **contract change** (tables, API shapes, auth) needs both of us to tick our boxes in the change log, because it changes what the other person builds against. A quick "ok" in chat is enough.

## Merging rules

| Change | Who merges | Merge when |
| --- | --- | --- |
| Feature, fix or docs | Whoever made it | Preflight is green |
| Contract change (tables, API shapes, auth) | Whoever made it | Both boxes in the change log are ticked |
| Bake-off result | Either of us | After the decision model's recommendation and both sign-offs are logged in the contract |

## Commit messages

One line saying what changed, then a blank line and why if it isn't obvious. If an agent wrote most of the change, say so in the commit body (for example "Co-Authored-By: Claude …" or "Generated with v0").
