# Contributing

How John and Matt get changes into `main`. It follows our [working agreement](docs/WORKING_AGREEMENT.md): `main` is always deployable, and every change goes through a pull request the other person reviews.

## Branches

| Branch | Use |
| --- | --- |
| `main` | Always deployable. Vercel deploys it to production. Nobody pushes here directly, and agents never do. |
| `feature/<short-name>` | Any shared-base change: accounts, database, API, deployment, docs. |
| `bakeoff/v0-john` | John's bake-off version of the homepage experience (built with v0). |
| `bakeoff/claude-matt` | Matt's bake-off version (built with Claude). |
| `fix/<short-name>` | A small bug fix. |

Bake-off branches stay separate until the decision model has scored both and we've signed off (see "Mini bake-offs" in [docs/CONTRACT.md](docs/CONTRACT.md)). Only the winner, or the agreed merge, goes to `main`.

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

Then open a pull request on GitHub (the push prints a link). The template asks the questions below; answer them in the PR.

## Before you ask for review

- [ ] `npm test` passes. Paste the "N passed, 0 failed" line in the PR.
- [ ] It works for **two different signed-in users** (the test does this; check by hand if you changed the UI).
- [ ] No secrets in the diff: no `.env`, keys, database URLs or passwords.
- [ ] If you changed a table, an API route, a request or a response shape: [docs/CONTRACT.md](docs/CONTRACT.md) has a new change-log row, and the PR says "contract change".
- [ ] If an AI agent got something wrong while you worked: you wrote it up **yourself, in your own words** in the app's Agent log page. Don't have an agent write it.
- [ ] Synthetic test data only. Sample records say "Sample" / "test data".

## Reviewing

- Pull the branch and run `npm test` yourself, or at least open the Vercel preview link the PR gets.
- Check the contract: does the change match the API and data models in [docs/CONTRACT.md](docs/CONTRACT.md)?
- Approve, or leave specific comments. The lead for that area (see the roles table) has the final say.
- **Squash and merge.** Delete the branch afterwards.

A contract change needs **both** of us to approve and tick our boxes in the change log, even when one person leads the area.

## Merging rules

| Change | Who approves | Merge when |
| --- | --- | --- |
| Feature or fix in your own area | The other person reviews | Tests pass and the review is approved |
| Contract change (tables, API shapes, auth) | Both of us | Both boxes in the change log are ticked |
| Bake-off result | Both of us, after the decision model's recommendation | Scores and our reason are logged in the contract |
| Docs only | Either of us | Anytime; a heads-up is enough |

## Commit messages

One line saying what changed, then a blank line and why if it isn't obvious. If an agent wrote most of the change, say so in the commit body (for example "Co-Authored-By: Claude …" or "Generated with v0").
