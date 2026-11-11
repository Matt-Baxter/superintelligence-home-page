## ADDED Requirements

### Requirement: Agents use the same coordination
Agents SHALL get the same planning, claims, checks and suggestions through a command line, MCP tools and a brief that includes the hard rules.

#### Scenario: Brief before work
- **WHEN** an agent asks for its brief
- **THEN** it gets the hard rules, who holds what, its next tasks with reasons and how to claim them

### Requirement: The hook stops colliding edits
The agent hook SHALL refuse an edit to a file another actor holds, and to a shared document unless both partners approved.

#### Scenario: Claimed file
- **WHEN** an agent edits a file a Sample user holds
- **THEN** the edit is refused with the holder and expiry, and the holder's own edit is allowed
