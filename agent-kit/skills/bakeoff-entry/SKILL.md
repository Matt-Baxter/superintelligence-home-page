---
name: bakeoff-entry
description: Build or update a bake-off version of the whole Superintelligence Homepage against the shared spec and constitution, on its own branch, and prepare it for comparison (weighted criteria, CLEF or JEV). Use when working on bakeoff/claude-matt or bakeoff/v0-john.
---

# Work on a bake-off version

The project is a bake-off (Option B): Matt (Claude Code) and John (v0) each build the **whole site** from the same [constitution](../../../.specify/memory/constitution.md) and [shared spec](../../../specs/001-superintelligence-homepage/spec.md), then compare and merge the best parts. Rules: [CONTRACT.md](../../../CONTRACT.md).

1. **Stay on your branch**: `bakeoff/claude-matt` or `bakeoff/v0-john`. Don't read or copy from the other branch until both are submitted, so the comparison stays fair.
2. **Fixed for both**: the constitution, the spec's REQ IDs and acceptance scenarios, the topic list, the synthetic test data. **Free to differ**: stack, database, framework, internal structure, styling.
3. **Work from the spec** (work-from-the-spec skill): plan with `/speckit-plan`, break down with `/speckit-tasks`, and name REQ IDs in every commit; nothing outside the spec until both partners add it.
4. **Check the criteria** in CONTRACT.md → Decision point before building. If the weights are blank, remind the humans to agree them first. Don't invent them.
5. **Prove each requirement**: every acceptance scenario has a passing test, grouped by REQ ID (constitution IV), and `docs/SPEC_TRACE.md` (or your build's equivalent) maps each REQ to code and test.
6. **Record agent use** in the PR description (which agent built what, what the human checked). Agent mistakes go in the Agent log page, written by the human. Don't write those entries.
7. **Submit for comparison**: a draft PR titled `Bake-off: <name> (<agent>)`. Don't merge. The humans score both on `/m/decide` (run-a-judge skill), sign off, and log the decision in CONTRACT.md.
