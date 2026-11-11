# Change: Element descriptors, interoperability and formal checks

Built on `feature/paper-responses-2026-11-11` at John's request (extended version only). Serves REQ-072..REQ-075
(`specs/010-element-descriptors/spec.md`), proposed and not approved. Depends on `add-data-layer-and-builders` (sources,
actions, the knowledge graph), `add-graph-model-and-flywheel` (the SHACL validator) and `add-coordination-and-advisor`
(work items, claims).

## Why

The same facts about an element lived in many places in many shapes: columns in SQL strings, fields in
schema/types.json, parameters in the data registry, tasks in markdown, another repo's conventions in its own
markdown. Nothing said a table's grain or what a row means, which names people use for it, whether it is kept forever
or leased, or how it grows; nothing checked rows against keys and shapes; and the coordination rules were tested but
not proved. Plugging in another repository meant writing a new tool each time.

## What Changes

- **Portable descriptor** (`packages/si-elements`, no dependencies): id, kind, description, aliases, tags,
  properties, keys and surrogates, grain, relationships (direction, cardinality, via, on delete, acyclic),
  constraints, lifecycle, series, graph class; validation, completeness, overlays, alias resolution, SHACL (core plus
  SHACL-SPARQL for keys), N-Quads, JSON-LD, rows as quads, row checks, the relationship DAG.
- **Providers** through `elements.providers`: tables (from the schema SQL), types (schema/types.json), data
  operations, modules, requirements and tasks, learnings, and a vibe-coding checkout; a reviewed `overlay.json`.
- **Checks on data**: keys, grain, required, enums, vocabularies, references, acyclic rows and SHACL on rows; the SHACL
  validator gains `sh:minInclusive`, `sh:maxInclusive` and `sh:maxLength`.
- **Formal checks**: Lean statements (trusted file), proofs, a final check pinning axioms, a manifest, and a
  differential test against the running code.
- **Agents and people**: `npm run elements`, MCP tools `elements_describe`, `elements_report`, `elements_check_vibe`,
  page `/m/elements`, data sources `elements.*`, action `elements.export`.

## Impact

- New module `elements` (requires data, graph, work); no tables.
- New folder `packages/si-elements`; Lean libraries `CoordinationSpec`, `Coordination`, `FinalCheck` in `proofs/`.
- Free tiers: no services; the catalog is computed from files and cached for 30 s.
