---
name: bakeoff-entry
description: Build or update a bake-off version of the homepage experience on its own branch, keep it within the contract, and prepare it for scoring by the decision model (CLEF or JEV). Use when working on bakeoff/claude-matt or bakeoff/v0-john.
---

# Work on a bake-off version

Our project is a mix: the shared base (accounts, data, API, deploy) is built once, and the homepage experience (feed, grouping and tagging, weekly brief) is built twice and compared. See "Mini bake-offs" in [docs/CONTRACT.md](../../../docs/CONTRACT.md).

1. **Stay on your branch**: `bakeoff/claude-matt` (Matt, Claude) or `bakeoff/v0-john` (John, v0). Don't read or copy from the other bake-off branch until both are submitted for scoring; that keeps the comparison fair.
2. **Stay inside the contract.** Use only the API routes and data models in `docs/CONTRACT.md`. You may change anything internal: UI, ranking, tagging approach, page layout. If you need a new route or field, that's a contract change (use the change-the-contract skill) and the other version gets it too.
3. **Check the criteria** before building. If `docs/BAKEOFF.md` doesn't exist yet, remind the humans to agree on the comparison criteria and weights first (for example correctness on the tests, speed, code size, fit to the contract). Don't invent the criteria for them.
4. **Keep the shared test green.** `npm test` must still pass on your branch. Add tests for anything new.
5. **Record what the agent did.** In the PR description, list which agent and model built what, and what the human verified by hand. Mistakes the agent made go in the Agent log page, written by the human in their own words. Don't write those entries.
6. **Submit for scoring** by opening a PR into `main` titled `Bake-off: <name> (<agent>)`, marked as draft. Don't merge. The humans run the decision model on both PRs, sign off, and log the result in the contract.
