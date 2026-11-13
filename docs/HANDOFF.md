# Handoff: state of John's build, for Codex and v0

> **Newer:** start with [handoff/SI-HANDOFF-2026-11-07.md](../handoff/SI-HANDOFF-2026-11-07.md). This page describes `fix/sync-with-main` only; a second line of work, `feature/judge-fidelity-rules`, still has to be combined with it.

Written 2026-11-07 for whoever picks this up next (Codex for code, v0 for the bake-off UI). Everything below is on branch `fix/sync-with-main`. Rules first, then what exists, how to run it, what's open, and ready-to-use prompts.

## 1. Rules that don't change

From [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md) (they apply to every agent and tool), plus John's standing instructions:

- Work on `feature/`, `fix/` or `bakeoff/` branches. **Never push to `main` or to any of Matt's branches** (`main`, `bakeoff/claude-matt`, `claude/*`, anything Matt created). Never merge; John opens and merges pull requests once preflight is green. Never force-push without John.
- Never deploy or change Vercel, Neon or GitHub settings.
- Commits are authored as **John Affolter <affo4353@stthomas.edu>**, carry **no trailers** (no `Co-Authored-By`, no session lines), and no commit, file, comment or report names an AI assistant, model or vendor. Preflight checks the trailers.
- Never write `AGENT_LOG.md` entries: John and Matt write those themselves.
- No Twitter/X (or mirrors such as nitter) as a source, suggestion or link. No secrets in code. Free tiers only: no polling, no cron more often than daily.
- **Real people only as watchlist entries:** never write claims, quotes, results or forecasts attributed to a person. Personal blogs and newsletters are graded as a class, never tracked by writer.
- Test data is synthetic and labelled "Sample" / "test data".
- Spec first: name the REQ ids a change serves; new work goes into `specs/002-research-layer/spec.md` as a Proposed REQ (both partners approve). Shared documents (spec 001, the constitution, CONTRACT.md, WORKING_AGREEMENT.md) need both partners.
- Report exact pass/fail lines; never claim something works without running it.

## 2. Git state to sort out first

- `fix/sync-with-main` was rewritten locally so no commit on it names an assistant (43 commits; file contents unchanged). The rewrite and three new commits are **not on GitHub yet**: an automated safety check blocked the force-push. John runs it himself:
  `git push --force-with-lease origin fix/sync-with-main`
  The pre-rewrite history is kept locally as branch `backup/before-clean-history`.
- 27 older commits already on `main` carry assistant trailers. Rewriting `main` means force-pushing it, which the rules forbid; that's John and Matt's call.
- Open feature branches from the daily watcher: `feature/paper-watch-2026-11-07` and `feature/paper-watch-2026-11-07-b` (review, then open a PR or delete).

## 3. What exists

Two versions run from one codebase (`SITE_PROFILE` in `modules/profiles.json`):

| Profile | What runs | For |
| --- | --- | --- |
| `spec` (default) | The core plus the `admin` module only: exactly Matt's shared spec (REQ-001 to REQ-020). | The bake-off build. |
| `extended` | Everything below. | John's comparison build. |
| `research` | admin, knowledge, learn, the Lab (with blocks-core, generative-ui, decision), review, research. | A separate research subdomain whose RSS feeds the spec site ([docs/RESEARCH_SITE.md](RESEARCH_SITE.md)). |

Research layer (all proposed in spec 002, REQ-021 to REQ-054, not yet approved):

