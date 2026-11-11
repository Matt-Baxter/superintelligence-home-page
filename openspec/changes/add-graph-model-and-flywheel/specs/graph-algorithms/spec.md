## ADDED Requirements

### Requirement: Dependencies form a DAG
The system SHALL check that module requirements form a directed acyclic graph and SHALL return a topological order, or the cycle when there is one.

#### Scenario: A Sample cycle
- **WHEN** Sample modules a requires b and b requires a (test data)
- **THEN** the check reports the cycle a → b → a

### Requirement: Quantified path patterns
The system SHALL find every path from a start node that follows a given relation between m and n times and ends at a node matching a filter, and SHALL return the paths themselves.

#### Scenario: Two to three hops
- **WHEN** a pattern asks for paths of 2 to 3 `requires` hops from the responses module
- **THEN** each returned path has 2 or 3 hops and only `requires` edges

### Requirement: Shortest paths with A*
The system SHALL find shortest paths between two nodes with A* using a landmark lower bound, and SHALL return the same length as breadth-first search.

#### Scenario: Same as BFS
- **WHEN** A* and BFS search the app graph between a page and a table
- **THEN** both return the same number of hops and A* expands no more nodes
