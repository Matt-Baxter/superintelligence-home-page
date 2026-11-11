## 1. Phase 1 (built)

- [x] 1.1 [agent] Work items from Spec Kit and OpenSpec (modules/work/items.js)
- [x] 1.2 [agent] Collision checks and the board (modules/work/overlap.js)
- [x] 1.3 [agent] Claims with leases, presence and advice marks (modules/work/claims.js)
- [x] 1.4 [agent] Ranked next steps and initiatives (modules/work/planner.js)
- [x] 1.5 [agent] The advisor (modules/work/advisor.js)
- [x] 1.6 [agent] Stale-version refusal in the builder (modules/responses/data.js, modules/data/module.js)
- [x] 1.7 [agent] CLI, MCP tools, guard hook, work board page, unit checks (scripts/work.js, agent-kit/mcp/server.js, agent-kit/hooks/guard.js, modules/work/pages/work.html, test/work-unit.js)

## 2. Gate

- [ ] 2.1 [people] Approve REQ-068..REQ-071 and decide where claims live (shared Neon database or local)

## 3. Phase 2

- [ ] 3.1 [agent] Atomic version check inside the save transaction (modules/responses/store.js, modules/data/artifacts.js)
- [ ] 3.2 [agent] Draft branch with accepted, non-shared suggestions applied, for review (scripts/work.js)
- [ ] 3.3 [agent] Learn the planner's weights from what people pick, as a proposal (modules/work/planner.js)
