/-
  FinalCheck.lean: pins every coordination and element-catalog result (REQ-069, REQ-072, proposed).
  For each theorem: (1) its type is exactly the trusted statement in CoordinationSpec.lean, and
  (2) `#guard_msgs` fails the build unless `#print axioms` reports exactly the axioms listed, all
  from Lean's standard set (propext, Quot.sound, Classical.choice). No `sorry`, no added `axiom`,
  no `native_decide`. Then small concrete cases (the smallest inputs first) check that the
  definitions say what the code does; test/coordination-lean.js runs the same definitions on
  generated inputs and compares them with the JavaScript.
-/
import Coordination

namespace Coord.FinalCheck
open Coord

example : OverlapSymm := overlap_symm
/-- info: 'Coord.overlap_symm' depends on axioms: [propext] -/
#guard_msgs in
#print axioms overlap_symm

example : OverlapRefl := overlap_refl
/-- info: 'Coord.overlap_refl' depends on axioms: [propext] -/
#guard_msgs in
#print axioms overlap_refl

example : ConflictBSound := conflictB_sound
/-- info: 'Coord.conflictB_sound' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms conflictB_sound

example : ConflictSymm := conflict_symm
/-- info: 'Coord.conflict_symm' depends on axioms: [propext] -/
#guard_msgs in
#print axioms conflict_symm

example : AdmitSafe := admit_safe
/-- info: 'Coord.admit_safe' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms admit_safe

example : ReleaseSafe := release_safe
/-- info: 'Coord.release_safe' depends on axioms: [propext] -/
#guard_msgs in
#print axioms release_safe

example : AdmitRefusesConflict := admit_refuses_conflict
/-- info: 'Coord.admit_refuses_conflict' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms admit_refuses_conflict

example : SavesCounted := saves_counted
/-- info: 'Coord.saves_counted' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms saves_counted

example : BurstExactlyOne := burst_exactly_one
/-- info: 'Coord.burst_exactly_one' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms burst_exactly_one

example : NoDupSound := noDup_sound
/-- info: 'Coord.noDup_sound' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms noDup_sound

example : WitnessAcyclic := witness_acyclic
/-- info: 'Coord.witness_acyclic' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms witness_acyclic

/-! ## Smallest inputs and named cases -/
#guard !overlap "" "" && !overlap "" "a.js"
#guard overlap "a.js" "a.js"
#guard !overlap "a.js" "b.js"
#guard overlap "modules/sample/" "modules/sample/x.js"
#guard overlap "modules/sample/x.js" "modules/sample/"
#guard !overlap "modules/sam/" "modules/sample/x.js"
#guard !overlap "modules/sample.js" "modules/sample/x.js"
#guard overlap "modules/sample/**" "modules/sample/a/b.js"
#guard noDup [] && noDup ["a"] && !noDup ["a", "b", "a"]
#guard runSaves 3 [] == (3, 0)
#guard runSaves 3 [3, 3, 3] == (4, 1)
#guard runSaves 3 [3, 4, 5] == (6, 3)
#guard (admit [] ⟨"t1", "agent:a", ["x/"]⟩).length == 1
#guard (admit [⟨"t1", "agent:a", ["x/"]⟩] ⟨"t2", "agent:b", ["x/y.js"]⟩).length == 1
#guard (admit [⟨"t1", "agent:a", ["x/"]⟩] ⟨"t2", "agent:a", ["x/y.js"]⟩).length == 2
#guard orderWitness [(0, 1), (1, 2)] id && !orderWitness [(0, 1), (1, 0)] id

end Coord.FinalCheck
