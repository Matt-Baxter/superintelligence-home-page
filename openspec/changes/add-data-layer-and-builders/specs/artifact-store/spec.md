## ADDED Requirements

### Requirement: Versioned artifacts
The system SHALL keep each artifact (a kind and a key) as numbered versions, each with its JSON body, a note, the actor and references to files (path, size, hash). It SHALL keep at most the newest 20 versions of an artifact.

#### Scenario: Save and read back
- **WHEN** a Sample artifact (test data) is saved twice
- **THEN** reading it returns version 2 as current and both versions in its history

#### Scenario: Pruning
- **WHEN** an artifact is saved a 21st time
- **THEN** version 1 is removed and versions 2 to 21 remain

### Requirement: Restore is a new version
Restoring an earlier version SHALL create a new version with that version's body, and SHALL NOT delete any version.

#### Scenario: Restore
- **WHEN** version 1 of a Sample artifact is restored after version 3
- **THEN** version 4 exists with version 1's body and versions 1 to 3 are unchanged
