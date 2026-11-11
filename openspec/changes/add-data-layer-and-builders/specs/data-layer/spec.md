## ADDED Requirements

### Requirement: Sources
A module SHALL be able to register a named source with a description, typed parameters, a visibility (public, signed-in or admin) and a function that returns JSON. The system SHALL refuse to run a source for a request that may not read it, and SHALL reject parameters that don't match their types.

#### Scenario: A reader runs a public source
- **WHEN** a signed-in reader asks for a source whose visibility is "signed-in" with valid parameters
- **THEN** the source's JSON is returned

#### Scenario: A reader asks for an admin source
- **WHEN** a signed-in reader who isn't an admin asks for an admin source
- **THEN** the request is refused with 403 and the source isn't run

### Requirement: Actions
A module SHALL be able to register a named action with a description, an input schema, a permission (signed-in or admin) and a function that makes the change. Every run SHALL validate its input, check the permission and write one admin audit row naming the action.

#### Scenario: An admin runs an action
- **WHEN** an admin runs `responses.edit-line` with a valid input on a Sample response (test data)
- **THEN** the change is made, a new version is saved and the audit log has a `data.action` row for it

#### Scenario: Bad input
- **WHEN** an action's input is missing a required field or exceeds a length limit
- **THEN** it is refused with 400 naming the field, and nothing changes
