## ADDED Requirements

### Requirement: Claims that refuse collisions
A claim on a task SHALL be refused when another actor holds the same task or overlapping files, naming the holder and the expiry; a person MAY force it and the override SHALL be recorded; an agent MUST NOT force it.

#### Scenario: Second claim refused
- **WHEN** a Sample user holds a folder and another claims a file inside it
- **THEN** the second claim is refused with status 409 and the first user is named

### Requirement: Stale writes refused
A builder write that names the version it was made against SHALL be refused when a newer version exists, naming who saved it.

#### Scenario: Two editors
- **WHEN** two Sample users edit version 1 and the first saves
- **THEN** the second save is refused and nothing is overwritten
