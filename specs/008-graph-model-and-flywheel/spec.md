# Feature Specification: The system as a graph, and the learning flywheel (extended version)

**Feature Branch**: `feature/paper-responses-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Phase 1 built at John's request; phases 2-3 are gated tasks. Extended version only; the shared spec is unchanged.

**Design and plan**: [openspec/changes/add-graph-model-and-flywheel](../../openspec/changes/add-graph-model-and-flywheel/proposal.md) (proposal, design, gated tasks, spec deltas). This file carries the REQ ids.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how the system fits together, and where it doesn't (Priority: P3)

An admin asks which elements connect to nothing, which requirements have no check, what a change to one module could reach, and whether the shapes we promised hold.

**Independent Test**: The app graph conforms to its shapes; Sample violations (a learning without a fix or guard, a badly named module, a public action) are each reported; A* paths are as short as BFS.

### User Story 2 - Know that the system remembers what it learned (Priority: P3)

After each change, every learning guarded by a QA check is tested by a mutant that reintroduces its problem; tuning loops show their train and held-out scores and stop when they start to overfit.

**Independent Test**: Recall by mutation is 100% with every corrected case passing; the evolutionary loop reports why it stopped.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-065**: In the extended version, the system SHOULD export its own elements (modules, extension points, blocks, sources, actions, pages, routes, tables, requirements, capabilities, skills, hard rules, learnings, checks) as a typed, directed graph and check it against SHACL shapes, reporting each violation.
- **REQ-066**: The system SHOULD check that module dependencies form a DAG, find quantified path patterns (paths of m to n hops of given relations, returned as paths) and shortest paths with A*, over that graph.
- **REQ-067**: Each learning SHOULD name the rule that guards it and the stage it has reached; the system SHOULD measure recall by mutation, and tuning loops SHOULD report train and held-out scores and stop on a plateau or an overtraining gap, proposing results for a person rather than adopting them.

## Success Criteria *(mandatory)*

- **SC-801**: Recall by mutation is 100% for QA-guarded learnings, with every corrected case passing.
- **SC-802**: The app graph conforms to its shapes on every commit, or the violations are listed in the report.
