## ADDED Requirements

### Requirement: One descriptor per element
Each element SHALL have one descriptor with its properties, keys, grain, relationships, constraints, lifecycle, series, aliases and tags, and the system SHALL generate SHACL, N-Quads and JSON-LD from it.

#### Scenario: A table described from its SQL
- **WHEN** a Sample table with a composite primary key and a reference is read
- **THEN** its grain is one row per key combination and its relationship keeps direction, cardinality and on delete
