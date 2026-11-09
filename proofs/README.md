# proofs/: a Lean 4 model of the review judge's arithmetic

REQ-038, task T005 (specs/003-judge-fidelity/tasks.md); T051 fills in the evaluator and the differential test.
Plain core Lean 4, no Mathlib and no other dependencies.

**Status (2026-11-09): all58 judge theorems checked with pinned Lean4.15.0.**
The theorem audit reports only standard `propext`, `Classical.choice` and `Quot.sound`; no `sorryAx` or custom axioms.
Three Learn toy proofs are checked separately by the same audit. Two Learn statements remain incomplete (Mathlib/attention definitions), and are not counted as proofs.

## How to check

Use an installed Lean/elan toolchain approved for this machine, then run:

```bash
cd proofs && lake build
cd .. && npm run test:proofs
```

The checker also accepts `LAKE=/absolute/path/to/lake`. `lean-toolchain` pins `leanprover/lean4:v4.15.0`; the checker verifies that version. No Mathlib or third-party proof package is needed. Lake caches go to gitignored `proofs/.lake/`. The dependency-free Lake manifest is committed for reproducibility.

`test/judge-differential.js` first validates the current production-derived vectors, builds Judge, compiles all claimed-proved Learn toys, and checks every theorem's transitive axiom footprint. It then executes the actual Lean evaluator on the vector inputs and compares rigor, hype, credibility, cap, score, bands and dossier ratings with the JavaScript expectations. Missing Lean, a compiler error, an unapproved axiom or a mismatched result fails the command; none is silently skipped.

This establishes machine-checked arithmetic properties plus bounded executable correspondence. It does not formally verify JavaScript execution, IEEE arithmetic, text extraction, entity resolution, database persistence, model quality or the whole application. Those need separate local tests and human review.

## What is modelled

Plan steps 3 to 7 of `specs/003-judge-fidelity/plan.md`, plus the rigor sum of step 2. Only the arithmetic: which
marker families are present, how many claims are unbacked, how many distinct hype words appear and whether an
injection was found are **inputs**.

| Judge.lean | Code | What it is |
| --- | --- | --- |
| `Family`, `weight` | review.js lines 37-46, `MARKERS` (`points`) | 8 families: numbers 10, baseline 14, method 12, sample 12, uncertainty 14, held-out 14, limitations 14, artifacts 10 |
| `Presence`, `pts`, `rigor` | review.js lines 81-87, `rigor()` | a family counts once, at its weight, if any sentence shows it (the `found` map) |
| `jsRound a b = (2a + b) / (2b)` | `Math.round` | round(a/b) for naturals. `Math.round(x) = floor(x + 1/2)`, and for x = a/b ≥ 0 that is `floor((2a + b) / 2b)`. Exact on rationals; the JS computes in floating point, which the vectors test checks |
| `claimsPart`, `hype u k w` | review.js lines 108-114, `hype()` | `min(100, round(60u/k) + min(40, 10w))`, claims term 0 when k = 0. The code rounds the whole sum; since `min(40, 10w)` is an integer the two agree. A survey drops the claims term: pass k = 0 |
| `credibility r h` | review.js line 197 | `round(0.5R + 0.5(100 - H)) = jsRound (R + (100 - H)) 2` |
| `cap r` | review.js line 193 | `round(35 + 0.65R) = jsRound (3500 + 65R) 100 = (7100 + 130R) / 200`. In doubles `0.65*R` is inexact for some R (e.g. R = 26 gives 51.900000000000006), but the exact halves (R = 10, 30, 50, 70, 90: 41.5, 54.5, 67.5, 80.5, 93.5) come out exact, and no inexact value is near a half, so the float code equals the model on R 0..100 (checked in node) |
| `guarded b r inj` | review.js lines 189-196 | `min(b, cap)`, then `min(·, 30)` if injection. `b` is the base clamped at 0: the code applies `max(0, ·)` last, which gives the same number because cap ≥ 0 |
| `band T m c` | modules/review/bands.js, `band(score, T, m)` (REQ-037, T041; m = 5) | Low `c < T - m`, Border `T - m ≤ c < T + m`, High `c ≥ T + m`. Natural subtraction: if m > T nothing is Low, same as with integers since c ≥ 0 |
| `rating c l n` | dossier.js line 75, `const strength =` | `some support` if c ≥ 2 and l ≥ 1; `early` if c ≥ 1; `thin` if n > 0; else `none yet`. c = credible primary (non-survey) papers, those in the High band around 60 (`band(credibility, 60, 5) = high`, credibility ≥ 65; T041); l = held-up toy checks whose source is a credible paper (`tests === "credible"`, T042); n = `P.length`, every reviewed non-comment document including surveys |

