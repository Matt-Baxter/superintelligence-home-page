/-
Toy formal model behind the Lab example `optimistic-verifier-padding` (runner `verifier-hacking` in
modules/lab/papers.js), from "Optimistic Verifiers Get Hacked: Reward Hacking Under an Exact Process Oracle"
(arXiv 2611.21538). Plain Lean 4, no Mathlib: check with `lean OptimisticVerifier.lean`.

What is proved here is the logic of the toy, not the paper's results:
  * padding (listing extra reasons) never lowers the optimistic verifier's reward;
  * an irrelevant reason leaves it unchanged but strictly lowers the exact (Jaccard) faithfulness;
  * so "needed reasons plus junk" gets the optimistic verifier's full reward while its exact score is below 1;
  * once every rollout in a batch gets the decision right, an outcome-only verifier gives no teaching signal;
  * a cost per listed reason makes every irrelevant reason strictly lower the training reward.
  * under the exact oracle, listing everything is never the dominant choice, so the trainer axiom forces no padding
    there; under the outcome-only verifier, extra reasons are free once a needed one is listed.
One modelling assumption is stated as an axiom, not proved: a trainer settles on a choice that is at least as good as
every alternative in every world and strictly better than each alternative in some world. `trainer_axiom_satisfiable`
shows the axiom's condition picks out at most one choice, so it can be met by a function and adds no contradiction.
Under that axiom, `optimistic_trainer_pads` proves the trainer lists every candidate reason.
-/

namespace OptimisticVerifier

/-- Reasons are numbered. `hits need L` counts the listed reasons in `L` that are in the minimal sufficient set `need`. -/
def hits (need L : List Nat) : Nat := (L.filter (fun x => decide (x ∈ need))).length

/-- A score as a fraction `(numerator, denominator)`, compared by cross-multiplication (no division). -/
def le (a b : Nat × Nat) : Prop := a.1 * b.2 ≤ b.1 * a.2
def lt (a b : Nat × Nat) : Prop := a.1 * b.2 < b.1 * a.2

/-- Optimistic verifier: the share of the needed reasons that were listed. Extra reasons never cost. -/
def optimistic (need L : List Nat) : Nat × Nat := (hits need L, need.length)

/-- Exact oracle: Jaccard overlap |L ∩ need| / |L ∪ need| = h / (k + m - h). -/
def exact (need L : List Nat) : Nat × Nat := (hits need L, L.length + need.length - hits need L)

/-- Outcome-only verifier: the decision is right when any needed reason is listed. -/
def outcome (need L : List Nat) : Nat := if 0 < hits need L then 1 else 0

theorem hits_append (need L M : List Nat) : hits need (L ++ M) = hits need L + hits need M := by
  simp [hits, List.filter_append]

theorem hits_le_length (need L : List Nat) : hits need L ≤ L.length := by
  simp only [hits]; exact List.length_filter_le _ _

theorem hits_self (need : List Nat) : hits need need = need.length := by
  simp only [hits]
  rw [List.filter_eq_self.mpr]
  intro x hx; simp [hx]

theorem hits_irrelevant (need : List Nat) (x : Nat) (hx : x ∉ need) : hits need [x] = 0 := by
  simp [hits, hx]

theorem hits_all_irrelevant (need junk : List Nat) (h : ∀ x ∈ junk, x ∉ need) : hits need junk = 0 := by
  simp only [hits, List.length_eq_zero, List.filter_eq_nil_iff]
  intro x hx; simp [h x hx]

/-- 1. Padding never lowers the optimistic verifier's reward. -/
theorem optimistic_padding_monotone (need L extra : List Nat) :
    le (optimistic need L) (optimistic need (L ++ extra)) := by
  simp only [le, optimistic, hits_append]
  exact Nat.mul_le_mul_right _ (Nat.le_add_right _ _)

