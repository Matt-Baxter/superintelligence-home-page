/-
  CoordinationSpec.lean: the TRUSTED statements for coordination and the element catalog
  (REQ-069, REQ-072, proposed; specs/009 and specs/010). Definitions and statements only:
  no proofs live here. Following the "challenge / solution" split used by formal-math projects
  (a statement file a person reads against the code, a separate file that proves it), this file
  is what a reviewer checks against modules/work/overlap.js, modules/work/claims.js,
  packages/si-elements/index.js and modules/data/artifacts.js. Coordination.lean proves each
  `Statement` below; FinalCheck.lean pins every proof's axioms.

  Plain core Lean 4 (pinned 4.15.0), no Mathlib, no dependencies, `autoImplicit false`.
  What is modelled and what is not: proofs/README.md, "Coordination and elements".
-/
namespace Coord

/-! ## Paths (modules/work/overlap.js, `pathsOverlap`)
  Inputs are normalized paths (no leading `./`, at most one trailing `/`), as the code normalizes
  them first. A path is a folder when it ends in `/` or holds a glob (`*` or `{`); its stem is the
  part before the first glob character. -/

def isGlobChar (ch : Char) : Bool := ch == '*' || ch == '{'
def isDir (p : String) : Bool := p.endsWith "/" || p.any isGlobChar
def stem (p : String) : String := p.takeWhile (fun ch => !isGlobChar ch)

/-- The overlap test for non-empty paths: equal, one a folder holding the other, or both folders and one
  stem holding the other. -/
def overlapCore (a b : String) : Bool :=
  a == b
    || (isDir a && b.startsWith (stem a))
    || (isDir b && a.startsWith (stem b))
    || (isDir a && isDir b && ((stem a).startsWith (stem b) || (stem b).startsWith (stem a)))

/-- Two paths overlap when both are non-empty and `overlapCore` holds. An empty path names nothing, so it
  overlaps nothing (the code returns false first; the differential test found the model needed this). -/
def overlap (a b : String) : Bool := a != "" && b != "" && overlapCore a b

/-! ## Claims (modules/work/claims.js `claim`, overlap.js `check` and `board`) -/

/-- A live, unforced claim: who holds which task and which files. -/
structure Claim where
  task : String
  actor : String
  files : List String

/-- Two claims conflict when different actors hold the same task or overlapping files. -/
def Conflict (c d : Claim) : Prop :=
  c.actor ≠ d.actor ∧ (c.task = d.task ∨ ∃ f ∈ c.files, ∃ g ∈ d.files, overlap f g = true)

/-- The same test as the code computes it. -/
def conflictB (c d : Claim) : Bool :=
  c.actor != d.actor && (c.task == d.task || c.files.any (fun f => d.files.any (fun g => overlap f g)))

/-- SC-901: no two live unforced claims conflict. -/
def Safe (cs : List Claim) : Prop := ∀ c ∈ cs, ∀ d ∈ cs, ¬ Conflict c d

/-- A claim is admitted only if it conflicts with no live claim (unforced claims; forcing is a
  person's override and is reported, not modelled). -/
def admit (cs : List Claim) (c : Claim) : List Claim :=
  if cs.all (fun d => !conflictB c d) then c :: cs else cs

/-- Releasing or expiring claims keeps some of them. -/
def release (cs : List Claim) (keep : Claim → Bool) : List Claim := cs.filter keep

/-! ## Stale writes (modules/data/artifacts.js `save` with `expectVersion`) -/

/-- A save made against version `expect` lands, and bumps the version, only if `expect` is current. -/
def save (v expect : Nat) : Nat × Bool := if expect = v then (v + 1, true) else (v, false)

/-- Saves applied one at a time (the row lock serialises them): the final version and how many landed. -/
def runSaves : Nat → List Nat → Nat × Nat
  | v, [] => (v, 0)
  | v, e :: es =>
    let r := save v e
    let t := runSaves r.1 es
    (t.1, t.2 + (if r.2 then 1 else 0))

/-! ## Keys and grain (packages/si-elements `checkRows`: a `seen` set per key) -/

/-- The checker: walk the key values once, remembering what was seen. -/
def noDupFrom : List String → List String → Bool
  | _, [] => true
  | seen, x :: xs => if seen.contains x then false else noDupFrom (x :: seen) xs

def noDup (l : List String) : Bool := noDupFrom [] l

/-! ## Relationship DAG (packages/si-elements `dag`, the load order in elements.report) -/

/-- Paths along directed edges. -/
inductive Reach (E : List (Nat × Nat)) : Nat → Nat → Prop
  | edge {a b : Nat} : (a, b) ∈ E → Reach E a b
  | trans {a b c : Nat} : Reach E a b → Reach E b c → Reach E a c

/-- A load order witnesses the DAG when every edge goes forward in it. -/
def orderWitness (E : List (Nat × Nat)) (pos : Nat → Nat) : Bool := E.all (fun e => decide (pos e.1 < pos e.2))

/-! ## The statements -/

def OverlapSymm : Prop := ∀ a b : String, overlap a b = overlap b a
def OverlapRefl : Prop := ∀ a : String, a ≠ "" → overlap a a = true
def ConflictBSound : Prop := ∀ c d : Claim, conflictB c d = true ↔ Conflict c d
def ConflictSymm : Prop := ∀ c d : Claim, Conflict c d → Conflict d c
def AdmitSafe : Prop := ∀ (cs : List Claim) (c : Claim), Safe cs → Safe (admit cs c)
def ReleaseSafe : Prop := ∀ (cs : List Claim) (keep : Claim → Bool), Safe cs → Safe (release cs keep)
def AdmitRefusesConflict : Prop := ∀ (cs : List Claim) (c d : Claim), d ∈ cs → Conflict c d → admit cs c = cs
/-- Every successful save bumps the version by exactly one. -/
def SavesCounted : Prop := ∀ (v : Nat) (es : List Nat), (runSaves v es).1 = v + (runSaves v es).2
/-- k + 1 simultaneous saves of the current version: exactly one lands. -/
def BurstExactlyOne : Prop := ∀ v k : Nat, runSaves v (List.replicate (k + 1) v) = (v + 1, 1)
def NoDupSound : Prop := ∀ l : List String, noDup l = true ↔ l.Nodup
def WitnessAcyclic : Prop := ∀ (E : List (Nat × Nat)) (pos : Nat → Nat), orderWitness E pos = true → ∀ a, ¬ Reach E a a

end Coord