## Theorems

Status of **every** row: **checked Lean4.15.0.** None uses `sorry`. "Risk" is a guess at how likely the
proof needs fixing on the first `lake build` (low: plain `omega`/`decide`/term proof on a small goal; medium: depends
on tactic or reduction behaviour that has changed between Lean versions; high: none currently). A wrong *statement*
would show up as a proof that cannot be repaired; the statements were checked against the code by hand and by
`node test/judge-lean-vectors.js`.

| Theorem | Statement | Plan step | Status | Risk |
| --- | --- | --- | --- | --- |
| `weights_sum` | the 8 weights sum to 100 (`decide`) | 2 | checked Lean4.15.0 | low |
| `weight_le_14` | every weight ≤ 14 | 2, 4 | checked Lean4.15.0 | low |
| `pts_of_true`, `pts_of_false`, `pts_le`, `pts_congr`, `pts_mono`, `pts_off` | one family's points: its weight or 0 | 2 | checked Lean4.15.0 | low |
| `rigor_all`, `rigor_none` | all families give 100, none give 0 (`decide`) | 2 | checked Lean4.15.0 | low |
| `rigor_mono` | p ≤ q pointwise ⇒ rigor p ≤ rigor q | 2 | checked Lean4.15.0 | low |
| `rigor_le_100` | rigor p ≤ 100 | 2 | checked Lean4.15.0 | low |
| `rigor_flip` | p, q differ only at f ⇒ \|rigor p − rigor q\| ≤ weight f (8 explicit cases, 7 `pts_off` facts each, then `omega`) | 2 | checked Lean4.15.0 | medium |
| `jsRound_two` | `jsRound a 2 = (a+1)/2` (`show` to turn `2*2` into `4`, with a `simp only` fallback) | – | checked Lean4.15.0 | low |
| `jsRound_mul_le`, `jsRound_lt_succ` | `jsRound a b · 2b ≤ 2a + b < (jsRound a b + 1) · 2b` for b > 0: together they say jsRound a b = ⌊a/b + 1/2⌋ | – | checked Lean4.15.0 | low / medium (`jsRound_lt_succ` relies on `omega` treating the product `2 * b * q` as one atom after a `rw` into that exact shape) |
| `hype_le_100`, `hype_no_claims` | H ≤ 100; with k = 0 (or a survey) only hype words count | 3 | checked Lean4.15.0 | low |
| `credibility_eq`, `credibility_le_100`, `credibility_rigor_le_100` | C = (R + 100 − H + 1)/2; C ≤ 100 when R ≤ 100 | 4 | checked Lean4.15.0 | low |
| `credibility_flip_weight` | one flip, **hype held fixed**: \|ΔC\| ≤ ⌈w_f / 2⌉ | 4 | checked Lean4.15.0 | low |
| `credibility_flip_7` | the same with today's weights: \|ΔC\| ≤ 7 | 4 | checked Lean4.15.0 | low |
| `cap_eq`, `cap_ge_35`, `cap_le_100` | cap = (7100 + 130R)/200; 35 ≤ cap; cap ≤ 100 when R ≤ 100 | 5 | checked Lean4.15.0 | low |
| `guarded_le_cap`, `guarded_le_base`, `guarded_inj_le_30`, `guarded_le_100`, `guarded_le_100_of` | S ≤ cap; S ≤ base; inj ⇒ S ≤ 30; S ≤ 100 (for a family-sum R, and for any R ≤ 100, which covers survey coverage) | 5 | checked Lean4.15.0 | low |
| `band_low`, `band_border`, `band_high`, `band_eq_low_iff`, `band_eq_border_iff`, `band_eq_high_iff` | each band holds exactly on its half-open interval | 6 | checked Lean4.15.0 | low |
| `band_exhaustive`, `band_exclusive_low_high` | at least one band / not both Low and High. True of *any* function into a 3-constructor type, so they say nothing about the thresholds; the iffs carry the content | 6 | checked Lean4.15.0 | low |
| `flip_low_not_high`, `flip_high_not_low` | 2m ≥ 7, **hype held fixed**: one flip never moves Low ↔ High | 6 | checked Lean4.15.0 | low |
| `rigor_allButUncertainty`, `hype_7_12_4`, `margin_3_can_jump` | the bound is sharp: T = 60, m = 3, hype 75 (u 7 of k 12, w 4), dropping uncertainty takes C from 63 (High) to 56 (Low) (`decide`, which must evaluate `Nat.div` on literals) | 6 | checked Lean4.15.0 | medium |
| `rating_some`/`early`/`thin`/`none`, `rating_eq_*_iff` | the four cases, as conditions, are exhaustive and pairwise exclusive | 7 | checked Lean4.15.0 | low |
| `rating_exhaustive` | one of the four (true of any function into `Rating`; the iffs carry the content) | 7 | checked Lean4.15.0 | low |
| `rating_mono` | more credible papers, linked checks or papers never lower the rating (`repeat' split`, then `decide` or `omega` on each of 16 leaves) | 7 | checked Lean4.15.0 | medium |
| `rating_add_credible` | adding a credible paper never lowers it | 7 | checked Lean4.15.0 | low |
| `rating_add_noncredible` | with at least one paper and **linked held fixed**, a non-credible (Border) paper changes nothing. Since T042 a non-credible paper can't change `linked` in dossier.js, so this is the code's behaviour, not only the model's | 7 | checked Lean4.15.0 | low |
| `first_noncredible_paper_raises` | but the first one lifts `none yet` to `thin` (`decide`) | 7 | checked Lean4.15.0 | low |
| `noncredible_paper_with_check_raises` | in the model, raising l from 0 to 1 while adding a non-credible paper lifts `early` to `some support` (`decide`). Before T042 dossier.js did that for a Border paper a held-up check cited; now such a check doesn't count toward l, so the case can't arise in the code (gap 9, closed) | 7 | checked Lean4.15.0 | low |

