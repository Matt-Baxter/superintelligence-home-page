# SI handoff, 2026-11-07 (for Codex, v0 and John and Matt)

> **Later note (2026-11-12):** the research-layer requirements this handoff calls REQ-032 to REQ-035 were renumbered REQ-053 to REQ-056 (same order) to avoid a collision with `feature/judge-fidelity-rules`. See `specs/002-research-layer/spec.md`.

Start here. The work is split across **two lines that are each tested but not yet combined**, and they reuse the same requirement numbers for different things. The first job for the next agent is to combine them cleanly; nothing else should land on top until that is done.

Rules that apply to every tool (from [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md), plus John's standing instructions): never push to `main` or any of Matt's branches (`main`, `bakeoff/claude-matt`, `claude/*`); never merge or deploy; commits authored as **John Affolter <affo4353@stthomas.edu>**, no trailers, and no assistant or model name in any commit, file or report; never write `AGENT_LOG.md` entries; no Twitter/X; no claims or forecasts attributed to real people; synthetic test data labelled "test data"; report exact pass/fail lines.

## 1. The branches

| Branch | What it holds | Checked 2026-11-07 | History |
| --- | --- | --- | --- |
| `fix/sync-with-main` | Research layer: review desk, research site and feed, source grades A–E, forecasts with outcomes and Brier, buzz vs evidence, two-model panel with bias masks and a bigger-model advisor, reporting rubric for articles, withdrawn verdict, quality report, control room `/m/control`, open data, parity matrix (8 apps), practices list | Preflight passed; browser test 182 passed, 0 failed; bench 23 metrics, 0 regressions; spec acceptance 37/37 | Clean: 56 commits, all John, no assistant names |
| `feature/rigor-badge` | `fix/sync-with-main` plus the rigor badge on main-feed stories (extended only) | Rigor-badge test 6/0; preflight passed | Clean |
| `feature/judge-fidelity-rules` | Spec 003 judge fidelity (canonical text, scoring the arXiv abstract, negation and rewording, borderline bands, edge-case catalogue), `docs/HUB.md` generated hub, Specs view `/m/project#/specs`, a 35-app parity matrix and spec 004 (REQ-041..052), `handoff/` folder with prompts | Preflight passed here; judge edge cases 72 passed with 2 known gaps; bench 25 metrics, 0 regressions; spec acceptance 37/37 | **Built on the old history** of `fix/sync-with-main` (before it was cleaned): 29 commits authored as the assistant, 43 assistant mentions |
| `feature/judge-fidelity-spec` | The spec-only part of the above | – | Same old history |
| `feature/paper-watch-2026-11-07`, `-b` | Daily watcher outputs | – | Older |

Trying to combine `feature/judge-fidelity-rules` into `fix/sync-with-main` gives **64 conflicting files**, including `modules/review/review.js` (both lines changed the judge), `bench/review-set.json`, `docs/PARITY.md`, `docs/INTERFACES.md`, `docs/SPEC_TRACE.md`, `specs/002-research-layer/spec.md` and `CLAUDE.md`.

## 2. Requirement numbers collide

| Number | On `fix/sync-with-main` (spec 002) | On `feature/judge-fidelity-rules` (spec 003) |
| --- | --- | --- |
| REQ-032 | Research site that feeds the main feed | Canonical text before judging |
| REQ-033 | Source grades, forecasts, buzz vs evidence | Score the arXiv abstract, check paraphrases |
| REQ-034 | Two-model panel, bias masks, advisor | Equivalent wordings and number forms |
| REQ-035 | Rigor badge (on `feature/rigor-badge`) | (spec 003 continues to REQ-040; spec 004 is REQ-041..052) |

Proposed fix (needs John and Matt): keep specs 003 and 004 as numbered, and renumber this line's four to **REQ-053 research site, REQ-054 grades/forecasts/buzz, REQ-055 model panel and advisor, REQ-056 rigor badge** (spec 002, `docs/SPEC_TRACE.md`, `docs/INTERFACES.md`, `modules/project/sync.json` if listed, and commit messages from here on).

## 3. Task 1 for the next agent: combine the two lines

Do this on a new branch `feature/si-combined` from `fix/sync-with-main` (clean history). Do not merge `feature/judge-fidelity-rules` as-is: its history carries assistant authorship.

1. `git merge --squash origin/feature/judge-fidelity-rules` and resolve area by area. Commit each area separately, authored as John, REQ ids first in the message:
   - **Judge (`modules/review/review.js`)**: keep both. Their pre-processing (canonical text, sentence splitting at "et al." and "Fig.", negation, hedged and question claims not counted, look-alike letters in the injection guard, paper-type detection, borderline bands) goes *before* scoring; this line's `CRITERIA`/`VERDICTS` table, reporting rubric for articles, assertion counting, withdrawn verdict, source grade and forecasts stay. `CRITERIA` must stay the table the code uses (`test/review-unit.js` checks it).
   - **Benchmarks**: union of both `bench/review-set.json` item sets; regenerate `bench/baseline.json` only after every metric is at or above both branches' baselines.
   - **Docs**: one `docs/PARITY.md` (theirs has 35 apps on 33 features; add this line's columns for the research layer and today's closed gaps: withdrawn verdict, Brier, code links, open data, where papers disagree); one `docs/INTERFACES.md` and `docs/SPEC_TRACE.md` with both lines' rows; `CLAUDE.md` and `AGENTS.md` keep both pointers (this handoff and `handoff/README.md`, `docs/HUB.md`).
   - **Specs**: renumber as in section 2 once John and Matt agree; until then keep both and mark the collision in each spec's header.
2. Run every check and report exact lines: `npm run preflight`, `npm run bench`, the judge edge cases (in preflight), `node test/review-unit.js`, `node test/sources-unit.js`, `node test/panel-unit.js`, `node --no-warnings test/research-feed.js`, `node --no-warnings test/rigor-badge.js` (after bringing `feature/rigor-badge` in), and the browser test (`PORT=3200 node test/serve-fixtures.js &` then `npm test`). After `npm run preflight`, run `git checkout -- public/js/jr.js` before the browser test: preflight builds the spec version's bundle.
3. `npm run quality` on a watcher database and compare with today's: 5 of 6 label-free checks held (only "judged by the two-model panel" fails until models are set).
4. Push `feature/si-combined` and stop. John and Matt review and merge.

## 4. Waiting on John and Matt

- Approve or drop: spec 002 (REQ-021..031 and this line's four), spec 003 (REQ-032..040), spec 004 (REQ-041..052), contract 0.6, constitution 1.2.0; agree the renumbering in section 2.
- Decide whether `feature/judge-fidelity-rules` is kept as a branch: if so, its history should be rewritten to John's authorship before any pull request (it needs a force-push, which only John can approve).
- Deploy (REQ-019); write `AGENT_LOG.md` entries (REQ-020).
- Set `PANEL_MODELS` (two efficient models from different makers) and `ADVISOR_MODEL` (one bigger model) plus key secrets where the watcher runs; see `.env.example`.
- Check the Lean proofs (spec 003 task T007; Lean could not be installed in the agent workspace).
- Spec 004's four decisions (T000–T002, T080): approval, public Atom feeds, source-label wording, the citation API's free-tier terms.
- Turn off the old daily scheduled agent task if it is still on; run the daily job with Codex using [routines/paper-watch.md](routines/paper-watch.md) once the lines are combined (that file is on `feature/judge-fidelity-rules`).

## 5. Where things are

- This line: [docs/HANDOFF.md](../docs/HANDOFF.md) (state and how to run), [docs/RESEARCH_SITE.md](../docs/RESEARCH_SITE.md), [docs/PRACTICES.md](../docs/PRACTICES.md), [docs/PARITY.md](../docs/PARITY.md), control room `/m/control`.
- The other line (on `feature/judge-fidelity-rules`): `handoff/README.md`, `handoff/STATE.md`, `handoff/prompts/codex.md` and `v0.md`, `docs/HUB.md`, `specs/003-judge-fidelity/`, `specs/004-parity/`.
- The spec write-up for presenting: "Research and Admin Layer: Spec and Proof" (shared doc, this line).

## 6. Known limits

- Two judge edge cases fail on purpose on the other line (moving sentences can make an unbacked claim look partly backed; one piece of evidence can move credibility by 7 points); its borderline band keeps that from flipping a verdict in one step.
- The two-model panel and the advisor are proven only with stand-in models; no model keys were available.
- Judging reads abstracts and paraphrases, so evidence ratings stop at "some support".
