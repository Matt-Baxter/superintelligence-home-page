# Design: Element descriptors, interoperability and formal checks

## Decisions

- **Generate what code knows; review what it can't.** Columns, keys, references, indexes and parameters are read from
  the code each time. Meaning, grain where no key states it, aliases, tags, retention and cadence come from
  `overlay.json`, a reviewed file; overlay ids that match nothing are reported. Property descriptions inferred from
  names are marked `inferred`.
- **Grain from keys.** A composite primary key is the grain ("one row per user per story"); a surrogate with a natural
  key is one row per natural key; otherwise the overlay says it, and completeness says when nobody has.
- **Keys in SHACL-SPARQL.** SHACL core can't express uniqueness, so key sets are emitted as standard `sh:sparql`
  constraints for other tools, and checked here by `checkRows`.
- **Rows as typed quads.** A value is typed with its declared datatype only when it fits, so a bad value reaches the
  shape as a plain string and is reported rather than coerced.
- **Direction.** Relationships point from the referencing element to the referenced one; the load order is the
  reverse topological order (referenced tables first). Self-references are trees and don't count as cycles.
- **Providers are plugins.** `{ id, about, describe(ctx), rows?(id, ctx) }` through `elements.providers`; another
  repository is one more provider (the vibe-coding one reads `CONVENTIONS.md` and `prompts.md`).
- **Formal checks after public Lean projects.** A trusted statement file separate from proofs, `#guard_msgs` on
  `#print axioms`, a `formalization.yaml` manifest, no `sorry`/`axiom`/`native_decide`, negative controls, and a
  differential test so the model can't drift from the code (it found one divergence on the first run).

## Risks / Trade-offs

- Inferred descriptions can be wrong in detail; they are labelled.
- The Lean model abstracts paths, forced claims and the lock; `formalization.yaml` lists each divergence.