Historical pre-build risk estimate: 0 high, 4 medium (`rigor_flip`, `jsRound_lt_succ`, the `margin_3_can_jump` group, `rating_mono`), the rest
low. `lakefile.lean` (an empty `lean_lib Judge where`, as `lake init` writes) is low risk.

When upgrading Lean, revisit the previously identified tactic-sensitive proofs:
`rating_mono` (`repeat' split` and the shape of the 16 leaves), `jsRound_lt_succ` (`omega` and a nonlinear atom),
the `decide` proofs that evaluate `Nat.div` (`hype_7_12_4`, `margin_3_can_jump`; `margin_3_can_jump` falls back to
rewriting with the two helper facts), and the `show` steps in `jsRound_two` and `cap_eq` (each has a `simp only`
fallback). An earlier draft of `rigor_flip` used `try have … (by decide)` to skip the flipped family; that was
replaced by explicit cases because a failing nested `by decide` can be logged as an error instead of being caught
by `try`.

## Gaps between model and code

These are things the theorems do **not** say about today's code.

1. **Hype is held fixed in the flip theorems.** In review.js a marker sentence can also back a claim (a claim is
   "partly backed" if a neighbouring sentence carries markers), so removing one family can also change u and so H.
   T004 found removing one uncertainty sentence move credibility 52 → 15 (hype 10 → 70). The ±7 bound and
   "never Low ↔ High" are theorems about `credibility (rigor p) hv` for a fixed `hv`, not about `review()`.
