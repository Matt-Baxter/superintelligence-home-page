import Lake
open Lake DSL

-- REQ-038 (T005): the review judge's arithmetic as a core Lean 4 library. No Mathlib, no dependencies.
package judge where

@[default_target]
lean_lib Judge where
