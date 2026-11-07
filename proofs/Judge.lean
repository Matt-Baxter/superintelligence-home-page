/-
  Judge.lean: a core Lean 4 model (no Mathlib) of the review judge's arithmetic,
  plan steps 3-7 of specs/003-judge-fidelity/plan.md (and the rigor sum of step 2).

  REQ-038, task T005. Every proof here was WRITTEN BY HAND AND HAS NOT YET BEEN CHECKED
  BY LEAN. A person installs elan and runs `lake build` in proofs/ (see README.md).
  Nothing in this file uses `sorry`.

  What is modelled is the arithmetic only: which marker families a text shows, how many
  claims are unbacked, how many distinct hype words appear and whether an injection was
  found are INPUTS here. The text layer (regexes, sentence splitting, the survey rule,
  claims capped at 12) is not modelled; see README.md, "Gaps between model and code".
-/

namespace Judge

/-! ## Step 2: marker families and rigor (review.js lines 37-46, 81-87) -/

/-- The eight evidence-marker families, in the order of `MARKERS` in review.js. -/
inductive Family where
  | numbers | baseline | method | sample | uncertainty | heldOut | limitations | artifacts
  deriving DecidableEq, Repr

/-- `points` of each entry of `MARKERS` (review.js lines 38-45). -/
def weight : Family → Nat
  | .numbers => 10
  | .baseline => 14
  | .method => 12
  | .sample => 12
  | .uncertainty => 14
  | .heldOut => 14
  | .limitations => 14
  | .artifacts => 10

theorem weights_sum :
    weight .numbers + weight .baseline + weight .method + weight .sample + weight .uncertainty
      + weight .heldOut + weight .limitations + weight .artifacts = 100 := by decide

theorem weight_le_14 (f : Family) : weight f ≤ 14 := by
  cases f <;> decide

/-- Which families a text shows (presence, not repetition: review.js line 36, the `found` map at line 82). -/
abbrev Presence := Family → Bool

/-- Points one family contributes. -/
def pts (p : Presence) (f : Family) : Nat := if p f = true then weight f else 0

/-- Rigor: the sum of the weights of the families present (review.js line 86). -/
def rigor (p : Presence) : Nat :=
  pts p .numbers + pts p .baseline + pts p .method + pts p .sample + pts p .uncertainty
    + pts p .heldOut + pts p .limitations + pts p .artifacts

theorem pts_of_true {p : Presence} {f : Family} (hp : p f = true) : pts p f = weight f := by
  unfold pts; rw [if_pos hp]

theorem pts_of_false {p : Presence} {f : Family} (hp : ¬ p f = true) : pts p f = 0 := by
  unfold pts; rw [if_neg hp]

theorem pts_le (p : Presence) (f : Family) : pts p f ≤ weight f := by
  by_cases hp : p f = true
  · have e := pts_of_true hp; omega
  · have e := pts_of_false hp; omega

theorem pts_congr {p q : Presence} {f : Family} (h : p f = q f) : pts p f = pts q f := by
  unfold pts; rw [h]

theorem pts_mono {p q : Presence} {f : Family} (h : p f = true → q f = true) :
    pts p f ≤ pts q f := by
  by_cases hp : p f = true
  · have e1 := pts_of_true hp
    have e2 := pts_of_true (h hp)
    omega
  · have e1 := pts_of_false hp
    omega

/-- All eight families present gives 100. -/
theorem rigor_all : rigor (fun _ => true) = 100 := by decide

/-- No family present gives 0. -/
theorem rigor_none : rigor (fun _ => false) = 0 := by decide

/-- Rigor is monotone: showing more families never lowers it (plan step 2). -/
theorem rigor_mono (p q : Presence) (h : ∀ f, p f = true → q f = true) : rigor p ≤ rigor q := by
  have h1 := pts_mono (h .numbers)
  have h2 := pts_mono (h .baseline)
  have h3 := pts_mono (h .method)
  have h4 := pts_mono (h .sample)
  have h5 := pts_mono (h .uncertainty)
  have h6 := pts_mono (h .heldOut)
  have h7 := pts_mono (h .limitations)
  have h8 := pts_mono (h .artifacts)
  unfold rigor
  omega

