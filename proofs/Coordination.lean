/-
  Coordination.lean: proofs of the statements in CoordinationSpec.lean (REQ-069, REQ-072, proposed).
  Untrusted by design: what matters is that each theorem's type is a `Coord.*` statement and that
  FinalCheck.lean pins its axioms. Core Lean 4.15.0, no Mathlib.
-/
import CoordinationSpec

namespace Coord

theorem beq_symm_string (a b : String) : (a == b) = (b == a) := by
  by_cases h : a = b
  · subst h; rfl
  · have h1 : (a == b) = false := beq_false_of_ne h
    have h2 : (b == a) = false := beq_false_of_ne (fun e => h e.symm)
    rw [h1, h2]

theorem overlapCore_symm (a b : String) : overlapCore a b = overlapCore b a := by
  unfold overlapCore
  rw [beq_symm_string a b]
  generalize (b == a) = e
  generalize isDir a = da
  generalize isDir b = db
  generalize b.startsWith (stem a) = p
  generalize a.startsWith (stem b) = q
  generalize (stem a).startsWith (stem b) = r
  generalize (stem b).startsWith (stem a) = t
  cases e <;> cases da <;> cases db <;> cases p <;> cases q <;> cases r <;> cases t <;> rfl

theorem overlap_symm : OverlapSymm := by
  intro a b
  unfold overlap
  rw [overlapCore_symm a b]
  cases a != "" <;> cases b != "" <;> rfl

theorem overlap_refl : OverlapRefl := by
  intro a h
  have h1 : (a != "") = true := bne_iff_ne.mpr h
  simp [overlap, overlapCore, h1]

theorem conflictB_sound : ConflictBSound := by
  intro c d
  simp [conflictB, Conflict, List.any_eq_true, bne_iff_ne]

theorem conflict_symm : ConflictSymm := by
  intro c d h
  obtain ⟨hne, ht | ⟨f, hf, g, hg, ho⟩⟩ := h
  · exact ⟨fun e => hne e.symm, Or.inl ht.symm⟩
  · exact ⟨fun e => hne e.symm, Or.inr ⟨g, hg, f, hf, by rw [overlap_symm]; exact ho⟩⟩

theorem conflict_irrefl (c : Claim) : ¬ Conflict c c := fun h => h.1 rfl

theorem admit_safe : AdmitSafe := by
  intro cs c h
  unfold admit
  split
  · rename_i hall
    have hc : ∀ d ∈ cs, ¬ Conflict c d := by
      intro d hd hcd
      have hb := (List.all_eq_true.mp hall) d hd
      have : conflictB c d = true := (conflictB_sound c d).mpr hcd
      simp [this] at hb
    intro x hx y hy
    simp only [List.mem_cons] at hx hy
    rcases hx with rfl | hx <;> rcases hy with rfl | hy
    · exact conflict_irrefl _
    · exact hc y hy
    · exact fun hxy => hc x hx (conflict_symm _ _ hxy)
    · exact h x hx y hy
  · exact h

theorem release_safe : ReleaseSafe := by
  intro cs keep h x hx y hy
  simp only [release, List.mem_filter] at hx hy
  exact h x hx.1 y hy.1

theorem admit_refuses_conflict : AdmitRefusesConflict := by
  intro cs c d hd hcd
  unfold admit
  have : ¬ (cs.all (fun d => !conflictB c d) = true) := by
    intro hall
    have hb := (List.all_eq_true.mp hall) d hd
    have : conflictB c d = true := (conflictB_sound c d).mpr hcd
    simp [this] at hb
  simp [this]

theorem saves_counted : SavesCounted := by
  intro v es
  induction es generalizing v with
  | nil => simp [runSaves]
  | cons e es ih =>
    by_cases he : e = v
    · have h1 := ih (v + 1)
      simp only [runSaves, save, if_pos he, if_true]
      omega
    · have h1 := ih v
      simp only [runSaves, save, if_neg he]
      simp only [Bool.false_eq_true, if_false]
      omega

theorem stale_all_fail (v k : Nat) : runSaves (v + 1) (List.replicate k v) = (v + 1, 0) := by
  induction k with
  | zero => simp [runSaves]
  | succ k ih =>
    simp only [List.replicate, runSaves, save]
    have : ¬ (v = v + 1) := by omega
    simp [this, ih]

theorem burst_exactly_one : BurstExactlyOne := by
  intro v k
  have h := stale_all_fail v k
  simp only [List.replicate, runSaves, save, if_pos rfl, if_true, h]

theorem noDupFrom_iff (seen l : List String) : noDupFrom seen l = true ↔ ((∀ x ∈ l, x ∉ seen) ∧ l.Nodup) := by
  induction l generalizing seen with
  | nil => simp [noDupFrom]
  | cons x xs ih =>
    simp only [noDupFrom]
    by_cases hx : seen.contains x = true
    · have hmem : x ∈ seen := by simpa using hx
      simp only [hx, if_true]
      constructor
      · intro h; cases h
      · intro ⟨h, _⟩; exact absurd hmem (h x (List.mem_cons_self x xs))
    · have hmem : x ∉ seen := by simpa using hx
      simp only [hx, if_false, Bool.false_eq_true]
      rw [ih (x :: seen), List.nodup_cons]
      constructor
      · intro ⟨h, hn⟩
        refine ⟨?_, ?_, hn⟩
        · intro y hy
          rcases List.mem_cons.mp hy with rfl | hy
          · exact hmem
          · exact fun hs => h y hy (List.mem_cons_of_mem _ hs)
        · exact fun hxs => h x hxs (List.mem_cons_self x seen)
      · intro ⟨h, hxs, hn⟩
        refine ⟨?_, hn⟩
        intro y hy hys
        rcases List.mem_cons.mp hys with rfl | hys
        · exact hxs hy
        · exact h y (List.mem_cons_of_mem _ hy) hys

theorem noDup_sound : NoDupSound := by
  intro l
  rw [noDup, noDupFrom_iff]
  simp

theorem reach_increases (E : List (Nat × Nat)) (pos : Nat → Nat) (h : ∀ e ∈ E, pos e.1 < pos e.2) :
    ∀ {a b : Nat}, Reach E a b → pos a < pos b := by
  intro a b r
  induction r with
  | edge he => exact h _ he
  | trans _ _ ih1 ih2 => omega

theorem witness_acyclic : WitnessAcyclic := by
  intro E pos hw a r
  have h : ∀ e ∈ E, pos e.1 < pos e.2 := by
    intro e he
    have := (List.all_eq_true.mp hw) e he
    simpa using this
  have := reach_increases E pos h r
  omega

end Coord
