## ADDED Requirements

### Requirement: One list of work
The system SHALL collect every task from the Spec Kit and OpenSpec task lists with its files, requirements, dependencies and who may take it.

#### Scenario: Gates and dependencies
- **WHEN** a Sample task list (test data) has a gate line and a task that says "after T910"
- **THEN** the tasks below the gate wait for it, and the later task depends on T910

### Requirement: Ranked next steps with reasons
The system SHALL rank the open tasks a person or an agent may take, and each score SHALL equal the sum of its listed reasons.

#### Scenario: Agents get agent work
- **WHEN** an agent asks for its next tasks
- **THEN** no `[people]` task and no unasked `[rules]` task is offered, and the task that unblocks the most ranks first
