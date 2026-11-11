# Tasks: Planning and coordination for people and agents, and the advisor

**Spec**: [spec.md](spec.md)

Same tags as `specs/004-parity/tasks.md`: `[agent]` any agent on a `feature/` branch, `[rules]` only when a person asks, `[people]` John and Matt decide. **Format**: `- [ ] T### [who] [REQ-0xx] description (files)`.

## Phase 0: approval

- [ ] T900 [people] [REQ-068] Approve, change or drop REQ-068..REQ-071, and decide whether claims live in the shared Neon database (every machine sees them) or stay local.

## Phase 1: built on feature/paper-responses-2026-11-11

- [x] T910 [agent] [REQ-068] Work items from Spec Kit and OpenSpec with files, gates and "after" dependencies (modules/work/items.js)
- [x] T911 [agent] [REQ-068] Ranked next steps with reasons, and initiatives by requirement (modules/work/planner.js)
- [x] T912 [agent] [REQ-069] Claims with leases, collision checks, presence, open-branch overlap (modules/work/claims.js, modules/work/overlap.js)
- [x] T913 [agent] [REQ-069] Stale-version refusal for builder writes and restore (modules/responses/data.js, modules/data/module.js)
- [x] T914 [agent] [REQ-070] The advisor's rules and drafts, accept and dismiss (modules/work/advisor.js)
- [x] T915 [agent] [REQ-071] CLI, MCP tools, agent brief and the guard hook's claim and shared-document checks (scripts/work.js, agent-kit/mcp/server.js, agent-kit/hooks/guard.js)
- [x] T916 [agent] [REQ-068] Work board page (modules/work/pages/work.html) and unit checks (test/work-unit.js)

## Phase 2: later

- [ ] T920 [agent] [REQ-069] Make the builder's version check atomic inside the save transaction (modules/responses/store.js, modules/data/artifacts.js)
- [ ] T921 [agent] [REQ-070] Let the advisor open a draft branch with the accepted, non-shared suggestions applied, for a person to review (scripts/work.js)
- [ ] T922 [agent] [REQ-068] Learn the planner's weights from which suggestions people take, and report them as proposals (modules/work/planner.js)
- [ ] T923 [people] [REQ-071] Decide whether the shared Neon database should hold claims (needs DATABASE_URL on agents' machines)
