# verification

Scores formal-proof claims in stories by how far they have actually been checked, and by whom.

| Rung | Points | Matched by (examples) |
| --- | --- | --- |
| Formal proof claimed | 3 | Lean, Coq, Isabelle, proof assistant, machine-checked, formalization, Mathlib |
| Statement checked against a reference | 5 | comparator, matches Mathlib's statement, second independent kernel, standard axioms, no sorry |
| Checked outside the authors | 7 | independent team, outside researchers, external audit, third-party verification |

A **fidelity gap** (weaker than, does not correspond, mistranslation, mismatch) is flagged in the `why` line: the formal
statement compiled, but it is not the claim, so the claim isn't established. The points then credit the outside check,
never the original claim.

Why the ladder exists: in autumn 2026 three formal-math stories showed the difference between "it compiles" and "it's
the theorem we said". Anthropic reported a Lean formalization of Fermat's Last Theorem whose final statement a
comparator checked against Mathlib's and which a second kernel rechecked; researchers at Cambridge and King's College
London reported that OpenAI's Lean formalization of its Navier-Stokes proof states weaker results than its prose; and
Axiom released a Lean formalization of the Stacks Project linked tag by tag to the original text. Sources are in the
Learn concept `statement-fidelity`.

- Extension points: `analysis.signals` (factor "Machine-checked", max 7).
- Routes, pages, tables: none.
- Headless logic and checks: `verification.js`, `test/verification-unit.js` (run by preflight).
- Spec: serves no REQ; listed under "Beyond the spec" in `docs/SPEC_TRACE.md` (extended and research versions only).