/-- Rigor is at most 100 (plan step 2). -/
theorem rigor_le_100 (p : Presence) : rigor p ≤ 100 := by
  have h := rigor_mono p (fun _ => true) (fun _ _ => rfl)
  rw [rigor_all] at h
  exact h

/-- Flipping one family (p and q agree everywhere except at f) moves rigor by at most that
    family's weight, in either direction. -/
theorem rigor_flip (p q : Presence) (f : Family) (h : ∀ g, g ≠ f → p g = q g) :
    rigor q ≤ rigor p + weight f ∧ rigor p ≤ rigor q + weight f := by
  have b1 := pts_le p .numbers
  have b2 := pts_le p .baseline
  have b3 := pts_le p .method
  have b4 := pts_le p .sample
  have b5 := pts_le p .uncertainty
  have b6 := pts_le p .heldOut
  have b7 := pts_le p .limitations
  have b8 := pts_le p .artifacts
  have c1 := pts_le q .numbers
  have c2 := pts_le q .baseline
  have c3 := pts_le q .method
  have c4 := pts_le q .sample
  have c5 := pts_le q .uncertainty
  have c6 := pts_le q .heldOut
  have c7 := pts_le q .limitations
  have c8 := pts_le q .artifacts
  -- In each case, the seven families other than f contribute equally to both sums.
  cases f <;>
  ( unfold rigor
    (try have e1 := pts_congr (h .numbers (by decide)))
    (try have e2 := pts_congr (h .baseline (by decide)))
    (try have e3 := pts_congr (h .method (by decide)))
    (try have e4 := pts_congr (h .sample (by decide)))
    (try have e5 := pts_congr (h .uncertainty (by decide)))
    (try have e6 := pts_congr (h .heldOut (by decide)))
    (try have e7 := pts_congr (h .limitations (by decide)))
    (try have e8 := pts_congr (h .artifacts (by decide)))
    constructor <;> omega )

/-! ## Rounding: JavaScript's Math.round on a non-negative rational a / b -/

/-- `jsRound a b` is round(a / b) for naturals, computed as (2a + b) / (2b) with floor division.
    JS `Math.round(x)` is floor(x + 1/2) (halves round toward +infinity), and for x = a / b ≥ 0,
    floor(a/b + 1/2) = floor((2a + b) / (2b)). The two agree exactly on rationals; the JS side computes
    in binary floating point, so test/judge-lean-vectors.js checks every input the judge can produce
    (rigor 0..100, hype 0..100, claims k ≤ 50) and finds no float drift. For b = 0, Lean's
    division gives 0. -/
def jsRound (a b : Nat) : Nat := (2 * a + b) / (2 * b)

theorem jsRound_two (a : Nat) : jsRound a 2 = (a + 1) / 2 := by
  show (2 * a + 2) / 4 = (a + 1) / 2
  omega

/-- The lower half of the rounding spec: jsRound a b * 2b ≤ 2a + b. -/
theorem jsRound_mul_le (a b : Nat) : jsRound a b * (2 * b) ≤ 2 * a + b :=
  Nat.div_mul_le_self (2 * a + b) (2 * b)

/-! ## Step 3: hype (review.js lines 108-114) -/

/-- The unbacked-claims part: round(60 u / k), 0 when there are no claims (or, by passing k = 0,
    for a survey: review.js line 112 drops the claims term when `survey`). -/
def claimsPart (u k : Nat) : Nat := if k = 0 then 0 else jsRound (60 * u) k