| Piece | Where | What it does |
| --- | --- | --- |
| Review desk | `modules/review/review.js`, `/m/review` | Judges a paper, article or comment: significance, rigor, hype, credibility, a verdict, six anti-gaming guards, claims marked backed or not. Deterministic; no model calls. |
| Published criteria | `CRITERIA`, `VERDICTS` in `review.js`; `/research/criteria` | One table the judge uses and the pages print; `test/review-unit.js` checks they match. |
| Source grades, forecasts, buzz | `modules/review/sources.js` | A to E grade per piece (outlet kind, cites research, hype, selling); dated forecasts as `event:` nodes (names removed) a person resolves; outlet track records (hit rate from 3 resolved); buzz level next to the evidence rating, never lifting it. |
| Dossiers | `modules/review/dossier.js`, `/m/dossier`, `npm run dossier <topic>` | Per topic: evidence rating (none yet, thin, early, some support), buzz versus evidence, forecasts, traced references, blog draft, short posts, video storyboard. |
| Research site | `modules/research/`, `/research`, `/research/feed.xml` | Public write-ups with a scorecard, topic pages, RSS. Hidden unless `RESEARCH_PUBLIC=1`; noindex; "Research preview" tag. |
| Daily watcher | `scripts/watch.js`, `modules/review/watch.json` | Reviews papers (arXiv) and, with `--from`, articles; writes `out/watch/<date>.md`; queues at most two papers for paper-to-code (not surveys or position papers). |
| Lab | `modules/lab/`, `/m/lab` | Deterministic CPU toys of papers' ideas with our hypotheses, kept even when refuted; `modules/lab/results.json` precomputed (`npm run lab:results`). |
| Learn | `modules/learn/`, `/m/learn`, `/m/explainer` | Concepts, explainer player, studio jobs; `npm run learn:worker` records videos. |
| Benchmarks | `scripts/bench.js`, `bench/` | 23 metrics on labelled synthetic sets; a change that makes one worse than its tolerance fails preflight. |
| Project tracker sync | `scripts/project-sync.js`, `modules/project/sync.json` | One issue per proposed REQ, people check, research item waiting for a person, agent job and scheduled task (idempotent `sync-key:` lines). |
| Judge panel | `modules/review/panel.js`, `PANEL_MODELS` | Background only: two different models plus the rules judge, with identity, prestige and wording masks, rubric order varied, quotes checked; agree → mean, disagree → most conservative and a person, fewer than two usable → rules stand (incomplete). Set `PANEL_MODELS=ollama:gemma3:12b,groq:llama-3.1-8b-instant` (or two other families) wherever the watcher runs. |
| Research control room | `/m/control` (admins), `GET /api/admin/research/status` | One page for everything waiting on a person: forecasts due (happened, did not, unclear, annulled), reviews to label, quality checks, panel set-up, proposals and people checks, links to every research page. |
| Advisor tier | `ADVISOR_MODEL`, `npm run advise` | A bigger model advises when the efficient models disagree (never scores) and reviews judging quality, proposing benchmark items a person adopts. |
| Agent check-in | `scripts/checkin.js` (`npm run checkin`) | What is waiting on both partners, on a person and on agents, with the next action; writes `out/checkin/<date>.md`. |

Source catalog: `lib/source-catalog.json` (61 candidates, kinds as in the core). Buzz feeds added and checked 2026-11-07: Medium tag feeds `superintelligence` and `agi`, Hacker News search for superintelligence. Reddit blocks automated readers.

Interfaces (tables, routes, shapes): [docs/INTERFACES.md](INTERFACES.md) rows 1.5 to 1.9. Requirement trace: [docs/SPEC_TRACE.md](SPEC_TRACE.md). Spec status: [docs/SPEC_STATUS.md](SPEC_STATUS.md) (18 of 20 automated; REQ-019 deploy and REQ-020 agent log need people).

## 4. How to run and check

```bash
npm install
npm run preflight                      # syntax, build, secrets, no-Twitter, unit checks, bench, spec trace, API smoke, spec acceptance
SITE_PROFILE=extended npm run build    # preflight builds the spec profile, which rewrites public/js/jr.js; rebuild (or git checkout public/js/jr.js) before the browser test
PORT=3200 node test/serve-fixtures.js &  then  npm test   # two-user browser test, must stay 0 failed
npm run test:research                  # research site feeds the spec feed, end to end
npm run checkin                        # what's waiting, on whom
```

