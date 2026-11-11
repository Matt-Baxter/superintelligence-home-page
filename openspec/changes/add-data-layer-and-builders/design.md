## Context

Today a paper response is one row (`responses_papers.package`) rewritten on every build, the Studio's views are built
once from data a module chose, and the only json-render actions navigate or copy text. The research layer already
speaks in `namespace:id` ids (`doc:`, `topic:`, `concept:`) and JSON-LD; RDF is a natural home for connections.

## Goals / Non-Goals

- Goals: one way to read (sources) and write (actions) shared by every page and the Studio; history for anything we
  generate; connections you can query; it runs on Vercel Hobby and Neon Free with no paid service.
- Non-goals: moving users, votes or saves out of SQL (the shared spec's tables stay as they are); real-time sync;
  rendering video on the web server.

## Decisions

- **Sources and actions are extension points, not routes per feature.** A module adds `data.sources` and
  `data.actions` entries; the data module owns the routes, permission checks, input validation and the audit row.
  Rejected: each module writing its own `/api/<module>/...` for every read and write (what we had), because permission
  and audit drift between modules. Constraint: names follow docs/NAMING.md (`module.name`).
- **Inputs are checked by a small schema (type, required, max length, enum), not by zod in every module.** The same
  schema renders a form in the builder and documents the action for an LLM writing a Studio spec.
- **Artifacts are versioned rows with file references, not files.** Vercel's filesystem is temporary and Hobby has no
  free blob store worth depending on, so a version keeps JSON and the paths, sizes and hashes of files made elsewhere
  (out/ on the machine that rendered). Rejected: Vercel Blob (paid beyond the free allowance, and a new account
  setting). Newest 20 versions per artifact are kept (free tier).
- **The knowledge graph is RDF with SPARQL, behind one adapter with two engines.** oxilite is the store we want
  (SQLite file, versioned history, Oxigraph-compatible), but its npm package ships only a macOS arm64 binary today; on
  Linux and Vercel it can't load. Oxigraph's WebAssembly build has the same API and runs everywhere; it is in memory,
  so the adapter saves an N-Quads snapshot to `data_kg_snapshots` after each write and loads it on a cold start.
  Rejected: a home-made triple table (no SPARQL), and building oxilite from source in CI (needs Rust and a checkout of
  another repository). Constraint: a snapshot over 20,000 triples is refused with a message, not written (Neon Free).
- **One named graph per response** (`urn:si:response:<slug>`), dropped and rewritten on each save, so a response's
  triples always match its newest version; connections between graphs (a draft made from a response, a render of a
  version) live in `urn:si:links`.
- **Vocabulary** `https://superintelligence-homepage.example/ns#` (`si:`): `si:Paper`, `si:Claim` (`si:level`),
  `si:Check` (`si:met`, `si:points`), `si:Beat`, `si:Artifact` (`si:version`, `si:file`), `si:Learning`; relations
  `si:claims`, `si:evidence`, `si:about`, `si:derivedFrom`, `si:renderOf`, `si:draftOf`. Claims are the paper's
  (`si:claimedBy` the paper), never a person's.
- **Studio bindings resolve on the server.** A spec's `bindings: { "/path": { "source": id, "params": {...} } }` are
  run with the viewer's permissions when the view loads (and on `refresh`), and their results become `state`.
  Rejected: letting the browser call any source directly from a spec (a spec written by an LLM could name a source the
  viewer can't read; the server checks each one).

## Risks / Trade-offs

- Oxigraph in memory on a cold start reads the whole snapshot: fine at today's size (hundreds of triples per paper),
  watched by the 20,000-triple cap.
- Two engines can differ at the edges of SPARQL; the unit check runs the same queries on whichever engine loads.
- Versions add rows on every edit: capped at 20 per artifact, pruned on write.

## Migration Plan

Existing `responses_papers` rows keep working; the first save through an action writes version 1 of the artifact and
the response's graph. Nothing in the spec version changes.