/-- Hype for u unbacked of k claims and w distinct hype words:
    min(100, round(60 u / k) + min(40, 10 w)). review.js rounds the whole sum; because min(40, 10w)
    is an integer, round(x + n) = round(x) + n, so rounding only the claims part is the same. -/
def hype (u k w : Nat) : Nat := min 100 (claimsPart u k + min 40 (10 * w))

theorem hype_le_100 (u k w : Nat) : hype u k w ≤ 100 := Nat.min_le_left _ _

theorem hype_no_claims (u w : Nat) : hype u 0 w = min 100 (min 40 (10 * w)) := by
  unfold hype claimsPart
  rw [if_pos rfl, Nat.zero_add]

/-! ## Step 4: credibility (review.js line 197) -/

/-- credibility = round(0.5 R + 0.5 (100 - H)) = round((R + 100 - H) / 2). Natural subtraction is
    exact here because H ≤ 100 (hype_le_100). -/
def credibility (r h : Nat) : Nat := jsRound (r + (100 - h)) 2

theorem credibility_eq (r h : Nat) : credibility r h = (r + (100 - h) + 1) / 2 := by
  unfold credibility
  exact jsRound_two _

theorem credibility_le_100 (r h : Nat) (hr : r ≤ 100) : credibility r h ≤ 100 := by
  rw [credibility_eq]
  omega

theorem credibility_rigor_le_100 (p : Presence) (h : Nat) : credibility (rigor p) h ≤ 100 :=
  credibility_le_100 _ h (rigor_le_100 p)

/-- One family flip, WITH HYPE HELD FIXED, moves credibility by at most ceil(w_f / 2).
    (Hype is not fixed in the real judge: a marker sentence can also back a claim. See README.) -/
theorem credibility_flip_weight (p q : Presence) (f : Family) (h : ∀ g, g ≠ f → p g = q g)
    (hv : Nat) :
    credibility (rigor q) hv ≤ credibility (rigor p) hv + (weight f + 1) / 2 ∧
    credibility (rigor p) hv ≤ credibility (rigor q) hv + (weight f + 1) / 2 := by
  have hf := rigor_flip p q f h
  simp only [credibility_eq]
  constructor <;> omega

/-- The same bound with today's largest weight, 14: at most 7 points. -/
theorem credibility_flip_7 (p q : Presence) (f : Family) (h : ∀ g, g ≠ f → p g = q g)
    (hv : Nat) :
    credibility (rigor q) hv ≤ credibility (rigor p) hv + 7 ∧
    credibility (rigor p) hv ≤ credibility (rigor q) hv + 7 := by
  have hf := rigor_flip p q f h
  have hw := weight_le_14 f
  simp only [credibility_eq]
  constructor <;> omega

/-! ## Step 5: the guarded score (review.js lines 189-196) -/

/-- cap = Math.round(35 + 0.65 R) = round((3500 + 65 R) / 100). -/
def cap (r : Nat) : Nat := jsRound (3500 + 65 * r) 100

theorem cap_eq (r : Nat) : cap r = (7100 + 130 * r) / 200 := by
  show (2 * (3500 + 65 * r) + 100) / 200 = (7100 + 130 * r) / 200
  omega

theorem cap_ge_35 (r : Nat) : 35 ≤ cap r := by
  rw [cap_eq]; omega

theorem cap_le_100 (r : Nat) (hr : r ≤ 100) : cap r ≤ 100 := by
  rw [cap_eq]; omega

/-- Guarded score for base b, rigor r and the injection flag. `b` is the base already clamped at 0:
    review.js computes max(0, round(min(base, cap, inj ? 30 : ∞))) with an integer base, and since
    cap ≥ 0, clamping base first gives the same number. -/
def guarded (b r : Nat) : Bool → Nat
  | false => min b (cap r)
  | true => min (min b (cap r)) 30

theorem guarded_le_cap (b r : Nat) (inj : Bool) : guarded b r inj ≤ cap r := by
  cases inj with
  | false => exact Nat.min_le_right b (cap r)
  | true => exact Nat.le_trans (Nat.min_le_left _ _) (Nat.min_le_right b (cap r))

