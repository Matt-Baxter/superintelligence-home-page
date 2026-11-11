## ADDED Requirements

### Requirement: Learnings become rules
Each learning SHALL name its rule (a shape, a QA check or a unit check), and the system SHALL report the stage each learning has reached: recorded, ruled, validated or recalled.

#### Scenario: Stages counted
- **WHEN** the flywheel report runs
- **THEN** it lists every learning with its stage and the share that are recalled

### Requirement: Recall by mutation
For each learning guarded by a QA check, the system SHALL build a synthetic case that reintroduces the problem, and SHALL count the learning as recalled only when its guard fails on that case and passes on the corrected one.

#### Scenario: Drift is remembered
- **WHEN** a Sample render whose picture is 0.8 s shorter than its voice (test data) is checked
- **THEN** the sync check fails, and on the matching render it passes

### Requirement: Evolution with an overtraining stop
An evolutionary tuning loop SHALL score each generation on training cases and on held-out cases, SHALL stop when held-out fitness hasn't improved for 3 generations or the train-minus-held-out gap exceeds a stated threshold, and SHALL report generations to plateau, the best held-out fitness and the gap. Its results SHALL be proposals for a person, never adopted automatically.

#### Scenario: The loop stops and reports
- **WHEN** the loop runs with a fixed seed on the production model
- **THEN** it reports its stopping reason, the generation it stopped at, and the train and held-out fitness of the best member
