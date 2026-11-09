# Verification map

2026-11-09, feature branch only. Synthetic fixture databases; no production deployment, live-content accuracy or training improvement is claimed. Shared requirements and publication approvals are unchanged.

| Claim | Requirement scope | Evidence | Boundary |
| --- | --- | --- | --- |
| Judge arithmetic bounds, monotonicity and bands | 003/REQ-038 | `proofs/Judge.lean`, pinned Lean4.15.0;58 theorems compile | Inputs are marker/count values, not text parsing or source truth |
| Existing Learn toy statements | 002/REQ-024/026 |3 checked toy theorems; two statements incomplete | Toy assumptions do not prove real-world superintelligence claims |
| No unfinished/custom assumptions in checked statements | 003/REQ-038 |61 transitive theorem axiom audits; only propext, Classical.choice, Quot.sound allowed | Trust includes Lean's kernel/compiler/toolchain; not a proof of toolchain correctness |
| Lean model agrees with current JS-derived vectors | 003/REQ-038 |384 actual Lean evaluator comparisons;25088 JS vector checks | Bounded correspondence testing, not formal verification of JavaScript/IEEE arithmetic |
| Authorized proof queue reaches a real worker | 002/REQ-024,003/REQ-038 | `test/lean-worker-e2e.js`: HTTP admission, SQL queue, actual Lean invocation, artifact and status read-back | Only disposable local fixture servers; manual Lean completion is rejected |
| Incomplete statements cannot be claimed done by the worker | 002/REQ-024 | Mathlib-dependent attention statement remains needs-agent | This does not complete the attention or softmax proofs |
| Proof checks preserve publication boundary | 002/REQ-024/025 | Worker results remain done/needs-agent; guest401 and reader403 | Human/admin publishing remains separate; no deployment tested |
| Entity grouping and provenance persist honestly | 001/REQ-004/005/007 | Real SQLite/Postgres grouping plus HTTP identity checks | Generic title heuristics and old contaminated mappings remain known limits |
| Product flows and layouts remain operable | 001/REQ-018 and existing extended features | Two-user browser suite on SQLite and Postgres | Local synthetic evidence; no production availability/performance claim |

## Repeat the proof checks

```bash
npm run test:proofs
```

Use an installed toolchain or set `LAKE=/absolute/path/to/lake`. The command builds the pinned model, compiles the3 Learn toys, checks transitive axioms, validates current JavaScript vectors, runs actual Lean evaluation and fails on any mismatch. Missing Lean is a failure, never a skipped pass. The generated evaluator needed `maxRecDepth8192` to compile its long output sequence; this changes an elaboration resource limit, not theorem assumptions.

After the full suite creates synthetic john/matt accounts on an isolated fixture server:

```bash
BASE=http://localhost:3201 DATA_DIR=<disposable-si-test-directory> LEAN=<lean-binary> npm run test:proof-worker
```

For Postgres use the matching disposable local `DATABASE_URL` ending in `_test` and fixture port3301. Never point these checks at the preserved preview or public database. They create queue records. File artifacts are retained in a temporary directory for inspection. Browser/API checks and worker artifacts prove tested flow outcomes, not universal correctness.

## Worker admission and receipts

`lib/lean-proof.js` supplies the same axiom policy to the model checker and Learn worker. For curated Learn statements it also asks Lean to elaborate an inhabited proposition, rejecting numeric definitions that are not proofs. The worker stores a proof source, audit source and JSON receipt with source SHA256, actual tool version and per-theorem assumptions before reporting done. These hashes bind bytes; they are not independent signatures or evidence of source truth. Checking never publishes a result. The queue E2E now also injects a synthetic custom-axiom theorem into an isolated worker child and requires a persisted failed job with no acceptance receipt. Latest SQLite and Postgres results:11 passed,0 failed each; browser336/0 each; real admission9/0.

`LEAN=<lean-binary> npm run test:proof-admission` exercises real compiler rejection, a Lean-accepted sorry, a Lean-accepted false theorem depending on a custom axiom, missing/duplicate/wrong reports, and completed proof acceptance. This is explicit runtime testing; missing Lean fails rather than silently skipping. Lean sources remain controlled repository content, not untrusted uploads or a code sandbox. The admin API and CLI reject manual Lean completion. Requeue detaches previous result and receipt references. Historical jobs marked done before this gate retain their stored status.

## Remaining gaps

- T050 si-expr arithmetic extraction and T051 rule-representation correspondence remain open; T052 records this bounded verified slice.
- Two Learn statements need mathematical definitions/libraries and completed proofs.
- The fixed-hype credibility bound is not a bound on arbitrary real-text edits; text can change both rigor and hype.
- Known judge edge/property gaps remain visible in preflight; a passing regression gate does not erase them.
- Source ingestion health, research insight accuracy, training rights and model improvement require separate evidence. The last private intake attempt did not complete analysis.
- Public exposure, shared specification changes and publication still follow partner/admin approvals.

Measured runtime results are recorded in [LOGIC_AUDIT.md](LOGIC_AUDIT.md); the narrower formal model and detailed assumptions are in [proofs/README.md](../proofs/README.md).