Results at handoff: preflight passed; browser test 182 passed, 0 failed; spec acceptance 37/37 (18 of 18 testable requirements); review unit 26/0; sources unit 26/0; panel unit 15/0 (stand-in models; no live model was reachable from the build sandbox); research feed 14/0; dossier unit 14/0; project-sync unit 5/0; bench 23 metrics, 0 regressions.

## 5. Waiting on people

Most of these are visible and actionable in the research control room (`/m/control`). [PRACTICES.md](PRACTICES.md) lists what to adopt next and [PARITY.md](PARITY.md) compares us with comparable apps (calibration with kappa, skill trigger tests, forecast resolution criteria).


- John and Matt: approve or drop REQ-021 to REQ-054 (spec 002), contract 0.6 and constitution 1.2.0.
- Deploy (REQ-019); share with the class two weeks before the presentation.
- Write `AGENT_LOG.md` entries (REQ-020). Agents must not.
- The research subdomain is optional: a second Vercel project with `SITE_PROFILE=research`, `RESEARCH_PUBLIC=1`, its own database; then add its feed as a source on the spec site.
- Label reviews the guards sent to a person; resolve forecasts as they fall due (`/m/dossier`).

## 6. The daily task, for Codex

The daily scheduled agent task ("Daily paper watch, buzz and agent check-in", 5:47 AM Central) is still switched on: John turns it off in his scheduled tasks. To run the same job with Codex (or by hand), give it this, once a day:

> Work in Matt-Baxter/superintelligence-home-page on branch fix/sync-with-main. Read AGENTS.md, CLAUDE.md and agent-kit/skills/work-from-the-spec/SKILL.md and follow their rules exactly; also: never push to main or any of Matt's branches, commit as John Affolter <affo4353@stthomas.edu> with no trailers, never name an AI assistant or model anywhere, never attribute claims or forecasts to a named person. (0) Run `SITE_PROFILE=extended DATA_DIR=out/watch/db npm run checkin`. (1) Find arXiv papers from the last 2 days on the queries in modules/review/watch.json and up to 6 recent articles or blog posts on the same topics (no Twitter/X). (2) Make sure PANEL_MODELS names two efficient models from different makers and ADVISOR_MODEL one bigger model (see .env.example), so every judgement is compared across two models behind the bias masks. Write them to out/watch/inputs/<date>.json with your own paraphrased summaries (kind, sourceKind, published, title, url, summary, authors; outlet names for articles), then run `SITE_PROFILE=extended DATA_DIR=out/watch/db node scripts/watch.js --from out/watch/inputs/<date>.json`. (3) For the top queued paper, build one deterministic CPU toy following modules/lab/papers.js with a Lab example, unit checks and a bench metric; run `npm run lab:results`. (4) Run every check in docs/HANDOFF.md section 4 and report exact lines. (5) Only if all pass, push a new branch feature/paper-watch-<date>. (6) Report: what needs John or Matt first, then what was done, each topic's evidence rating next to its buzz level, and the check results.

The GitHub Actions workflow `.github/workflows/paper-watch.yml` runs the watcher with direct arXiv access once merged, with no agent involved.

## 7. For v0 (the bake-off UI)

v0 builds the spec version's pages against the same backend. Start from [docs/V0.md](V0.md) and the shared spec. Everything v0 needs from the server is in [docs/INTERFACES.md](INTERFACES.md); the spec version's routes are the core ones (accounts, stories, votes, saves, sources, topics, admin). Keep the monochrome system in `public/css/app.css` (tokens on `:root`, Newsreader and IBM Plex self-hosted) if you want the two builds to compare on substance rather than look. Work on `bakeoff/v0-john`; never on Matt's branches.

## 8. Known limits

- Papers are judged from abstracts and articles from agent-written paraphrases, so nothing rates above "some support"; the rules say so on every page.
- The daily run starts from an empty database each time (out/ isn't committed), so forecasts and track records accumulate only where a site's database persists (the deployed research site).
- Hype words are a fixed list; new hype phrasing found in real data should be added with a synthetic benchmark item first (as `b-hype-press-words` was).
