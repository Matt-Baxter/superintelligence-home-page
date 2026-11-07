# proofs/: a Lean 4 model of the review judge's arithmetic

REQ-038, task T005 (specs/003-judge-fidelity/tasks.md); T051 fills in the evaluator and the differential test.
Plain core Lean 4, no Mathlib and no other dependencies.

**Status: every proof in `Judge.lean` was written by hand and has NOT yet been checked by Lean.** No Lean toolchain
was installed while writing it. The file has no `sorry`. Until someone runs `lake build`, treat each theorem as
"stated, proof written, not checked".

## How to check

1. Install elan, the Lean version manager, as described at https://lean-lang.org (Install).
2. `cd proofs && lake build`. Lake reads `lean-toolchain` and fetches that Lean version first.
3. A clean build with no errors and no `sorry` warnings means every theorem below is proved.

`lean-toolchain` pins `leanprover/lean4:v4.15.0`. **That version is a placeholder**: it's a stable release that
exists, but no one has built with it yet. Change it to the current stable release when you check the proofs, and
record which one worked. Build output goes to `proofs/.lake/`, which is in `.gitignore`.

The JavaScript side: `node test/judge-lean-vectors.js` (see below).

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
| `cap r` | review.js line 193 | `round(35 + 0.65R) = jsRound (3500 + 65R) 100 = (7100 + 130R) / 200` |
| `guarded b r inj` | review.js lines 189-196 | `min(b, cap)`, then `min(·, 30)` if injection. `b` is the base clamped at 0: the code applies `max(0, ·)` last, which gives the same number because cap ≥ 0 |
| `band T m c` | not in code yet (REQ-037, T041) | Low `c < T - m`, Border `T - m ≤ c < T + m`, High `c ≥ T + m`. Natural subtraction: if m > T nothing is Low, same as with integers since c ≥ 0 |
| `rating c l n` | dossier.js line 75, `const strength =` | `some support` if c ≥ 2 and l ≥ 1; `early` if c ≥ 1; `thin` if n > 0; else `none yet` (c credible primary papers, l linked toy checks that held up, n = `P.length`) |

## Theorems

All: **written, not yet checked by Lean.** None uses `sorry`.

| Theorem | Statement | Plan step |
| --- | --- | --- |
| `weights_sum` | the 8 weights sum to 100 (`decide`) | 2 |
| `weight_le_14` | every weight ≤ 14 | 2, 4 |
| `rigor_all`, `rigor_none` | all families give 100, none give 0 (`decide`) | 2 |
| `rigor_mono` | p ≤ q pointwise ⇒ rigor p ≤ rigor q | 2 |
| `rigor_le_100` | rigor p ≤ 100 | 2 |
| `rigor_flip` | p, q differ only at f ⇒ \|rigor p − rigor q\| ≤ weight f | 2 |
| `jsRound_two`, `jsRound_mul_le` | `jsRound a 2 = (a+1)/2`; `jsRound a b · 2b ≤ 2a + b` (lower half of the rounding spec) | – |
| `hype_le_100`, `hype_no_claims` | H ≤ 100; with k = 0 (or a survey) only hype words count | 3 |
| `credibility_eq`, `credibility_le_100`, `credibility_rigor_le_100` | C = (R + 100 − H + 1)/2; C ≤ 100 when R ≤ 100 | 4 |
| `credibility_flip_weight` | one flip, **hype held fixed**: \|ΔC\| ≤ ⌈w_f / 2⌉ | 4 |
| `credibility_flip_7` | the same with today's weights: \|ΔC\| ≤ 7 | 4 |
| `cap_eq`, `cap_ge_35`, `cap_le_100` | cap = (7100 + 130R)/200; 35 ≤ cap; cap ≤ 100 when R ≤ 100 | 5 |
| `guarded_le_cap`, `guarded_le_base`, `guarded_inj_le_30`, `guarded_le_100` | S ≤ cap; S ≤ base; inj ⇒ S ≤ 30; S ≤ 100 | 5 |
| `band_low`, `band_border`, `band_high` and `band_eq_low_iff`, `band_eq_border_iff`, `band_eq_high_iff` | each band holds exactly on its half-open interval | 6 |
| `band_exhaustive`, `band_exclusive_low_high` | exactly one band (a function, so at most one; the iffs give the intervals) | 6 |
| `flip_low_not_high`, `flip_high_not_low` | 2m ≥ 7, **hype held fixed**: one flip never moves Low ↔ High | 6 |
| `margin_3_can_jump` | the bound is sharp: T = 60, m = 3, hype 75 (u 7 of k 12, w 4), dropping uncertainty takes C from 63 (High) to 56 (Low) (`decide`) | 6 |
| `rating_some`/`early`/`thin`/`none`, `rating_exhaustive`, `rating_eq_*_iff` | the four cases, as conditions, are exhaustive and pairwise exclusive | 7 |
| `rating_mono`, `rating_add_credible` | more credible papers, linked checks or papers never lower the rating | 7 |
| `rating_add_noncredible` | with at least one paper, a non-credible (Border) paper changes nothing | 7 |
| `first_noncredible_paper_raises` | but the first one lifts `none yet` to `thin` (`decide`), so the plan's "a Border paper never raises it" holds only from one paper on | 7 |

Proofs a reviewer might want to look at first, because they lean on tactic behaviour that varies between Lean
versions: `rigor_flip` (a `cases f` followed by `try have … (by decide)` to collect the seven unchanged families),
`rating_mono` (`repeat' split` then `simp only [Rating.rank]; try omega`), and the `show` steps in `jsRound_two` and
`cap_eq`, which rely on `2 * 2` and `2 * 100` reducing to `4` and `200` by definitional unfolding.

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
7. **Bands aren't in the code yet.** `verdict` (line 207) uses fixed cutoffs 35, 60, 70 with `>=`; `band` is the
   REQ-037 rule T041 will add.
8. **Floating point.** The model is exact rational rounding. `test/judge-lean-vectors.js` checks the float code
   equals it on every R 0..100, H 0..100, u ≤ k ≤ 50 and w 0..6, and finds no difference, but that is a test,
   not a proof about IEEE doubles.

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