theorem guarded_le_base (b r : Nat) (inj : Bool) : guarded b r inj ≤ b := by
  cases inj with
  | false => exact Nat.min_le_left b (cap r)
  | true => exact Nat.le_trans (Nat.min_le_left _ _) (Nat.min_le_left b (cap r))

theorem guarded_inj_le_30 (b r : Nat) : guarded b r true ≤ 30 := Nat.min_le_right _ _

theorem guarded_le_100 (b : Nat) (p : Presence) (inj : Bool) : guarded b (rigor p) inj ≤ 100 :=
  Nat.le_trans (guarded_le_cap b (rigor p) inj) (cap_le_100 _ (rigor_le_100 p))

/-! ## Step 6: bands (REQ-037; not yet in review.js, which uses fixed cutoffs) -/

inductive Band where
  | low | border | high
  deriving DecidableEq, Repr

/-- Low if c < T - m, Border if T - m ≤ c < T + m, High if c ≥ T + m (half-open).
    Natural subtraction: if m > T, T - m = 0 and nothing is Low, as with integers since c ≥ 0. -/
def band (T m c : Nat) : Band :=
  if c < T - m then .low else if c < T + m then .border else .high

theorem band_low {T m c : Nat} (h : c < T - m) : band T m c = .low := by
  unfold band; rw [if_pos h]

theorem band_border {T m c : Nat} (h1 : ¬ c < T - m) (h2 : c < T + m) : band T m c = .border := by
  unfold band; rw [if_neg h1, if_pos h2]

theorem band_high {T m c : Nat} (h1 : ¬ c < T - m) (h2 : ¬ c < T + m) : band T m c = .high := by
  unfold band; rw [if_neg h1, if_neg h2]

theorem band_eq_low_iff (T m c : Nat) : band T m c = .low ↔ c < T - m := by
  constructor
  · intro hb
    by_cases h1 : c < T - m
    · exact h1
    · by_cases h2 : c < T + m
      · rw [band_border h1 h2] at hb; cases hb
      · rw [band_high h1 h2] at hb; cases hb
  · intro h; exact band_low h

theorem band_eq_border_iff (T m c : Nat) : band T m c = .border ↔ (T - m ≤ c ∧ c < T + m) := by
  constructor
  · intro hb
    by_cases h1 : c < T - m
    · rw [band_low h1] at hb; cases hb
    · by_cases h2 : c < T + m
      · omega
      · rw [band_high h1 h2] at hb; cases hb
  · intro h; exact band_border (by omega) h.2

theorem band_eq_high_iff (T m c : Nat) : band T m c = .high ↔ T + m ≤ c := by
  constructor
  · intro hb
    by_cases h1 : c < T - m
    · rw [band_low h1] at hb; cases hb
    · by_cases h2 : c < T + m
      · rw [band_border h1 h2] at hb; cases hb
      · omega
  · intro h; exact band_high (by omega) (by omega)

/-- Exactly one band: at least one (this theorem) and at most one (`band` is a function, so
    `band T m c` cannot equal two different constructors; the three iff lemmas above show the
    three conditions are the half-open intervals). -/
theorem band_exhaustive (T m c : Nat) :
    band T m c = .low ∨ band T m c = .border ∨ band T m c = .high := by
  cases band T m c
  · exact Or.inl rfl
  · exact Or.inr (Or.inl rfl)
  · exact Or.inr (Or.inr rfl)

theorem band_exclusive_low_high (T m c : Nat) (h : band T m c = .low) : band T m c ≠ .high := by
  intro h'; rw [h] at h'; cases h'

