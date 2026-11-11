Phase 1 built on `feature/paper-responses-2026-11-11` at John's request (extended version only); phases 2-3 planned
and gated. Serves REQ-065..REQ-067 (`specs/008-graph-model-and-flywheel/spec.md`), proposed and not approved. Depends
on `add-data-layer-and-builders` (the knowledge graph store).

## Why

The system is made of typed things (modules, extension points, blocks, sources, actions, pages, tables, specs,
requirements, skills, hard rules, learnings, checks) with directed relations between them, but those relations live
only in code and prose. So nothing checks that a requirement is traced, that a module's dependencies form a DAG, that
every learning is guarded, or finds what a change touches. And the learnings ledger records problems, but nothing
measures whether the system remembers them (does each guard still catch its problem?) or whether a tuning loop is
fitting its training cases rather than getting better.

## What Changes

- **App graph** (phase 1): every element above becomes a typed node in the knowledge graph (`urn:si:app`), with
  directed edges (`requires`, `contributes`, `serves`, `guards`, `reads`, `writes`, `owns`, `derivedFrom`).
- **SHACL shapes** (phase 1): one shape per node type (`openspec`-style constraints made checkable): a requirement
  is traced, a learning has a cause, a fix and a guard, an action declares its access, a module's requires point at
  modules. A SHACL-core validator (targetClass, property paths, min/max count, datatype, class, in, pattern)
  reports violations; they become QA findings.
- **Graph algorithms** (phase 1): DAG checks with a topological order; quantified path patterns
  (`(a)-[:rel]->{m,n}(b)` with filters) for discovery paths; A* over the graph with an admissible heuristic from
  landmark distances. (Phase 2, gated: a GraphSAGE encoder trained by link prediction, a Q-learner that walks the event
  graph with those embeddings, and generated Sample examples for each node type from its embedding neighbourhood.)
- **Learning flywheel** (phase 1): insight → learning → rule (a shape or a check) → validation → recall. Recall is
  measured by mutation: each guarded learning has a mutant that reintroduces its problem, and the guard must catch it.
  An evolutionary loop (selection, crossover, mutation, elitism) tunes the production model's learner on training
  weeks and is scored on held-out weeks, so the train-to-held-out gap shows overtraining; the loop stops when that
  gap passes a stated threshold, and reports generations-to-plateau as time to learn.
- **Ensembles and benchmarks** (phase 3, gated): the A* plan, the learned offering and the hand rule vote per use
  case, benchmarked against single members on the same held-out weeks.

### New Capabilities
- `app-graph`: typed nodes, edges, shapes and their validation.
- `graph-algorithms`: DAG, quantified path patterns, A*; later GraphSAGE and graph Q-learning.
- `learning-flywheel`: rules from learnings, recall by mutation, evolutionary tuning with an overtraining stop.

## Impact

- **Code:** `modules/graph/` (new), `modules/responses/learnings.json` (each learning names its rule), bench suite
  `graph`. No new runtime dependency (the validator and algorithms are plain JS over the existing store).
- **Hard rules that bind it:** evolutionary and learned tuning only proposes; adopting a rule that changes scoring is a
  `[rules]` task a person asks for (REQ-029). Synthetic data only. Results of simulations are labelled as such.
