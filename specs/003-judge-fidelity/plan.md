# Implementation Plan: Judge fidelity and stability

**Spec**: [spec.md](spec.md) (REQ-032..REQ-040, proposed) · **Research**: [research.md](research.md) · **Tasks**: [tasks.md](tasks.md) · **Edge cases**: [`bench/judge-edge-cases.json`](../../bench/judge-edge-cases.json), run by `node test/judge-edge-cases.js`

## Where it lives today

| Stage | Code now | What changes |
| --- | --- | --- |
| Admit | `scripts/watch.js` (dedupe by arXiv id, Twitter/X refused), `modules/review/review.js` `review()` (title cut to 300, text to 20,000 characters, silently) | Keep the arXiv id and version; report the cut (REQ-032). |
| Canonicalise | none: `review()` trims the ends only; `qid = doc:<sha1(title + text)>` of the raw text | New `canonical(text)`: NFKC, remove zero-width and format characters, collapse whitespace, rewrite `$4\%$`, `\times`, `\pm`; a confusables map used by the guards; `qid` from canonical text (REQ-032). |
| Segment | `sentences()` splits at `.!?` followed by a capital or digit | Protect `e.g.`, `i.e.`, `et al.`, `Fig.`, `approx.`, decimals (REQ-032, unit tests). |
| Clean | `clean()`: drops repeats, keyword lists (> 60% tag terms) and checklist sentences | Keep, but don't drop a sentence that has a verb and makes a statement (catalogue case `clean-title-like-sentence`). |
| Kind | `detectKind()`, `SURVEY` regex on title + first sentence | Title forms "X: A Survey", "A Review of X", "Survey of X"; position, dataset/benchmark, negative-result kinds (REQ-036). |
| Markers | `MARKERS` (8 regexes, 10–14 points, presence counted once) | Equivalent wordings and number forms from the catalogue; a negation window (`not`, `no`, `without`, `never`, `neither`, `fail to`) so negated markers earn nothing (REQ-034, REQ-035). |
| Claims | `CLAIM` regex; backed = 2+ markers in the same sentence, one quantitative | Keep; add the last-sentence position cue as a claim hint; negated claims are not claims (REQ-035). |
| Hype | `HYPE` words, unbacked share × 60 + words × 10 | Skip hype words inside a negation or inside a capitalised name (REQ-035). |
| Guards | `INJECTION` regex on raw text | Run on canonical text with confusables mapped; more wordings of addressing the judge; a "describes attacks" exception (reported, not capped) (REQ-035). |
| Fidelity | none: the watcher scores the agent's paraphrase | New `fidelity(source, paraphrase)`: numbers and units, entities, hedges, negation, claim count; scores come from the source (REQ-033). |
| Score | `score = min(sig − removed, 35 + 0.65 × rigor)`, `credibility = round(0.5 × rigor + 0.5 × (100 − hype))` | Same arithmetic, moved into `lib/rules/review.json` (si-expr) so Lean can model it (REQ-038). |
| Band | `verdict` uses hard cutoffs 35 / 40 / 55 / 60 / 70; dossier `credible = credibility ≥ 60` | `band(S, T, m)`; Border shown; dossier counts High only (REQ-037). |
| Peer reviews, comments | none / comments stored but not judged | REQ-039, REQ-040, after the paper path is stable. |

## The logic, stated so it can be tested and proved

1. **Canonicalise** `c = canon(x)`. Properties: `canon(canon(x)) = canon(x)` (idempotent); `canon` removes no letters or digits other than format characters; `qid` depends only on `c`.
2. **Markers** `F(c) ⊆ Families` (a set, so each family counts once). Rigor `R = Σ_{f ∈ F} w_f`, with `w_f ∈ ℕ`, `Σ w_f = 100`. Properties: `0 ≤ R ≤ 100`; `F ⊆ F' ⇒ R ≤ R'` (monotone); a negated mention adds nothing: `F(c + " not " + m) = F(c)`.
3. **Hype** `H = min(100, round(60 × u/k) + min(40, 10 × |W|))` with `u ≤ k` unbacked of `k` claims (0 when `k = 0` or a survey) and `W` a set of hype words. Properties: `0 ≤ H ≤ 100`; repeating a hype word doesn't raise `H`.
4. **Credibility** `C = round((R + 100 − H) / 2)`. Properties: `0 ≤ C ≤ 100`; one family flip changes `C` by at most `⌈max w_f / 2⌉`.
5. **Guarded score** `S = max(0, round(min(B, 35 + 0.65 R, inj ? 30 : 100)))`. Properties: `S ≤ 35 + 0.65 R`; `inj ⇒ S ≤ 30`.
6. **Bands** for cutoff `T` and margin `m`: Low if `C < T − m`, Border if `T − m ≤ C < T + m`, High if `C ≥ T + m`. Properties: exactly one band; with `2m ≥ ⌈max w_f / 2⌉`, one family flip moves at most one band. Today's largest weight is 14, so one flip moves `C` by up to 7 and `m` must be at least 4; the plan uses `m = 5` and caps any single weight at 10 or raises `m` (task T012).
7. **Rating** (dossier): `some support` if `|High primary| ≥ 2` and `linked ≥ 1`; `early` if `|High primary| ≥ 1`; `thin` if any paper; else `none yet`. Properties: the four cases are exclusive and exhaustive; adding a High paper never lowers the rating; once there is at least one paper, a Border paper never raises it (the first paper of any kind lifts "none yet" to "thin", by design).

Each property is a property test in `test/judge-properties.js` first, and a Lean 4 theorem in `proofs/` second (REQ-038). The Lean model covers steps 2–7 (arithmetic on sets and naturals); steps 1–2's text matching stays covered by the edge-case catalogue.

## Order

1. Measure first (done for the catalogue): `bench/judge-edge-cases.json`, `test/judge-edge-cases.js` in preflight, gaps reported.
2. Canonicalise and report truncation (REQ-032). No score changes on clean inputs.
3. Score the source, check the paraphrase (REQ-033). The watcher keeps the paraphrase for display only.
4. Wordings and negation (REQ-034, REQ-035), one family at a time, each flipping catalogue gaps to `ok`.
5. Kind detection (REQ-036).
6. Bands (REQ-037), then property tests, then the Lean model (REQ-038).
7. Peer reviews and comments (REQ-039, REQ-040).

Steps 2–6 change scoring rules. They need a person to ask for them, and each change is measured by `npm run bench` (REQ-029) and the catalogue before it is pushed.

## Constraints

Free tiers only; no paid model calls; deterministic; synthetic, labelled test data; no Twitter/X; no claims attributed to people; abstracts read at judging time, only a hash and a 400-character excerpt stored (REQ-007).