/-- 2a. An irrelevant reason leaves the optimistic reward exactly where it was. -/
theorem optimistic_irrelevant_free (need L : List Nat) (x : Nat) (hx : x ∉ need) :
    optimistic need (L ++ [x]) = optimistic need L := by
  simp [optimistic, hits_append, hits_irrelevant need x hx]

/-- 2b. ...but strictly lowers exact faithfulness, as long as some needed reason was listed. -/
theorem exact_irrelevant_costs (need L : List Nat) (x : Nat) (hx : x ∉ need) (hpos : 0 < hits need L) :
    lt (exact need (L ++ [x])) (exact need L) := by
  have hk := hits_le_length need L
  simp only [lt, exact, hits_append, hits_irrelevant need x hx, Nat.add_zero, List.length_append, List.length_singleton]
  generalize hits need L = h at *
  generalize L.length = k at *
  generalize need.length = m
  have : k + 1 + m - h = (k + m - h) + 1 := by omega
  rw [this, Nat.mul_succ]
  exact Nat.lt_add_of_pos_right hpos

/-- 3. The Goodhart gap: the needed reasons plus any junk get the optimistic verifier's full reward (score 1),
    while the exact oracle scores the same answer strictly below 1. -/
theorem padded_full_optimistic (need junk : List Nat) (hj : ∀ x ∈ junk, x ∉ need) :
    optimistic need (need ++ junk) = (need.length, need.length) := by
  simp [optimistic, hits_append, hits_self, hits_all_irrelevant need junk hj]

theorem padded_exact_below_one (need junk : List Nat) (hj : ∀ x ∈ junk, x ∉ need) (hne : junk ≠ []) :
    (exact need (need ++ junk)).1 < (exact need (need ++ junk)).2 := by
  have hjl : 0 < junk.length := List.length_pos.mpr hne
  simp only [exact, hits_append, hits_self, hits_all_irrelevant need junk hj, List.length_append]
  omega

/-- 4. Outcome-only saturation: when every rollout in the batch lists some needed reason, every reward is 1, so
    every advantage (reward times batch size minus the batch total) is 0 and REINFORCE gets no gradient. -/
