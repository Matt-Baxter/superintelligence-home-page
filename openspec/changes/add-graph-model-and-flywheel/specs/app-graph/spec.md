## ADDED Requirements

### Requirement: The system as a typed graph
The system SHALL export its modules, extension points, blocks, sources, actions, pages, routes, tables, requirements, capabilities, skills, hard rules, learnings and checks as typed nodes with directed edges into one named graph, regenerated from the code and documents, never edited by hand.

#### Scenario: A requirement's trace becomes edges
- **WHEN** the app graph is exported
- **THEN** REQ-061 is a node with a `tracedTo` edge to the data module and a `checkedBy` edge to its unit check

### Requirement: Shapes for every node type
The system SHALL check the app graph against SHACL shapes (target class, property path, minimum and maximum count, datatype, class, allowed values, pattern) and SHALL report each violation with the node, the path and a message.

#### Scenario: A learning without a guard
- **WHEN** a Sample learning node (test data) has no guard
- **THEN** validation reports a violation on its `si:guard` path

#### Scenario: Clean graph
- **WHEN** the real app graph is validated
- **THEN** there are no violations, or each one is listed in the report
