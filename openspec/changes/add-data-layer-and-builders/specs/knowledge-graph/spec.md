## ADDED Requirements

### Requirement: One store, two engines
The system SHALL keep the knowledge graph in oxilite (on a SQLite file) when its native package loads, and otherwise in Oxigraph's WebAssembly build, saving an N-Quads snapshot to the app database after every write and loading it on start. It SHALL report which engine is in use, and SHALL refuse a write that would take the snapshot over 20,000 triples.

#### Scenario: Survives a restart
- **WHEN** a Sample response (test data) is saved and the store is opened again from the database
- **THEN** a SPARQL query finds the same claims

#### Scenario: Engine reported
- **WHEN** the native oxilite package can't load on this platform
- **THEN** the store reports the Oxigraph engine and still answers SPARQL

### Requirement: Read-only queries from outside
SPARQL sent through the data layer SHALL be read-only: SELECT, ASK, CONSTRUCT or DESCRIBE. Updates SHALL be made only by actions.

#### Scenario: An update is refused
- **WHEN** an admin sends `DELETE WHERE { ?s ?p ?o }` to the query source
- **THEN** it is refused with 400 and the graph is unchanged

### Requirement: Claims stay the paper's
A claim in the graph SHALL be linked to the paper that states it (`si:claimedBy`) and SHALL NOT be attributed to a person.

#### Scenario: Claims of a Sample paper
- **WHEN** the claims of a Sample response are queried
- **THEN** each has a level and is claimed by the Sample paper, and none names a person
