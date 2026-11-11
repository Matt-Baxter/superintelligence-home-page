## ADDED Requirements

### Requirement: Proved and pinned
The coordination and catalog rules SHALL be proved in Lean with no `sorry` and only standard axioms, pinned in a final check, and compared with the running code on generated inputs.

#### Scenario: Negative controls
- **WHEN** a proof uses `sorry` or a false statement is attempted
- **THEN** the build or the audit fails
