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

## Rules, benchmark and research loop

- **Rules** live in `rules.json` (pattern lists per rung, plus "contextual" terms like "formalized" that count only next
  to a maths word or a proof-checking phrase, so "the deal was formalized" is not a proof claim).
- **Labelled set:** `bench/verification-set.json`, synthetic sentences with the rung and gap they should get, split into
  train and held-out. Add an item whenever a mis-judgement turns up.
- **Scorer:** `evaluate.js` (rung and gap accuracy, false proof claims, missed ones, and invariance under harmless
  rewordings, the same idea as the judge-fidelity invariance tests in specs/003).
- **Research loop:** `npm run verification:ratchet` proposes edits to the rules, keeps one per round only if it strictly
  raises the train score (with rewordings), and accepts the result only if held-out doesn't get worse. `-- --apply`
  writes `rules.json`. Held-out never chooses an edit.
- **Benchmark:** `npm run bench` reports `verification.*` (held-out rung and gap accuracy, false proof claims,
  invariance) and preflight fails on a regression.
- **Lab:** example `autoformalize-statement-gate` (runner `autoformalize-gate`) tests the mechanism behind the signal:
  rewarding "it compiles" teaches weaker statements, and an exact comparator stops it. Our hypothesis, that a comparator
  which spots weakenings only in proportion to their size lets subtle ones through, is supported at toy scale.

**Known limit:** the held-out split was seen while the loop's candidate edits were written (2026-11-09), so it is no
longer blind. A fresh held-out set written by someone who hasn't read `rules.json` is the next step.

- **Alignment:** the same rules drive the score and a `knowledge.taggers` adapter (`machine-checked`), so the Review desk
  and knowledge graph tag Formal verification exactly when the signal scores. The feed's own topic comes from plain
  ontology terms, which can't say "only near a maths word"; `verification.topic_agreement` (0.951 on 2026-11-09) measures
  that gap, and the Statement fidelity concept's terms always cover the topic's (a unit check).

- Extension points: `analysis.signals` (factor "Machine-checked", max 7), `knowledge.taggers` (`machine-checked`).
- Routes, pages, tables: none.
- Headless logic and checks: `verification.js`, `evaluate.js`, `test/verification-unit.js` (run by preflight).
- Spec: serves no REQ; listed under "Beyond the spec" in `docs/SPEC_TRACE.md` (extended and research versions only).
