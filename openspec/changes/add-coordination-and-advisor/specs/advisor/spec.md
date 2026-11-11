## ADDED Requirements

### Requirement: Suggestions with drafts
The system SHALL report gaps between the specs, OpenSpec, the data model, sources, actions, bindings, shapes and learnings, each with a draft and the file it belongs in, and MUST NOT apply a suggestion to a shared document.

#### Scenario: One finding per gap
- **WHEN** Sample facts (test data) contain an unmapped requirement, a view bound to a missing source and an unlogged table
- **THEN** each produces one finding with a draft, and errors are listed first

### Requirement: Accept and dismiss
The system SHALL record whether a person accepted or dismissed a suggestion, and a dismissed suggestion SHALL stay dismissed while it is unchanged.

#### Scenario: Dismissal sticks
- **WHEN** a suggestion is dismissed and the advisor runs again
- **THEN** it is left out unless dismissed suggestions are asked for
