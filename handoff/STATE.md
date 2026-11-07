# State on 2026-11-07

## Branches with agent work (none merged by an agent)

| Branch | What it holds | Status |
| --- | --- | --- |
| `fix/sync-with-main` | The extended build: research layer (002), dossiers (REQ-031), Lab, paper-to-code toys up to the role-play toy (arXiv 2611.07469) | Base for new work; waiting for a human to merge |
| `feature/paper-watch-2026-11-07` | Earlier run today: role-play bounded self-improvement toy | Already folded into `fix/sync-with-main` |
| `feature/paper-watch-2026-11-07-b` | Second run today: MoE expert-attribution toy (arXiv 2611.08089), Lab example `moe-sae-expert-split`, bench metric `papers.moe_contrib_advantage` | Pushed; checks passed (below) |
| `feature/judge-fidelity-spec` | Proposed spec 003 (REQ-032..REQ-040), the judge edge-case catalogue and runner in preflight, project-sync for every spec's proposals and tasks, and this handoff folder | Pushed with this handoff |

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

- The judges are deterministic (pure functions, no model calls). The input isn't: the watcher scores the agent's paraphrase, and rewording the same facts moved one paper's credibility from 55 to 63, across the dossier's cutoff of 60.
- The edge-case catalogue (`bench/judge-edge-cases.json`, 35 synthetic cases) shows 27 known gaps in today's rules: passive voice and synonyms lose credit; number words, "percentage points", "95% CI" and "p = 0.03" aren't numbers or uncertainty; negated markers ("we do not compare with a baseline") still earn credit; "Massive" in a benchmark name counts as hype; "X: A Survey" titles aren't detected as surveys; zero-width characters slip past the injection guard while a paper describing prompt injection gets capped; the 20,000-character cut is silent; one marker change can move credibility by 7.
- Spec 003 proposes the fix: canonicalise the input, score the source abstract and check paraphrases separately, cover wordings and negation, report bands with a margin, and state the rules' properties as property tests and Lean 4 theorems. `specs/003-judge-fidelity/research.md` has the sources.

## Waiting for the humans

1. **Approve, change or drop** REQ-021..REQ-031 (spec 002) and REQ-032..REQ-040 (spec 003). Until then they are extended-version only.
2. **CONTRACT.md names the platforms** ("Matt: Claude Code", "John: v0"). Moving Matt's side to Codex changes the contract: both partners agree, then add a change-log row. Agents don't edit it.
3. **Branch names for the bake-off**: `bakeoff/claude-matt` is in the docs; decide whether Codex keeps it or uses a new one (for example `bakeoff/codex-matt`), and keep the two builds apart until both are submitted (bakeoff-entry skill).
4. **The Claude scheduled task** that ran the daily paper watch (5:47 AM Central) is still on. Turn it off in the Claude app when Codex or the GitHub Actions workflow takes over, so two agents don't push watch branches on the same day.
5. **Merge `fix/sync-with-main`** when ready, then the feature branches above; the GitHub Actions paper watch only runs from the default branch.
6. **Agent log**: write entries in your own words for anything the agents got wrong (REQ-020). Agents never write them.
