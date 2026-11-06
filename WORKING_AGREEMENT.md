# Working Agreement

**Team:** Matt Baxter & John Affolter
**Course:** SEIS 606: Vibe Coding (Fall 2026), Project 2
**Last updated:** 2026-11-06

> Keep this to one page. Items marked **[confirm]** we still need to settle together.

## Project choice

- **Choice:** Bake-off (Option B)
- **Why:** Each of us builds the whole site, which is a cleaner division of labor than splitting it in half and integrating two halves later. Matt builds with Claude Code, John with v0, and we compare and merge the best parts.
- **What we build against:** the [constitution](.specify/memory/constitution.md) and the [shared spec](specs/001-superintelligence-homepage/spec.md) (REQ IDs and acceptance scenarios). How we compare and decide is in [CONTRACT.md](CONTRACT.md).

## Roles

| Area | Owner | Final say |
|------|-------|-----------|
| Matt's build (Claude Code) | Matt | Matt |
| John's build (v0) | John | John |
| Shared spec, constitution, contract | Both | Both |
| Repo (GitHub, on Matt's account) | Matt | Both |
| Deployment (Vercel on John's account, Neon database) | John | Both |
| Comparison and final merge | Both | Both (decision model recommends) |

## Tools

| Partner | Agents / AI tools | Platforms / hosting |
|---------|-------------------|---------------------|
| Matt | Claude Code (with Spec Kit) | GitHub; Vercel + Neon (shared) |
| John | v0 (Claude Code for shared tooling) | GitHub; Vercel + Neon (shared) |

## Communication

- **Channels:** **[confirm]** one chat for quick questions; GitHub pull requests and the Project page (`/m/project`) for work items
- **Expected response time:** within 24 hours on weekdays
- **Check-in cadence:** **[confirm days]** 30 minutes twice a week, plus a message the same day either of us is blocked

## Repo workflow

- **Branching:** `main` is always deployable; work on `feature/`, `fix/`, `bakeoff/claude-matt` or `bakeoff/v0-john` branches.
- **Spec first:** we follow the Spec Kit flow (specify → plan → tasks → build → trace); commits and pull requests name the REQ IDs they serve. Details in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Pull request review:** helpful and encouraged, not required. You may merge your own pull request once preflight is green.
- **Before merging, all of these must be true:**
  - [x] Preflight is green (syntax, build, secrets, no-Twitter, spec trace, API smoke test)
  - [x] App builds and runs locally; `npm test` passes for bigger changes
  - [x] No secrets committed
  - [x] The PR names its REQ IDs and `docs/SPEC_TRACE.md` is current
  - [x] Shared documents (spec, constitution, this agreement, CONTRACT.md) changed only with both of us agreeing

## Agent rules

- **Agents may do unattended:** read code, run tests, write code on a branch, draft pull requests and docs.
- **A human must review:** every merge to `main`, changes to shared documents, auth and security code, database schema changes, deployments, anything that spends money. Agents never merge to `main`, deploy, handle real secrets or spend money.
- **Agent log:** each of us writes our own entries in the app's Agent log page, in our own words, within a day of the session: what the agent got wrong, how we caught it, and the fix. Not AI-generated, and we don't write each other's.

## Disagreements

- **Breaking ties:** inside your own build, you decide. For shared documents and the final merge, the decision model (weighted criteria, or CLEF / JEV) recommends and we both sign off or override, with the reason logged in CONTRACT.md.
- **Cutting scope:** must-haves are the spec's REQs; everything else is cut first when behind schedule.
- **If a partner falls behind:** say so as soon as you know; raise it at the next check-in and re-plan.
- **When we tell the instructor:** if a deadline is at risk, or an issue isn't resolved within a week.

## Data and costs

- **Synthetic data:** made-up users and recorded sample feeds only, labelled "Sample" / "test data".
- **Secret handling:** keys and database URLs live in Vercel's environment settings and a git-ignored `.env`; never in commits or prompts.
- **Spending caps:** **[confirm]** $10 a month total for hosting and AI APIs (the constitution's cap), with hard limits in each provider's dashboard; going over needs both of us.

---

**Agreed by:** Matt Baxter ______ (date) · John Affolter ______ (date)
