# Tasks: Element descriptors, interoperability and formal checks

**Spec**: [spec.md](spec.md)

Same tags as `specs/004-parity/tasks.md`. **Format**: `- [ ] T### [who] [REQ-0xx] description (files)`.

## Phase 0: approval

- [ ] T000 [people] [REQ-072] Approve, change or drop REQ-072..REQ-075, and read proofs/CoordinationSpec.lean against the code (the trusted statements need a person).

## Phase 1: built on feature/paper-responses-2026-11-11

- [x] T010 [agent] [REQ-072] Portable descriptor, JSON Schema and generators (packages/si-elements/index.js, packages/si-elements/element.schema.json)
- [x] T011 [agent] [REQ-072] Table descriptors from the schema SQL (modules/elements/sql.js)
- [x] T012 [agent] [REQ-073] Providers for types, operations, modules, plans and learnings, the reviewed overlay, the extension point (modules/elements/providers.js, modules/elements/overlay.json, modules/elements/module.js)
- [x] T013 [agent] [REQ-073] Provider for a vibe-coding checkout (modules/elements/vibe.js)
- [x] T014 [agent] [REQ-074] Row checks and SHACL on rows; numeric and length constraints in the validator (modules/graph/shacl.js)
- [x] T015 [agent] [REQ-075] Lean statements, proofs, final check and manifest (proofs/CoordinationSpec.lean, proofs/Coordination.lean, proofs/FinalCheck.lean, proofs/formalization.yaml)
- [x] T016 [agent] [REQ-075] CLI, MCP tools, Elements page, unit and Lean differential checks (scripts/elements.js, modules/elements/pages/elements.html, test/elements-unit.js, test/coordination-lean.js)

## Phase 2: later

- [ ] T020 [agent] [REQ-075] Second-kernel check of the pinned results with comparator and nanoda when they can be installed (proofs/)
- [ ] T021 [agent] [REQ-074] Write property descriptions for the elements still missing them (modules/elements/overlay.json)
- [ ] T022 [people] [REQ-073] Decide whether the vibe-coding repo should vendor packages/si-elements and run its check in CI
