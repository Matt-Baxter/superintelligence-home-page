---
name: change-the-contract
description: Change what the project is built against the right way - the shared spec, constitution, CONTRACT.md or WORKING_AGREEMENT.md (both partners approve) or this build's own tables, routes and response shapes (logged in docs/INTERFACES.md). Use whenever a change would alter a requirement, a rule, a table, an API route or a request/response shape.
---

# Change the contract

Two kinds of change, two paths.

## Shared documents (both partners)
The [spec](../../../specs/001-superintelligence-homepage/spec.md), the [constitution](../../../.specify/memory/constitution.md), [CONTRACT.md](../../../CONTRACT.md) and [WORKING_AGREEMENT.md](../../../WORKING_AGREEMENT.md) bind both builds.
1. **Stop and say so** to the human: this needs both partners.
2. **Spec changes** go through Spec Kit: `/speckit-specify` to amend, `/speckit-clarify` for open questions. Keep REQ IDs stable; new requirements get the next free ID. Update `docs/SPEC_TRACE.md`.
3. **Constitution changes** bump its version (MAJOR: remove or redefine a principle; MINOR: add or change a rule; PATCH: wording) and add a Sync Impact Report comment.
4. **Log it**: a row in CONTRACT.md's change log, marked proposed, with boxes for both partners. The humans tick them; never tick for them.

## This build's interfaces (the builder)
Tables, columns, API routes, request and response shapes of this build live in [docs/INTERFACES.md](../../../docs/INTERFACES.md). Builds may differ here (constitution: bake-off rules), so the builder decides.
1. Add a row to the INTERFACES.md change log (version, date, what changed, why) and update the affected table or route section.
2. Prefer additive changes (new optional fields, new routes). Breaking changes bump the major version.
3. Name the REQ IDs the change serves; preflight warns when tables or routes change without INTERFACES.md.
