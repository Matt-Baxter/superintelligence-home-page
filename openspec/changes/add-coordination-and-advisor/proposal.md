# Change: Planning and coordination for people and agents, and the advisor

Built on `feature/paper-responses-2026-11-11` at John's request (extended version only). Serves REQ-068..REQ-071
(`specs/009-coordination-and-advisor/spec.md`), proposed and not approved. Depends on `add-data-layer-and-builders`
(sources, actions, artifacts) and reads what `add-graph-model-and-flywheel` exports (node types and shapes).

## Why

Two people and several AI agents work on one repo, from Spec Kit tasks and OpenSpec changes, on many branches. Nothing
said who was working on what, so agents picked the same task, edited files another branch was rewriting, or edited a
shared document; in the builder, a re-plan or an edit could silently replace someone else's newer version. Picking what
to do next meant reading every task list by hand. And the gaps between the specs, OpenSpec, the data model and the
bindings (an untraced requirement, a view bound to a missing source, an unlogged table) were found only when preflight
failed or a page broke.

## What Changes

- **Work items**: every Spec Kit and OpenSpec task in one shape, with its files (from the task text), requirements,
  dependencies (a Spec Kit gate, an OpenSpec Gate section, "after T123") and who may take it (`[agent]`, `[rules]`,
  `[people]`).
- **Planner**: open tasks ranked for a person or an agent, each with the points behind its rank (unblocks, MUST/SHOULD,
  approved, open suggestions, phase, collisions); initiatives grouped by requirement.
- **Claims**: leases on a task and its files (2 h for an agent, a day for a person, 15 min presence for an open page),
  refused on collision with the holder and expiry named; a person may force and the override is recorded; agents
  can't. Open branches that change the same files (from git) are warned about. Shared documents need both partners.
- **Stale writes refused**: builder edits, re-plans and restores carry the version they were made against and are
  refused (409) if a newer one exists, naming who saved it.
- **Advisor**: rules over Spec Kit, OpenSpec, tables, shapes, sources, actions, view bindings, validation and
  learnings; each finding has a draft and its file, shared documents are marked, and people accept or dismiss.
- **Agents**: `npm run work` (next, claim, release, check, who, board, advise, brief, sync), MCP tools
  (`work_brief`, `work_next`, `work_check`, `work_claim`, `work_release`, `work_who`, `work_advise`), and the guard hook
  refuses an edit to a file someone else holds or to a shared document.
- **Work board** page (`/m/work`, admins).

## Impact

- New module `work` (requires `data`, `project`); tables `work_claims`, `work_advice`; sources `work.items`,
  `work.next`, `work.initiatives`, `work.claims`, `work.conflicts`, `work.check`, `work.advice`, `work.brief`; actions
  `work.claim`, `work.release`, `work.advice-mark`.
- `responses.edit-line`, `responses.replan` and `data.restore` accept `expectVersion`.
- Agent kit: seven MCP tools; the guard hook reads `out/work/claims.json`.
- Free tiers: no polling, no new services; claims prune themselves after 30 days.
