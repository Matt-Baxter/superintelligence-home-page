# Feature Specification: Planning and coordination for people and agents, and the advisor (extended version)

**Feature Branch**: `feature/paper-responses-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Built at John's request; extended version only; the shared spec is unchanged.

**Design and plan**: [openspec/changes/add-coordination-and-advisor](../../openspec/changes/add-coordination-and-advisor/proposal.md) (proposal, design, tasks, spec deltas). This file carries the REQ ids.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Know what to do next, and why (Priority: P2)

John, Matt or an agent opens the work board (or asks for a brief) and sees the open tasks they may take from every Spec Kit and OpenSpec task list, ranked, with the points behind each rank: what it unblocks, which requirement it serves, what is still waiting on a decision only people can make.

**Independent Test**: On Sample task lists (test data), the task that unblocks the most and serves an approved MUST ranks first; an agent is never offered a `[people]` task or an unasked `[rules]` task; gated tasks wait.

### User Story 2 - Two people and several agents don't collide (Priority: P2)

Before starting, a person or an agent claims a task and the files it will touch. A claim on the same task, or on files someone else holds, is refused with who holds them and until when. Open branches that change the same files are named. A shared document can't be claimed alone. In the response builder, a save made against an old version is refused, naming who saved in between, and people see who else has the response open.

**Independent Test**: Two Sample users and a Sample agent: the second claim is refused (409) with the holder named; an agent can't force; a person can and the override is recorded; a stale builder save is refused; the guard hook stops an agent editing a claimed file.

### User Story 3 - The specs, plans, data model and bindings tell us what they're missing (Priority: P3)

An admin reads suggestions: a requirement with no trace row (drafted from the files that name it), no task, or no OpenSpec capability (the closest by wording); a table not logged; a node type with no shape; a view bound to a source that doesn't exist; an unbounded string input; a source that skips its module's feature switch; tasks that will edit the same files (in the order to do them). Each has a draft and the file it belongs in; shared documents are marked as needing both partners. Suggestions can be accepted or dismissed.

**Independent Test**: Sample facts with one of each gap produce one finding each with a usable draft; a dismissal sticks across runs.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-068**: In the extended version, the system SHOULD collect every task from the Spec Kit and OpenSpec task lists with its files, requirements, dependencies (gates and "after" references) and who may take it, and SHOULD rank the open tasks a person or an agent may take, explaining each rank point by point.
- **REQ-069**: The system SHOULD let people and agents claim a task and the files it will touch for a limited time, SHOULD refuse a claim that collides with another holder's task or files (naming the holder and expiry) unless a person forces it, SHOULD warn about open branches changing the same files, SHOULD treat shared documents as needing both partners, and SHOULD refuse a builder write made against a version older than the current one.
- **REQ-070**: The system SHOULD report gaps between the specs, OpenSpec, the data model, sources, actions, view bindings, shapes and learnings, each with a drafted addition and the file it belongs in, MUST NOT apply a suggestion to a shared document, and SHOULD record whether a person accepted or dismissed each suggestion.
- **REQ-071**: The system SHOULD give AI agents the same planning, claims, collision checks and suggestions (a command line, MCP tools and a brief), and its agent hook SHOULD stop an agent editing a file someone else holds or a shared document.

## Success Criteria *(mandatory)*

- **SC-901**: No two live claims by different actors hold the same task or overlapping files, except claims a person forced, which are listed as collisions.
- **SC-902**: Every ranked task's score equals the sum of its listed reasons.
- **SC-903**: Every advisor rule runs on the repo without failing, and every finding names a file and carries a draft.

## Assumptions

- Claims are as shared as the database: with the shared Neon database every machine sees the same claims; on local SQLite only that machine does. Open branches are seen by `npm run work -- sync` (git), which needs no service.
- Nothing here assigns work or approves anything; it suggests, and refuses collisions.