theorem outcome_saturates (need : List Nat) (batch : List (List Nat)) (hall : ∀ L ∈ batch, 0 < hits need L) :
    ∀ L ∈ batch, outcome need L * batch.length = (batch.map (outcome need)).sum := by
  have hsum : (batch.map (outcome need)).sum = batch.length := by
    induction batch with
    | nil => rfl
    | cons L rest ih =>
      have h1 : outcome need L = 1 := by simp [outcome, hall L (List.mem_cons_self _ _)]
      have ih' := ih (fun M hM => hall M (List.mem_cons_of_mem _ hM))
      simp [h1, ih']; omega
  intro L hL
  simp [outcome, hall L hL, hsum]

/-- 5. A cost per listed reason. Scaled by `m * q` (penalty `p / q` per reason), the training reward is
    `h * q - p * k * m`. With `p > 0` and some needed reason, each irrelevant reason strictly lowers it. -/
def penalised (p q : Nat) (need L : List Nat) : Int :=
  (hits need L : Int) * q - (p : Int) * L.length * need.length

theorem penalty_charges_padding (p q : Nat) (need L : List Nat) (x : Nat) (hx : x ∉ need)
    (hp : 0 < p) (hm : 0 < need.length) :
    penalised p q need (L ++ [x]) < penalised p q need L := by
  simp only [penalised, hits_append, hits_irrelevant need x hx, Nat.add_zero, List.length_append, List.length_singleton]
  have hpm : (0 : Int) < (p : Int) * (need.length : Int) := Int.mul_pos (by omega) (by omega)
  have e : (p : Int) * ((L.length + 1 : Nat) : Int) * (need.length : Int)
      = (p : Int) * (L.length : Int) * (need.length : Int) + (p : Int) * (need.length : Int) := by
    rw [Int.natCast_add, Int.mul_add, Int.add_mul]; simp
  rw [e]
  generalize (hits need L : Int) * (q : Int) = a
  generalize (p : Int) * (L.length : Int) * (need.length : Int) = b
  generalize (p : Int) * (need.length : Int) = c at hpm
  omega

/-! ### The trainer, as an explicit axiom

A ranking `order` lists the candidate reasons from most to least likely to matter (the policy's noisy sense of
relevance). The policy picks `k` and lists `order.take k`. It does not know `need`, so a choice of `k` is judged across
every world `need`. -/

/-- The assumption we do not prove: given a reward `R k need` and the allowed choices `ks`, the trainer returns a
    choice that is at least as good as every allowed choice in every world and strictly better than each other allowed
    choice in some world, whenever there is one. (Policy-gradient training approaches this only with enough data and
    exploration; that gap is why it is an axiom and not a theorem.) -/
axiom trainer : (Nat → List Nat → Nat × Nat) → List Nat → Nat
def Dominant (R : Nat → List Nat → Nat × Nat) (ks : List Nat) (k : Nat) : Prop :=
  k ∈ ks ∧ (∀ j ∈ ks, ∀ need, le (R j need) (R k need)) ∧ (∀ j ∈ ks, j ≠ k → ∃ need, lt (R j need) (R k need))
axiom trainer_dominant : ∀ R ks k, Dominant R ks k → trainer R ks = k

/-- The axiom is safe: at most one choice is dominant, so a function meeting it exists (e.g. by choice). -/
theorem dominant_unique (R : Nat → List Nat → Nat × Nat) (ks : List Nat) (k k' : Nat)
    (h : Dominant R ks k) (h' : Dominant R ks k') : k = k' := by
  apply Classical.byContradiction; intro hne
  obtain ⟨need, hlt⟩ := h.2.2 k' h'.1 (fun e => hne e.symm)
  have hle := h'.2.1 k h.1 need
  simp only [lt, le] at hlt hle
  omega

open Classical in
theorem trainer_axiom_satisfiable : ∃ f : (Nat → List Nat → Nat × Nat) → List Nat → Nat,
    ∀ R ks k, Dominant R ks k → f R ks = k := by
  refine ⟨fun R ks => if h : ∃ k, Dominant R ks k then Classical.choose h else 0, ?_⟩
  intro R ks k hk
  have hex : ∃ k, Dominant R ks k := ⟨k, hk⟩
  simp only [hex, dif_pos]
  exact dominant_unique R ks _ _ (Classical.choose_spec hex) hk

/-- The optimistic verifier's reward for listing the top `k` reasons of `order`. -/
def optimisticR (order : List Nat) (k : Nat) (need : List Nat) : Nat × Nat := optimistic need (order.take k)

theorem take_length_eq (order : List Nat) : order.take order.length = order := List.take_length order

/-- Under the optimistic verifier, listing every candidate is the dominant choice. -/
theorem listing_all_dominant (order : List Nat) :
    Dominant (optimisticR order) (List.range (order.length + 1)) order.length := by
  refine ⟨List.mem_range.mpr (Nat.lt_succ_self _), ?_, ?_⟩
  · intro j hj need
    have hj' : j ≤ order.length := Nat.le_of_lt_succ (List.mem_range.mp hj)
    have e := optimistic_padding_monotone need (order.take j) (order.drop j)
    rw [List.take_append_drop] at e
    simpa only [optimisticR, take_length_eq] using e
  · intro j hj hne
    have hj' : j < order.length := by have := List.mem_range.mp hj; omega
    refine ⟨order.drop j, ?_⟩
    have hd : 0 < (order.drop j).length := by simp; omega
    have e : hits (order.drop j) order = hits (order.drop j) (order.take j) + (order.drop j).length := by
      rw [← hits_self (order.drop j), ← hits_append, List.take_append_drop]
    simp only [lt, optimisticR, optimistic, take_length_eq]
    rw [e]
    exact Nat.mul_lt_mul_of_pos_right (Nat.lt_add_of_pos_right hd) hd

/-- 6. Under the trainer axiom, a policy trained on the optimistic verifier lists every candidate reason. -/
theorem optimistic_trainer_pads (order : List Nat) :
    trainer (optimisticR order) (List.range (order.length + 1)) = order.length :=
  trainer_dominant _ _ _ (listing_all_dominant order)

/-- The exact oracle's reward for listing the top `k` reasons of `order`. -/
def exactR (order : List Nat) (k : Nat) (need : List Nat) : Nat × Nat := exact need (order.take k)

theorem hits_head_only (x : Nat) (rest : List Nat) (hx : x ∉ rest) : hits [x] (x :: rest) = 1 := by
  have h0 : hits [x] rest = 0 := hits_all_irrelevant [x] rest (fun y hy hyx => by
    simp at hyx; subst hyx; exact hx hy)
  have e : x :: rest = [x] ++ rest := rfl
  rw [e, hits_append, hits_self, h0]; rfl

/-- 7. The trainer axiom does not force padding under the exact oracle: when the top-ranked reason is not repeated
    and there is anything else to list, listing everything is not a dominant choice, because in the world where only
    the top reason is needed, listing just that one scores strictly higher. -/
theorem exact_listing_all_not_dominant (x : Nat) (rest : List Nat) (hx : x ∉ rest) (hr : rest ≠ [])
    (ks : List Nat) (h1 : 1 ∈ ks) :
    ¬ Dominant (exactR (x :: rest)) ks (x :: rest).length := by
  intro hd
  have hle := hd.2.1 1 h1 [x]
  have hrl : 0 < rest.length := List.length_pos.mpr hr
  have hh := hits_head_only x rest hx
  simp only [le, exactR, exact, List.take_length, hh, List.take, List.length_singleton, List.length_cons] at hle
  have e1 : hits [x] [x] = 1 := hits_self [x]
  rw [e1] at hle
  simp only [List.length_nil] at hle
  omega

/-- 8. ...and under the outcome-only verifier, extra reasons are never penalised either: once a needed reason is
    listed, appending anything keeps the outcome reward at 1. -/
theorem outcome_padding_free (need L extra : List Nat) (h : 0 < hits need L) : outcome need (L ++ extra) = 1 := by
  have : 0 < hits need (L ++ extra) := by rw [hits_append]; omega
  simp [outcome, this]

/-- A concrete instance (10 candidates, needed reasons 0, 1, 2 ranked first): listing all 10 gets the optimistic
    verifier's full reward, yet the exact oracle prefers listing exactly the 3 needed reasons (1 vs 3/10). -/
example : optimistic [0, 1, 2] (List.range 10) = (3, 3) := by decide
example : exact [0, 1, 2] ((List.range 10).take 3) = (3, 3) := by decide
example : exact [0, 1, 2] (List.range 10) = (3, 10) := by decide
example : lt (exact [0, 1, 2] (List.range 10)) (exact [0, 1, 2] ((List.range 10).take 3)) := by
  unfold lt; decide

end OptimisticVerifier

-- Which axioms each main result rests on: the five arithmetic results use only Lean's standard axioms (propext, and
-- Quot.sound / Classical.choice where simp needs them); `optimistic_trainer_pads` also uses the trainer axioms.
#print axioms OptimisticVerifier.exact_irrelevant_costs
#print axioms OptimisticVerifier.padded_exact_below_one
#print axioms OptimisticVerifier.outcome_saturates
#print axioms OptimisticVerifier.penalty_charges_padding
#print axioms OptimisticVerifier.optimistic_trainer_pads
#print axioms OptimisticVerifier.exact_listing_all_not_dominant
#print axioms OptimisticVerifier.outcome_padding_free
