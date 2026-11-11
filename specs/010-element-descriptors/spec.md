# Feature Specification: Element descriptors, interoperability and formal checks (extended version)

**Feature Branch**: `feature/paper-responses-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Built at John's request; extended version only; the shared spec is unchanged.

**Design and plan**: [openspec/changes/add-element-descriptors](../../openspec/changes/add-element-descriptors/proposal.md). This file carries the REQ ids.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every element says what it is the same way (Priority: P3)

An admin or an agent looks up any table, type, data operation, module, requirement, task or learning, by its id or a word people use for it ("bookmark", "req:REQ-056"), and reads its properties, keys and surrogate, grain, relationships with direction and cardinality, constraints, lifecycle, series, aliases and tags, and the SHACL shape generated from them.

**Independent Test**: The catalog describes every table in the schema SQL with keys, a grain, a lifecycle and tags; Sample rows of every table pass their keys, grain and references and conform to their shapes; a duplicated or incomplete Sample row fails both.

### User Story 2 - Another repo's records plug in (Priority: P3)

A provider for another repository (a vibe-coding checkout's prompts.md files) turns its conventions into descriptors and its records into rows, so the same checks find a repeated prompt number, a missing context block or a tag outside its list.

**Independent Test**: A Sample checkout (test data) with one conforming and one messy project: every problem in the messy one is found, none in the conforming one.

### User Story 3 - The coordination and catalog rules are proved, and the proofs match the code (Priority: P3)

The claims invariant, the stale-write rule, the key check and the DAG witness are stated in Lean, proved without `sorry` or extra axioms, pinned in a final check, and compared with the running code on generated inputs.

**Independent Test**: The Lean build passes with pinned axioms; a `sorry` proof and a false statement fail; the Lean definitions and the code agree on every generated input.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-072**: In the extended version, the system SHOULD describe each element (tables, types, data operations, modules, requirements, tasks, learnings) with one portable descriptor (properties, keys and surrogates, grain, relationships with direction and cardinality, constraints, lifecycle, series, aliases, tags) and SHOULD generate SHACL shapes, N-Quads and JSON-LD from it.
- **REQ-073**: Descriptors SHOULD come from providers that modules and other repositories plug in, merged with a reviewed overlay, with relationship targets resolved through aliases and conflicting aliases reported.
- **REQ-074**: The system SHOULD check an element's rows against its keys, grain, required properties, vocabularies, references and acyclic constraints, and against its generated shape, reporting each problem.
- **REQ-075**: The coordination and catalog rules SHOULD be stated and proved in Lean with pinned axioms and no `sorry`, recorded in a machine-readable manifest, and compared with the running code on generated inputs; agents SHOULD be able to read any descriptor through the agent kit.

## Success Criteria *(mandatory)*

- **SC-1001**: Every table has keys, a grain, a lifecycle and tags; mean descriptor completeness is at least 0.95.
- **SC-1002**: Relations declared acyclic form a DAG and no relationship points at nothing.
- **SC-1003**: Every Lean result uses only standard axioms, and the Lean definitions agree with the code on every generated input.
