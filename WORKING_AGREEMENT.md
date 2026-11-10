# Working Agreement

**Team:** Matt Baxter & John Affolter
**Course:** SEIS 606: Vibe Coding (Fall 2026), Project 2
**Last updated:** 2026-11-11

## Project choice

**Bake-off (Option B).** Each of us builds a complete first version of the Superintelligence
Homepage from the same [spec](specs/001-superintelligence-homepage/spec.md), then we compare the
two builds and combine the best parts of both.

**Why:** it's the cleanest division of labor. Each of us is fully responsible for our own build.
Splitting the app in half (Option A) could make it hard to organize how we build on each other's
work and fit the pieces together.

**How we pick:** a decision model (CLEF or JEV) scores both versions against criteria we agree on
before building (recorded in [`CONTRACT.md`](CONTRACT.md)). It recommends one version, or a
merge. We both sign off or override, and the reason goes in the change log.

## Roles

Each of us owns our own build. The lead has the final say in their area; the other partner
reviews their pull requests and can step in.

| Area | Lead (final say) | Backup |
|------|------------------|--------|
| Initial spec and constitution that drive the design | Matt | John |
| Bringing in relevant work from past projects | John | Matt |
| Matt's build (Claude Code) | Matt | John |
| John's build (v0) | John | Matt |
| Choosing the final version | Both, using the decision model (see How we pick) | |

## Tools

- **Matt:** Claude Code (with Spec Kit).
- **John:** v0.
- **Shared:** GitHub for code and reviews (repo on Matt's account, John as a collaborator), Vercel
  for hosting (deployed from John's Vercel account, connected to Matt's repo), and a Neon
  Postgres database through Vercel.

## Communication

- **Channel:** mainly text.
- **Response time:** under 24 hours.
- **Check-ins:** meetings 1–2 times a week on Teams or Zoom, plus a message the same day either of
  us is blocked.

## Repo workflow

- **Where the builds live:** each of us builds in our own folder: `builds/matt/` and
  `builds/john/`. The shared constitution, spec, contract and agent log stay at the repo root.
- `main` is always deployable.
- **Direct push or pull request is a judgment call** based on the change. Low-risk changes, like
  documentation or work in your own build folder, can go straight to `main`. Riskier changes,
  like sign-in, permissions, database changes or deployments, usually go on a branch
  (`feature/short-name`) and into a pull request the other partner reviews. We trust each other's
  judgment, so we review what needs it without burdening each other with unnecessary reviews.
- **Before merging a pull request:** tests pass, it works for two different signed-in users, no
  secrets are in the diff, and any agent mistake from that work is in the agent log.

## Agent rules

- **Agents may do unattended:** read the code, run tests, write code on a feature branch, and
  draft pull requests.
- **A human must review:** anything touching sign-in, passwords or permissions, database
  changes, deployments, and anything that costs money.
- **Agents push to `main` only when one of us tells them to**, following the judgment-call rule
  in Repo workflow.
- **Agents never:** handle real secrets, deploy, or spend money.
- **Agent log:** each of us writes our own entries in [`AGENT_LOG.md`](AGENT_LOG.md), in our own
  words, within a day of the session: what the agent got wrong, how we caught it, and the fix. No
  AI-written entries, and we don't write each other's.

## Disagreements

- **Breaking ties:** inside an area, the lead decides. Across areas, we take the smaller option
  and revisit once it ships. Choosing between the two builds follows How we pick.
- **Cutting scope:** we drop could-haves first, then should-haves; must-haves change only after
  telling Paul.
- **Falling behind:** if either of us will miss a deadline, we say so as soon as we know. If one
  build is still missing must-have requirements at a check-in where the other build has them, the
  further-along build becomes the base, and the partner who's behind switches to adding features
  and tests to it.
- **When we tell Paul:** if a deadline slips more than a week, or if either of us goes a week
  without responding.

## Data and costs

- **Synthetic data:** tests use synthetic data, meaning made-up users and recorded sample feeds.
  The live site reads only public feeds and stores nothing personal beyond a username.
- **Secrets:** secrets live in the host's environment variables, never in the repo (`.env` is
  git-ignored).
- **Spending cap:** $10 a month total for hosting and any AI API, with hard limits set in each
  provider's dashboard. Going over needs both of us to agree.

---

**Agreed by:** Matt Baxter 11/9/26 · John Affolter ______ (date)
