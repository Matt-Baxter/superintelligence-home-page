# si-elements

One portable descriptor for any element of a system, and the generators that make it interoperable. No
dependencies; copy the folder into any repository (`require("./si-elements")`).

A descriptor (`element.schema.json`) says what an element is (`id` as `kind:name`, `kind`, `description`, `aliases`,
`tags`, `owner`), its `properties` (type, required, unique, unit, enum, pattern, min/max, maxLength), its `keys`
(surrogate, primary, natural, unique), its `grain` ("one row per ..."), its `relationships` (rel, target, direction,
cardinality, via, inverse, on delete, acyclic), `constraints`, `lifecycle` (perpetual, versioned, leased, append-only,
ephemeral, generated; retention), `series` (time, cadence, order, retention, partition) and `graph` (RDF class).

| Function | Does |
| --- | --- |
| `validate(d)` | structural problems (unknown kind or type, keys that aren't properties, bad direction or cardinality) |
| `completeness(d)` | a score and the named things missing (description, tags, lifecycle; for data: properties, keys, grain, property descriptions, series) |
| `merge(d, overlay)` | add reviewed facts (aliases, tags, grain, property notes) without losing generated ones |
| `aliasIndex(descs)` | resolve any name people use to one element; report aliases two elements claim |
| `toShacl(descs)` | SHACL shapes: core property shapes, and keys as SHACL-SPARQL constraints |
| `toQuads(descs)`, `toJsonLd(descs)` | the descriptors themselves as N-Quads (`urn:si:elements`) or JSON-LD |
| `rowToQuads(d, row)` | a record as typed quads in `urn:si:data:<id>`; a value that doesn't fit its type stays a plain string so a shape reports it |
| `checkRows(d, rows, { lookup })` | required, keys, grain, enums, vocabularies, references, acyclic rows |
| `dag(descs)` | the relationship graph with direction; whether relations declared acyclic form a DAG; a topological order |

Used by `modules/elements` in the Superintelligence Homepage (REQ-072..REQ-075, proposed). The claims, key-check and
DAG-witness rules it relies on are proved in Lean in `proofs/` (`npm run test:coordination-proofs`).
