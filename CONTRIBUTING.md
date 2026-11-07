# Contributing

How John and Matt get changes into `main`, built for speed. `main` is always deployable, every change goes through a pull request so there's a record and a preview link, and **you may merge your own pull request**: a review from the other partner is helpful and encouraged, never required. Cheap automatic checks (preflight) stand in for a reviewer.

## From spec to merge

The [shared spec](specs/001-superintelligence-homepage/spec.md) decides what gets built, under the [constitution](.specify/memory/constitution.md). We use Spec Kit (its commands are skills in `.claude/skills/speckit-*`):

| Step | What | Who approves |
| --- | --- | --- |
| 1. Specify | `/speckit-specify`, then `/speckit-clarify` for open questions. Every requirement gets a REQ ID. | Both of us (it's shared) |
| 2. Plan | `/speckit-plan` per build: each of us records our own stack and design. | The builder |
| 3. Tasks | `/speckit-tasks`; each task names its REQ IDs. Track them on the Project page (`/m/project`) with a `REQ-0xx` label. | The builder |
| 4. Build | On a branch. Commits and the PR name the REQ IDs they serve. | The builder |
| 5. Trace | Update [docs/SPEC_TRACE.md](docs/SPEC_TRACE.md): where each REQ lives and which test checks it. Preflight fails if a REQ in the spec isn't traced. | The builder |
| 6. Merge | Preflight green, then merge your own PR. | The builder |
| 7. Compare | Bake-off: score both builds on `/m/decide` against the criteria in [CONTRACT.md](CONTRACT.md), sign off, log it. | Both of us |

Work that serves no REQ goes into the spec first (constitution, principle III).

## Branches

| Branch | Use |
| --- | --- |
| `main` | Always deployable. Vercel deploys it to production. Nobody pushes here directly, and agents never do. |
| `feature/<short-name>` | Any shared-base change: accounts, database, API, deployment, docs. |
| `bakeoff/v0-john` | John's bake-off version of the homepage experience (built with v0). |
| `bakeoff/claude-matt` | Matt's bake-off version (built with Claude). |
| `fix/<short-name>` | A small bug fix. |

Bake-off branches stay separate until we've scored both against the criteria in [CONTRACT.md](CONTRACT.md) (Decision point) and signed off. Only the winner, or the agreed merge, goes to `main`.

## Making a change

```bash
git checkout main && git pull
git checkout -b feature/short-name
# make the change
npm run build                       # if you touched client/ or views/catalog.mjs
npm run dev:sample                  # terminal 1: app on synthetic data at http://localhost:3200
npm test                            # terminal 2: two-user browser test (about 130 checks)
git add -A && git commit -m "REQ-003: say what changed and why"
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
- the spec trace (every REQ in the spec appears in docs/SPEC_TRACE.md)
- the modules and the agent kit
- an interfaces reminder (tables or routes changed without docs/INTERFACES.md)
- an API smoke test on synthetic data (sign-up, feed, grouping, voting, the brief, the agent log, access control)

It runs on `git push` locally, and in GitHub Actions on every push and pull request, so commits made from v0 get checked too. To skip it once, use `git push --no-verify`.

## Before you merge your own PR

- [ ] Preflight is green.
- [ ] For bigger changes, `npm test` (the full two-user browser test) passes too.
- [ ] You clicked through the Vercel preview.
- [ ] No secrets in the diff: no `.env`, keys, database URLs or passwords.
- [ ] The PR names the REQ IDs it serves, and [docs/SPEC_TRACE.md](docs/SPEC_TRACE.md) is up to date.
- [ ] If you changed a table, an API route, a request or a response shape: [docs/INTERFACES.md](docs/INTERFACES.md) has a new row.
- [ ] If an AI agent got something wrong while you worked: you wrote it up **yourself, in your own words** in the app's Agent log page. Don't have an agent write it.
- [ ] Synthetic test data only. Sample records say "Sample" / "test data".

## Merging

- **Squash and merge**, then delete the branch.
- Reviews are helpful and welcome, never required. Ask for one when you want a second pair of eyes.
- The one exception: **shared documents** (the spec, the constitution, CONTRACT.md, WORKING_AGREEMENT.md) need both of us, because the other person builds against them. A quick "ok" in chat is enough; note it in the PR.

## Merging rules

| Change | Who merges | Merge when |
| --- | --- | --- |
| Feature, fix or docs | Whoever made it | Preflight is green |
| Contract change (tables, API shapes, auth) | Whoever made it | Both boxes in the change log are ticked |
| Bake-off result | Either of us | After the decision model's recommendation and both sign-offs are logged in the contract |

## Commit messages

One line saying what changed, then a blank line and why if it isn't obvious. Name the REQ ids it serves. Don't add co-author or session trailers (no `Co-Authored-By` lines).
