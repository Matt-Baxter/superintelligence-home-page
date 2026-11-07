# State on 2026-11-07

## Branches with agent work (none merged by an agent)

| Branch | What it holds | Status |
| --- | --- | --- |
| `fix/sync-with-main` | The extended build: research layer (002), dossiers (REQ-031), Lab, paper-to-code toys up to the role-play toy (arXiv 2611.07469) | Base for new work; waiting for a human to merge |
| `feature/paper-watch-2026-11-07` | Earlier run today: role-play bounded self-improvement toy | Already folded into `fix/sync-with-main` |
| `feature/paper-watch-2026-11-07-b` | Second run today: MoE expert-attribution toy (arXiv 2611.08089), Lab example `moe-sae-expert-split`, bench metric `papers.moe_contrib_advantage` | Pushed; checks passed (below) |
| `feature/judge-fidelity-spec` | Proposed spec 003 (REQ-032..REQ-040) with tasks T001–T006 done: edge-case catalogue, fidelity set, property tests, Lean 4 model (unchecked), near-cutoff report, all in preflight; project-sync for every spec's proposals and tasks; this handoff folder | Pushed; checks below |

Other remote branches (`feature/snapshot-john-extended-2026-11-07`, `fix/standardize-maps-2026-11-07` and older `feature/*`) were not touched by these runs.

## Today's paper watch (second run)

Papers from 5 Nov 2026, ids checked against their arXiv abstract pages, judged by the Review desk from agent paraphrases:

| Paper | Verdict | Score | Credibility | Topics |
| --- | --- | --- | --- | --- |
| [2611.08438](https://arxiv.org/abs/2611.08438) Understanding AI from the Inside (mechanistic interpretability survey) | minor | 17 | 60 | safety, interpretability, evals |
| [2611.08089](https://arxiv.org/abs/2611.08089) SAE Interprets MoE | minor | 12 | 55 | interpretability |
| [2611.07756](https://arxiv.org/abs/2611.07756) Scaling Laws for SAE Training Data | minor | 12 | 50 | interpretability, scaling |

[2611.04035](https://arxiv.org/abs/2611.04035) (Recursa, 2 Nov) was outside the two-day window. Queued for paper-to-code: 2611.08089 (built), 2611.07756 (not built).

**Toy built**: `moe-sae-attribution` (`modules/lab/papers.js`). An idealised SAE reads a Mixture-of-Experts layer's output; each latent's pre-activation splits exactly into per-expert pieces. At toy scale, crediting by contribution named the owning expert for every latent against about 0.71 by gate weight. Our hypothesis (a noisier encoder cuts that accuracy by at least 0.1) was **not supported** (1.0 to 0.98) and is kept as refuted.

**Dossiers** (drafts only, nothing posted): Interpretability, thin, 8 references; Safety & risk, thin, 4 references. Both: "reviewed papers, none both primary and credible (credibility 60 or more)".

**Checks on `feature/paper-watch-2026-11-07-b`**: papers unit 17 passed, 0 failed; bench 24 metrics, 0 uplift, 0 regressions; `SITE_PROFILE=extended npm run build` done; `Preflight passed.`; browser test 182 passed, 0 failed, page errors none.

## What we learned about the judges

- The judges are deterministic (pure functions, no model calls). The input isn't: the watcher scores the agent's paraphrase, and rewording the same facts moved one paper's credibility from 55 to 63, across the dossier's cutoff of 60. Two of the three papers watched today sit within 5 points of 60 (`npm run judge:report -- --from out/watch/2026-11-07.json`).
- **Edge-case catalogue** (`bench/judge-edge-cases.json`, 62 synthetic cases): 16 pass, 46 known gaps. Among them: passive voice, synonyms, number words, "percentage points", "95% CI" and "p = 0.03" lose credit; negated markers ("without a baseline", "never fails on", "not unseen") earn it; hedged, negated and question claims count as claims; only the first 12 claims count; abbreviations ("et al.", "Fig.", "e.g.") split sentences and cut claims off from their evidence, while a semicolon lets a claim borrow numbers; "Massive" in a benchmark name is hype; "X: A Survey" isn't a survey; zero-width characters slip past the injection guard while papers that mention "system prompt" or describe prompt injection get capped; the 20,000-character cut is silent.
- **Fidelity set** (`bench/fidelity-cases.json`, 51 synthetic paraphrases of 5 sources): today's judge gives 24 of 26 unfaithful paraphrases the same credibility as their source, moves 13 of 25 faithful rewordings by 5–11 points, and scores a "percentage points" to "%" change higher.
- **Property tests** (`test/judge-properties.js`, in preflight on 300 generated texts): bounds, caps, the injection cap, determinism, no double counting, rigor monotonicity, the one-flip rigor bound and the dossier rating rule hold. Three fail by design today: survey detection depends on which sentence comes first, so shuffling or repeating a sentence first can change rigor; and one marker change can move credibility far more than 7 when it also unbacks a claim (52 to 15 in the smallest case).
- **Lean 4 model** (`proofs/`): 40+ theorems on the arithmetic (bounds, caps, monotonicity, the one-flip bound with hype fixed, bands, the rating rule), with no `sorry` but **not yet checked by Lean** (installing Lean needs a person, task T007). `test/judge-lean-vectors.js` checks the model's formulas equal review.js on 22,562 cases.
- Spec 003 proposes the fixes; tasks T010–T061 in `specs/003-judge-fidelity/tasks.md` are the backlog, each naming the catalogue cases it should flip.

## Waiting for the humans

1. **Approve, change or drop** REQ-021..REQ-031 (spec 002) and REQ-032..REQ-040 (spec 003). Until then they are extended-version only.
2. **CONTRACT.md names the platforms** ("Matt: Claude Code", "John: v0"). Matt stays on Claude Code. If John also uses Codex, add it to his line ("John: v0 or Codex") with a change-log row; both partners agree, and agents don't edit it.
3. **Bake-off branches**: Matt's Claude Code build on `bakeoff/claude-matt`, John's v0 or Codex build on `bakeoff/v0-john` (Codex works on that same branch, or one the humans name). Keep the two builds apart until both are submitted (bakeoff-entry skill).
4. **The daily paper watch** stays on its Claude scheduled task (5:47 AM Central) for now. If Codex or the GitHub Actions workflow takes it over later, turn the Claude task off first so two agents don't push watch branches on the same day.
5. **Merge `fix/sync-with-main`** when ready, then the feature branches above; the GitHub Actions paper watch only runs from the default branch.
6. **Agent log**: write entries in your own words for anything the agents got wrong (REQ-020). Agents never write them.
