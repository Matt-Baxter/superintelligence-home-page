Built on `feature/paper-responses-2026-11-11` at John's request (extended version only). Serves REQ-061..REQ-064
(`specs/007-data-and-builders/spec.md`), all proposed and not approved: they need both partners.

## Why

The paper responses and the json-render Studio each keep their own state. A response is one JSON blob that is replaced
on every build; edits, renders, QA results and drafts aren't connected to each other or to the paper they came from.
Studio views bind only to data a module baked into the spec when it was built, and a button can only navigate. So
nothing can be edited in place, nothing has a history, and "which claims across our papers have no result in the
body?" can't be asked at all.

## What Changes

- **Data layer** (new `data` module): two extension points. `data.sources` are named, read-only bindings
  (parameters, who may read them, `run`). `data.actions` are named writes (validated input, who may run them, `run`),
  each logged in the admin audit. Routes list and run both.
- **Artifacts with versions**: any module saves an artifact (`kind`, `key`) as numbered versions with a note, the
  actor and file references (the newest 20 kept). Restoring makes a new version.
- **Knowledge graph store**: papers, claims, evidence, checks, plans, renders, drafts and learnings as RDF, queried
  with SPARQL. oxilite (`@oxilite/node`, Oxigraph-compatible, on a SQLite file) where its native build loads; else
  Oxigraph compiled to WebAssembly, saved to the app database after each write. Connections between artifacts, papers
  and drafts are triples, so the builder can show and query them.
- **Response builder** (`/m/builder`): pick a response, edit its spoken lines, re-plan, queue a render, read QA and
  learnings, see versions and connections; every change is an action and a new version.
- **Studio bindings and actions**: a spec may carry `bindings` (state path → source and params), resolved on the
  server, and buttons may run actions (`runAction`) and refresh the bindings.

### New Capabilities
- `data-layer`: sources, actions, permissions, audit.
- `artifact-store`: versioned artifacts with file references.
- `knowledge-graph`: the RDF store, its engines and its vocabulary.
- `builders`: the response builder and Studio bindings.

## Impact

- **Code:** `modules/data/` (new), `modules/responses/` (contributes sources and actions, writes artifacts and triples,
  builder page), `views/actions.mjs` and `modules/generative-ui/` (bindings, `runAction`), `scripts/learn-worker.js`
  (a render stores its files, QA and learnings as a new version).
- **Dependencies:** `oxigraph` (WebAssembly, about 9 MB, MIT/Apache-2.0); `@oxilite/node` as optional (its prebuilt
  binary is macOS arm64 only today).
- **Data:** tables `data_artifacts`, `data_artifact_versions`, `data_kg_snapshots`. The spec version's tables are
  unchanged.
- **Hard rules that bind it:** free tiers (no polling; the graph snapshot is pruned), no Twitter/X, no claims put in a
  real person's mouth (the graph stores the paper's claims as the paper's), synthetic test data, nothing posted.
- **Deploy:** a Vercel preview of this branch, made by the agent at John's explicit request as an exception to
  CLAUDE.md's "never deploy" rule. Matt should know; production is untouched.
