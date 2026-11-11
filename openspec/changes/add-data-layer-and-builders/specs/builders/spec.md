## ADDED Requirements

### Requirement: Response builder
An admin SHALL be able to open a response in a builder page, edit a spoken line, re-plan with a different length limit, queue a render for the worker, save the article as a draft, and see the response's versions, QA results, learnings and connections. Each change SHALL be an action that saves a new version.

#### Scenario: Edit a line
- **WHEN** an admin changes a line of a Sample response (test data) in the builder
- **THEN** a new version holds the new line, the plan's checks are rerun on it and the response's graph matches it

#### Scenario: Hidden with the feature
- **WHEN** the paper responses feature flag is off
- **THEN** the builder's sources and actions answer 404 like the rest of paper responses

### Requirement: Studio bindings and actions
A json-render spec SHALL be able to bind state paths to sources (`bindings`), resolved on the server with the viewer's permissions, and its buttons SHALL be able to run an action and refresh the bindings.

#### Scenario: A bound view
- **WHEN** a view binds `/responses` to `responses.list` and an admin opens it
- **THEN** the view's state holds the live list of responses

#### Scenario: A source the viewer can't read
- **WHEN** a spec binds a path to an admin source and a reader opens it
- **THEN** that path is left empty with an error note and the rest of the view renders
