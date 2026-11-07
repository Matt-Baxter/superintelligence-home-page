# State on 2026-11-07

## Branches with agent work (none merged by an agent)

| Branch | What it holds | Status |
| --- | --- | --- |
| `fix/sync-with-main` | The extended build: research layer (002), dossiers (REQ-031), Lab, paper-to-code toys up to the role-play toy (arXiv 2611.07469) | Base for new work; waiting for a human to merge |
| `feature/paper-watch-2026-11-07` | Earlier run today: role-play bounded self-improvement toy | Already folded into `fix/sync-with-main` |
| `feature/paper-watch-2026-11-07-b` | Second run today: MoE expert-attribution toy (arXiv 2611.08089), Lab example `moe-sae-expert-split`, bench metric `papers.moe_contrib_advantage` | Pushed; also merged into `feature/judge-fidelity-rules` |
| `feature/judge-fidelity-spec` | Proposed spec 003 (REQ-032..REQ-040) with tasks T001–T006 done: edge-case catalogue, fidelity set, property tests, Lean 4 model (unchecked), near-cutoff report, all in preflight; project-sync for every spec's proposals and tasks; this handoff folder | Pushed; checks below |
| `feature/judge-fidelity-rules` | **Newest; contains `feature/judge-fidelity-spec` and the MoE toy branch, so it is the one branch to review.** Spec 003's scoring rules built (T008, T010–T012, T020, T021, T030–T036, T040–T042): canonical input, truncation reported, abbreviation-safe sentences, equivalent wordings and negation, injection guard on look-alike letters, hedged/negated/question claims, survey and paper-kind detection, the paraphrase fidelity check (52 of 52 labelled pairs), the watcher scoring the abstract, bands with a margin of 5 on the Review desk, digest and dossier. Also the generated hub (`docs/HUB.md`, `npm run hub`), the Specs view in the Project page (`/m/project#/specs`), the market survey (`docs/PARITY.md`, 35 apps × 33 features) and proposed spec 004 (REQ-041..REQ-052) | Pushed; checks below |

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

- The judges are deterministic, but they used to score the agent's paraphrase: rewording the same facts moved one paper's credibility from 55 to 63, across the dossier's cutoff of 60. On `feature/judge-fidelity-rules` the watcher scores the arXiv abstract when it is given (`abstract` field) and only checks the paraphrase, which is shown only if it passes `modules/review/fidelity.js`.
- **Edge-case catalogue** (`bench/judge-edge-cases.json`, 74 synthetic cases): 72 pass, 2 known gaps (was 22 and 47 before the rules work). The two left: a reorder that puts an unbacked claim next to evidence makes it "partly backed"; and one marker can still move credibility by 7, which the band margin of 5 (2m ≥ 7) absorbs.
- **Fidelity**: 52 of 52 labelled paraphrases judged right (fitted to that set; heavier rewordings outside its synonym list may wrongly fail). Faithful rewordings that moved the old judge's credibility: 13 of 25 before, 3 of 25 after.
- **Property tests**: 9 hold, 2 known gaps (a repeated or reordered sentence can back a neighbouring claim; one marker change that also unbacks a claim moves credibility more than 7).
- **Lean 4 model** (`proofs/`): 40+ theorems, no `sorry`, **not yet checked by Lean** (installing Lean needs a person, task T007). The vectors test checks the model's formulas equal the code on 25,088 cases.
- **Bands**: credibility and score are reported as Low / Border / High around each cutoff (margin 5); the verdict text is unchanged, with a borderline note; the dossier counts only High papers (65+) as credible and only toy checks of credible papers as linked.

## Market parity

`docs/PARITY.md` compares 35 apps (aggregators, paper feeds, research tools, readers, forecasting and safety sites; open-source ones with their licences) on 33 features, with our column checked against the code: 12 have, 20 partial, 1 missing (personalisation). The top gaps are proposed as spec 004 (REQ-041..REQ-052): an explained "For you" feed, full-text search, mute filters, Atom feeds out and "since last visit", a coverage panel per story group, code links on papers, source-type labels, a public rules change log, reader data export, vote hygiene, an installable offline saved list, and a citation neighbourhood from a free API. It's a public-features survey: no decompiling, no scraping behind logins, no copied text.

## Waiting for the humans

1. **Approve, change or drop** REQ-021..REQ-031 (spec 002), REQ-032..REQ-040 (spec 003, now built on `feature/judge-fidelity-rules`) and REQ-041..REQ-052 (spec 004, the parity gaps, not built). Until then they are extended-version only. The Specs view (`/m/project#/specs`) lists every REQ with its status, trace and open tasks.
2. **CONTRACT.md names the platforms** ("Matt: Claude Code", "John: v0"). Matt stays on Claude Code. If John also uses Codex, add it to his line ("John: v0 or Codex") with a change-log row; both partners agree, and agents don't edit it.
3. **Bake-off branches**: Matt's Claude Code build on `bakeoff/claude-matt`, John's v0 or Codex build on `bakeoff/v0-john` (Codex works on that same branch, or one the humans name). Keep the two builds apart until both are submitted (bakeoff-entry skill).
4. **The daily paper watch** stays on its Claude scheduled task (5:47 AM Central) for now. If Codex or the GitHub Actions workflow takes it over later, turn the Claude task off first so two agents don't push watch branches on the same day.
5. **Merge `fix/sync-with-main`** when ready, then the feature branches above; the GitHub Actions paper watch only runs from the default branch.
6. **Agent log**: write entries in your own words for anything the agents got wrong (REQ-020). Agents never write them.
