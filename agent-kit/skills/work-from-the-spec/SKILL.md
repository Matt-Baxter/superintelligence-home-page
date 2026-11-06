---
name: work-from-the-spec
description: Tie any piece of work to the shared spec - find the REQ IDs it serves, check it's in scope under the constitution, use the Spec Kit commands (specify, clarify, plan, tasks), and keep docs/SPEC_TRACE.md current so preflight passes. Use at the start of any task, when asked "which REQ is this?", "is this in scope?", or before opening a pull request.
---

# Work from the spec

The [shared spec](../../../specs/001-superintelligence-homepage/spec.md) (REQ-001 to REQ-020, user stories with Given/When/Then, success criteria SC-001 to SC-008) and the [constitution](../../../.specify/memory/constitution.md) decide what gets built.

1. **Find the REQ IDs** the task serves. Read the spec's requirements and the closest user story. No REQ fits? Then it's out of scope (constitution III): tell the human, and offer to add it to the spec (change-the-contract skill) instead of building it.
2. **Check the principles** that bite most often: superintelligence focus (when in doubt, leave it out), simplicity first (no dependency or abstraction no REQ needs), synthetic test data, no Twitter/X.
3. **Use Spec Kit for spec work**: `/speckit-clarify` for open questions (REQ-020, REQ-010's session length), `/speckit-plan` and `/speckit-tasks` per build, `/speckit-analyze` to check spec, plan and tasks agree.
4. **Build with traceability**: commit messages and the PR start with the REQ IDs (`REQ-003: …`); tests are named by REQ or scenario ID (`US1-5`, `SC-003`).
5. **Update the trace** in `docs/SPEC_TRACE.md`: where the REQ lives and which check proves it. Preflight fails when a REQ in the spec isn't traced, or the trace cites a REQ that doesn't exist. The table format and how to trace scenarios: `references/trace.md`.
6. **Track it** on the Project page (`/m/project`) with a `REQ-0xx` label.
