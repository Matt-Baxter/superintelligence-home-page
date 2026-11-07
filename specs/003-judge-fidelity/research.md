# Research: judge fidelity and stability

Summary of a 2026-11-07 literature survey behind `spec.md`. Works are named by title, dataset or tool, with links; no claims are attributed to people. Numbers are as reported by each work, and the design choices drawn from them are ours and untested until the tasks in `tasks.md` measure them.

## What the sources say

| Finding | Source | What it means here |
| --- | --- | --- |
| Hedge-cue detectors built from rules and lexicons came within a few F1 points of the best learned systems on biomedical text, and all systems did much worse on Wikipedia text. | [CoNLL-2010 shared task overview](https://preview.aclanthology.org/fix_video/W10-3001.pdf) | A rule-based hedge and negation layer (REQ-035) is a reasonable deterministic choice; expect it to be weaker on informal text such as comments. |
| Taking an abstract's last sentence as its main claim was a strong baseline; a published rule system did much worse; the best neural model was better than both. | [Claim extraction in biomedical abstracts](https://ar5iv.labs.arxiv.org/html/1907.00962) | Position is a cheap, deterministic claim cue; regex claim detection alone is weak. |
| Sentence-role classifiers are clearly less accurate on computer-science abstracts than on medical ones. | [CSAbstruct / sequential sentence classification](https://ar5iv.labs.arxiv.org/html/1909.04054) | Expect rough sentence roles on arXiv; show them as hints, not facts. |
| Entity overlap alone was close to chance as a factual-consistency check; NLI-based checks did better. | [SummaC](https://arxiv.org/pdf/2111.09525) | Entity matching is a guard in the fidelity check (REQ-033), not the whole check. |
| Most attribution-checker errors were about fine details: numbers, dates and names. | [AttributionBench](https://arxiv.org/pdf/2402.15089) | A careful number and unit normaliser is the most valuable deterministic fidelity check. |
| Small fact-checking models can match much larger judges at a fraction of the cost. | [MiniCheck](https://arxiv.org/html/2404.10774v2), [AlignScore](https://arxiv.org/pdf/2305.16739) | An optional local checker is feasible; CPU speed is unmeasured. |
| Such checkers tend to reject faithful claims that are heavily paraphrased and accept unfaithful ones that copy the source's wording. | [arXiv 2501.14883](https://arxiv.org/html/2501.14883v2) | Don't score paraphrases with a neural checker: score the source (REQ-033). |
| Rewording an LLM judge's instructions moved its verdicts, and collapsing a 5-point scale to binary removed most of that effect. | [JudgeSense](https://arxiv.org/pdf/2604.23478) | Coarser outputs (bands, REQ-037) are more stable. |
| Invariance and directional tests find failures that accuracy scores hide. | [CheckList](https://aclanthology.org/2020.acl-main.442) | The edge-case catalogue uses the same idea: pairs that must score the same, and pairs that must move one way. |
| Automated scorers can be over-stable: scores barely moved when much of an essay was replaced with off-topic text. | [Automated essay scoring robustness](https://arxiv.org/abs/2007.06796) | Test that real changes move the score as well as that rewordings don't. |
| A small executable Lean model with proofs, plus millions of differential tests against the production code, found bugs in both the design and the implementation. | [Cedar, arXiv 2407.01688](https://arxiv.org/html/2407.01688v1) | The template for REQ-038: prove properties of a Lean model of the rules; test the JavaScript against it. |
| Bridging-based ranking needs a minimum number of ratings per item and per rater, and uses hysteresis so status doesn't flicker. | [Community Notes algorithm documentation](https://docsearch.algolia.com/mcp/docs/repo/twitter/communitynotes) | REQ-040's minimums; the algorithm is reused, never the X rating data. |
| Comment length alone predicted constructiveness very well. | [Constructive Comments Corpus (C3)](https://arxiv.org/pdf/2004.05476.pdf) | Length is the easiest thing to game, so its credit is capped (REQ-040). |
| Zero-shot stance detection on news comments reaches only modest accuracy, and annotators agree only moderately. | [VAST](https://arxiv.org/pdf/2010.03640) | Show stance as "leans", with the cue words. |
| Review aspects (soundness, clarity, originality and others) can be tagged with good precision; annotators agree moderately. | [ASAP-Review](https://arxiv.org/pdf/2102.00176) | REQ-039's aspect set. |
| Two independent committees reviewing the same submissions disagreed on many decisions. | [NeurIPS 2021 consistency experiment](https://arxiv.org/abs/2306.03262v1) | Review scores are weak signals: show mean, spread and count. |
| LLM use in reviews can be estimated for a whole venue but not for one review. | [arXiv 2403.07183](https://arxiv.org/html/2403.07183v2) | No per-review "AI" labels. |
| arXiv metadata, including abstracts, is CC0; the API asks for one request every 3 seconds. | [arXiv API terms of use](https://info.arxiv.org/help/api/tou.html) | Abstracts can be read at judging time; REQ-007 still limits storage. |
| OpenReview releases reviews and comments under CC BY 4.0. | [OpenReview terms](https://openreview.net/legal/terms) | Reviews can be shown with attribution and a link (REQ-039). |

## What no source covers

Rule-only sentence roles on CS abstracts; rule-based review aspect tagging; overclaiming in AI papers specifically; telling surveys, position papers and empirical papers apart; CPU speed of the small checkers; bridging-style ranking with only tens of raters; any use of proof assistants on text-scoring rules. Each is a measurement task in `tasks.md`, on synthetic data.