/-- With 2m ≥ 7 and hype held fixed, one family flip never moves Low to High. -/
theorem flip_low_not_high (T m hv : Nat) (hm : 7 ≤ 2 * m) (p q : Presence) (f : Family)
    (h : ∀ g, g ≠ f → p g = q g) :
    band T m (credibility (rigor p) hv) = .low → band T m (credibility (rigor q) hv) ≠ .high := by
  intro hl hh
  rw [band_eq_low_iff] at hl
  rw [band_eq_high_iff] at hh
  have := credibility_flip_7 p q f h hv
  omega

/-- ... nor High to Low. -/
theorem flip_high_not_low (T m hv : Nat) (hm : 7 ≤ 2 * m) (p q : Presence) (f : Family)
    (h : ∀ g, g ≠ f → p g = q g) :
    band T m (credibility (rigor p) hv) = .high → band T m (credibility (rigor q) hv) ≠ .low := by
  intro hh hl
  rw [band_eq_high_iff] at hh
  rw [band_eq_low_iff] at hl
  have := credibility_flip_7 p q f h hv
  omega

/-- The margin bound is sharp: with m = 3 one flip (uncertainty, weight 14) does jump Low to High.
    Hype 75 = round(60 * 7/12) + min(40, 40) = 35 + 40; rigor 86 -> credibility 56 (Low, < 57);
    rigor 100 -> credibility 63 (High, ≥ 63). -/
def allButUncertainty : Presence
  | .uncertainty => false
  | _ => true

theorem margin_3_can_jump :
    band 60 3 (credibility (rigor allButUncertainty) (hype 7 12 4)) = .low ∧
    band 60 3 (credibility (rigor (fun _ => true)) (hype 7 12 4)) = .high := by decide

/-! ## Step 7: the dossier rating (dossier.js line 75, `const strength =`) -/

inductive Rating where
  | noneYet | thin | early | someSupport
  deriving DecidableEq, Repr

def Rating.rank : Rating → Nat
  | .noneYet => 0
  | .thin => 1
  | .early => 2
  | .someSupport => 3

/-- credible = credible primary papers, linked = toy checks of their ideas that held up,
    papers = reviewed primary papers (`P.length`). -/
def rating (credible linked papers : Nat) : Rating :=
  if 2 ≤ credible ∧ 1 ≤ linked then .someSupport
  else if 1 ≤ credible then .early
  else if 0 < papers then .thin
  else .noneYet

theorem rating_some {c l n : Nat} (h : 2 ≤ c ∧ 1 ≤ l) : rating c l n = .someSupport := by
  unfold rating; rw [if_pos h]

theorem rating_early {c l n : Nat} (h1 : ¬ (2 ≤ c ∧ 1 ≤ l)) (h2 : 1 ≤ c) :
    rating c l n = .early := by
  unfold rating; rw [if_neg h1, if_pos h2]

theorem rating_thin {c l n : Nat} (h1 : ¬ (2 ≤ c ∧ 1 ≤ l)) (h2 : ¬ 1 ≤ c) (h3 : 0 < n) :
    rating c l n = .thin := by
  unfold rating; rw [if_neg h1, if_neg h2, if_pos h3]

theorem rating_none {c l n : Nat} (h1 : ¬ (2 ≤ c ∧ 1 ≤ l)) (h2 : ¬ 1 ≤ c) (h3 : ¬ 0 < n) :
    rating c l n = .noneYet := by
  unfold rating; rw [if_neg h1, if_neg h2, if_neg h3]

theorem rating_exhaustive (c l n : Nat) :
    rating c l n = .someSupport ∨ rating c l n = .early ∨ rating c l n = .thin ∨
      rating c l n = .noneYet := by
  cases rating c l n
  · exact Or.inr (Or.inr (Or.inr rfl))
  · exact Or.inr (Or.inr (Or.inl rfl))
  · exact Or.inr (Or.inl rfl)
  · exact Or.inl rfl

