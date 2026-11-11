import Lake
open Lake DSL

-- REQ-038 (T005): the review judge's arithmetic as a core Lean 4 library. No Mathlib, no dependencies.
package judge where

@[default_target]
lean_lib Judge where

-- REQ-069, REQ-072 (proposed): coordination and element-catalog statements (trusted) and their proofs.
lean_lib CoordinationSpec where
  leanOptions := #[⟨`autoImplicit, false⟩]

lean_lib Coordination where
  leanOptions := #[⟨`autoImplicit, false⟩]

lean_lib FinalCheck where
  leanOptions := #[⟨`autoImplicit, false⟩]
