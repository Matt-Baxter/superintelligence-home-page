# Manifest: everything the handoff points at

Until the humans merge it, this folder and spec 003 live on branch `feature/judge-fidelity-spec`; the MoE toy lives on `feature/paper-watch-2026-11-07-b`. Both start from `fix/sync-with-main`.

| Group | Files |
| --- | --- |
| Rules for agents | `AGENTS.md`, `CLAUDE.md`, `agent-kit/` (skills, subagents, guard hook, MCP server), `docs/NAMING.md` |
| What gets built | `specs/001-superintelligence-homepage/spec.md` (shared, approved), `.specify/memory/constitution.md`, `CONTRACT.md`, `WORKING_AGREEMENT.md` |
| Proposed work | `specs/002-research-layer/spec.md` (REQ-021..031), `specs/003-judge-fidelity/` (`spec.md`, `plan.md`, `tasks.md`, `research.md`; REQ-032..040) |
| Traceability | `docs/SPEC_TRACE.md`, `docs/SPEC_STATUS.md`, `docs/INTERFACES.md`, `docs/PLAN_NEXT.md` |
| Project tracker | `scripts/project-sync.js` (proposals and tasks from every `specs/<nnn>/`, agent jobs, scheduled work), `modules/project/sync.json`, `/m/project` |
| Judges | `modules/review/review.js` (Review desk), `modules/review/dossier.js`, `lib/analysis.js`, `lib/ontology.json` |
| Measures | `bench/` (`baseline.json`, `review-set.json`, `judge-edge-cases.json`), `scripts/bench.js`, `test/judge-edge-cases.js`, `scripts/preflight.js` |
| Paper watch | `scripts/watch.js`, `modules/review/watch.json`, `.github/workflows/paper-watch.yml`, `handoff/routines/paper-watch.md` |
| Paper-to-code | `modules/lab/papers.js`, `modules/lab/runners.js`, `modules/lab/examples.json`, `modules/lab/results.json`, `test/papers-unit.js` |
| Lean | `modules/learn/data/concepts.json` (toy statements), `scripts/learn-worker.js` (`lean-proof` jobs); spec 003 adds `proofs/` (tasks T005, T051) |
| Tools | `docs/V0.md` (v0 setup), `handoff/prompts/codex.md`, `handoff/prompts/v0.md` |
| Not in the repo | `out/` (gitignored: watch digests, dossier drafts, the local database). Regenerate with the routine. |