/-- The four cases as conditions (they are pairwise exclusive and cover every (c, l, n)). -/
theorem rating_eq_some_iff (c l n : Nat) : rating c l n = .someSupport ↔ (2 ≤ c ∧ 1 ≤ l) := by
  constructor
  · intro hr
    by_cases h1 : 2 ≤ c ∧ 1 ≤ l
    · exact h1
    · by_cases h2 : 1 ≤ c
      · rw [rating_early h1 h2] at hr; cases hr
      · by_cases h3 : 0 < n
        · rw [rating_thin h1 h2 h3] at hr; cases hr
        · rw [rating_none h1 h2 h3] at hr; cases hr
  · exact rating_some

theorem rating_eq_early_iff (c l n : Nat) :
    rating c l n = .early ↔ (c = 1 ∨ (2 ≤ c ∧ l = 0)) := by
  constructor
  · intro hr
    by_cases h1 : 2 ≤ c ∧ 1 ≤ l
    · rw [rating_some h1] at hr; cases hr
    · by_cases h2 : 1 ≤ c
      · omega
      · by_cases h3 : 0 < n
        · rw [rating_thin h1 h2 h3] at hr; cases hr
        · rw [rating_none h1 h2 h3] at hr; cases hr
  · intro h; exact rating_early (by omega) (by omega)

theorem rating_eq_thin_iff (c l n : Nat) : rating c l n = .thin ↔ (c = 0 ∧ 0 < n) := by
  constructor
  · intro hr
    by_cases h1 : 2 ≤ c ∧ 1 ≤ l
    · rw [rating_some h1] at hr; cases hr
    · by_cases h2 : 1 ≤ c
      · rw [rating_early h1 h2] at hr; cases hr
      · by_cases h3 : 0 < n
        · omega
        · rw [rating_none h1 h2 h3] at hr; cases hr
  · intro h; exact rating_thin (by omega) (by omega) h.2

theorem rating_eq_none_iff (c l n : Nat) : rating c l n = .noneYet ↔ (c = 0 ∧ n = 0) := by
  constructor
  · intro hr
    by_cases h1 : 2 ≤ c ∧ 1 ≤ l
    · rw [rating_some h1] at hr; cases hr
    · by_cases h2 : 1 ≤ c
      · rw [rating_early h1 h2] at hr; cases hr
      · by_cases h3 : 0 < n
        · rw [rating_thin h1 h2 h3] at hr; cases hr
        · omega
  · intro h; exact rating_none (by omega) (by omega) (by omega)

/-- Monotone: more credible papers, more linked checks or more papers never lower the rating. -/
theorem rating_mono {c l n c' l' n' : Nat} (hc : c ≤ c') (hl : l ≤ l') (hn : n ≤ n') :
    (rating c l n).rank ≤ (rating c' l' n').rank := by
  unfold rating
  repeat' split
  all_goals (simp only [Rating.rank]; try omega)

/-- Adding a credible paper (which is also a paper) never lowers the rating. -/
theorem rating_add_credible (c l n : Nat) : (rating c l n).rank ≤ (rating (c + 1) l (n + 1)).rank :=
  rating_mono (by omega) (Nat.le_refl l) (by omega)

/-- Once there is at least one paper, adding a non-credible (e.g. Border) paper changes nothing. -/
theorem rating_add_noncredible (c l n : Nat) (hn : 0 < n) : rating c l (n + 1) = rating c l n := by
  by_cases h1 : 2 ≤ c ∧ 1 ≤ l
  · rw [rating_some h1, rating_some h1]
  · by_cases h2 : 1 ≤ c
    · rw [rating_early h1 h2, rating_early h1 h2]
    · rw [rating_thin h1 h2 (by omega : 0 < n + 1), rating_thin h1 h2 hn]

/-- ... but the first paper, credible or not, lifts "none yet" to "thin" (T004's observation;
    the plan's "a Border paper never raises it" holds only from one paper on). -/
theorem first_noncredible_paper_raises : rating 0 0 1 ≠ rating 0 0 0 := by decide

end Judge