2. **The text layer is not modelled**: the marker regexes, sentence splitting (`sentences()` splits after "et al.",
   "Fig.", "e.g."; semicolons don't split), the cleaning step that drops repeats, keyword lists and checklist
   sentences, negation, and claim detection. These are covered by `bench/judge-edge-cases.json`, not by proofs.
3. **Sentence order.** The survey rule reads the title and the first sentence only (review.js line 143), so
   reordering sentences can change rigor for a survey (T004: 40 → 10). The model's rigor is order-free.
4. **Survey rigor is a different sum.** For a survey, review.js replaces R by the coverage score (lines 145-146,
   weights 35 + 25 + 20 + 20 = 100) when that is larger. The model covers it only in the sense that the credibility,
   cap and guarded theorems hold for any R ≤ 100; `rigor_flip` and `rigor_mono` say nothing about coverage.
5. **Claims are capped at 12** (`claims()` returns `out.slice(0, 12)`, line 97). The model takes any u ≤ k; claims
   past the twelfth are invisible to the code, so "one more unbacked claim raises hype" is false there.
6. **Hype words are a count of distinct words** (`new Set`, line 109): w is the input, so "repeating a hype word
   doesn't raise H" is true by construction in the code and not a theorem here.
7. **Bands and the verdict.** `band` is modules/review/bands.js (T041). The `verdict` string in review.js still uses
   fixed cutoffs 35, 60, 70 (credibility) and 40, 55 (score) with `>=`; Border is reported beside it (`bands`,
   `borderline`, `verdictNote`), not folded into it. The dossier's credible test uses the band (High only).
8. **Floating point.** The model is exact rational rounding. `test/judge-lean-vectors.js` checks the float code
   equals it on every R 0..100, H 0..100, u ≤ k ≤ 50 and w 0..6, and finds no difference, but that is a test,
   not a proof about IEEE doubles.
9. **Linked checks (closed by T042).** dossier.js used to count a held-up toy check citing any reviewed paper, so a
   non-credible or survey paper could raise `linked` and, with c ≥ 2, lift `early` to `some support`. Since T042
   `linked` counts only checks whose source is a credible (High) paper, so adding a non-credible paper leaves l
   unchanged and `rating_add_noncredible` (l fixed) describes the code. The model didn't change: `rating` is a
   function of the three counts, and only what the counts mean moved. test/bands-unit.js checks the code side
   (a Border paper, with or without a check citing it, never raises the rating once there is a paper).

## Vectors for T051

`node test/judge-lean-vectors.js` (exit 0 when all pass) checks:

- the integer formulas against review.js's float expressions on every reachable input (above);
- the real `rigor()` on all 256 presence sets and the real `hype()` on every u ≤ k ≤ 12, w 0..6 (survey and not)
  against the model;
- seven synthetic `review()` runs: each one's credibility, cap and score follow from its own rigor, hype and
  injection flag by the model's formulas;
- the `strength` expression read from dossier.js against `rating` on a grid;
- that `proofs/vectors.json` is current. `--write` regenerates it: 40 cases (presence by family, u, k, w, inj, base,
  and expected rigor, hype, credibility, cap, score and bands at (35, 5), (60, 5), (70, 5), (60, 3)) plus 24 rating
  cases. Cases 3 and 4 are the `margin_3_can_jump` pair. Expected values come from the real `rigor()` and `hype()`
  and review.js's own expressions, so T051 compares a Lean evaluator with the JavaScript, not with this model.
