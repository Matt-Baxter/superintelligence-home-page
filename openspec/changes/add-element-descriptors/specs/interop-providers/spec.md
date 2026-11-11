## ADDED Requirements

### Requirement: Providers plug in
Modules and other repositories SHALL add descriptors through providers, and relationship targets SHALL resolve through aliases.

#### Scenario: Another repository
- **WHEN** a Sample vibe-coding checkout (test data) is read
- **THEN** a repeated prompt number and a missing context block are reported, and the conforming project has no problems
