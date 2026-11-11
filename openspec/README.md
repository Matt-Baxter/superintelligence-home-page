# OpenSpec in this repository

Two spec systems, one source of truth each:

- **Spec Kit** (`specs/NNN-*/spec.md`) holds REQ-001..REQ-064 with their user stories, and `docs/SPEC_TRACE.md` traces each to code and checks. Approvals happen there (both partners).
- **OpenSpec** (`openspec/`) is how work is planned and how agents see the whole system:
  - `config.yaml`: context and the rules proposals, tasks and specs follow (after the layout used by `Volland/oxilite`'s `openspec/`).
  - `specs/<capability>/spec.md`: **generated** from Spec Kit by `node scripts/openspec.js sync`, using `capabilities.json` (which REQs make up each capability). Don't edit them by hand.
  - `changes/<id>/`: new work, as `proposal.md` (Why, What Changes, Impact), `design.md` (decisions with rejected alternatives), `tasks.md` (numbered, tagged `[agent]`, `[rules]` or `[people]`, gates first) and spec deltas (`## ADDED Requirements`, each with SHALL or MUST and WHEN/THEN scenarios). A change cites the REQ ids it serves; `capabilities.json` lists them under `inChanges` until the change is archived.

Commands: `npm run openspec -- check` (preflight runs it), `npm run openspec -- sync`, and `npm run openspec:validate` for the OpenSpec CLI's own validator (the generated specs keep the proposed REQs' SHOULD, so its strict mode flags them; the changes pass strict).
