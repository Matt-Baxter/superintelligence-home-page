# Feature Specification: Data layer and builders (extended version)

**Feature Branch**: `feature/paper-responses-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Built at John's request; nothing here is in scope for the bake-off until both partners approve it. Extended version only (`SITE_PROFILE=extended`); the shared spec is unchanged.

**Design and plan**: this feature is planned as an OpenSpec change: [openspec/changes/add-data-layer-and-builders](../../openspec/changes/add-data-layer-and-builders/proposal.md) (proposal, design, tasks and spec deltas with scenarios). This file carries the REQ ids the commits and the trace cite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An editor changes a response in place (Priority: P2)

An admin opens the response builder, edits a spoken line, re-plans for a shorter video, restores an earlier version and queues a render; every step is an audited action and a new version, and the knowledge graph shows what the response is connected to.

**Independent Test**: On a Sample response (test data), edit-line saves version 2, replan version 3, restore version 4 with the original line, and SPARQL finds the paper's unbacked claims and the draft linked to the response.

### User Story 2 - A Studio view reads live data and runs actions (Priority: P3)

A spec binds state paths to named sources; the server resolves them as the viewer; a button runs a data action and the view refreshes.

**Independent Test**: A spec bound to `responses.list` shows the live list for an admin; for a reader, an admin-only binding is left empty with the reason and the view still renders.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-061**: In the extended version, modules SHOULD read through named sources and write through named actions that one data layer runs, checking the reader's or actor's permission and the input against a declared schema, and writing an audit row for every action.
- **REQ-062**: Generated work (responses, renders, drafts) SHOULD be kept as versioned artifacts (newest 20 versions, each with a note, the actor and file references), where restoring an earlier version makes a new one and deletes nothing.
- **REQ-063**: Papers, claims, evidence, checks, plans, renders, drafts and their connections SHOULD be kept in a knowledge graph queried with read-only SPARQL, stored in oxilite where its native package loads and otherwise in Oxigraph (WebAssembly) saved to the app database, within a stated triple limit; claims stay the paper's, never a person's.
- **REQ-064**: Admins SHOULD be able to edit responses in a builder page through those actions, and json-render views SHOULD bind state to sources (resolved on the server as the viewer) and run actions from buttons.

## Success Criteria *(mandatory)*

- **SC-701**: Every action run appears in the admin audit log, and every refused input names the field.
- **SC-702**: A graph write survives reopening the store, and a query that tries to change the graph is refused with nothing changed.
