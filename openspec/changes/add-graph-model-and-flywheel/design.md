## Decisions

- **The app graph is generated, not hand-written.** It is read from the kernel (modules, points, contributions),
  the data registry, the codemap (pages, routes, tables), Spec Kit (REQs and traces), the agent kit (skills),
  CLAUDE.md's hard rules (standards) and the learnings ledger, then written as one named graph. Rejected: a curated
  ontology file (drifts from the code, as prose did).
- **SHACL-core in JavaScript, not a full SHACL engine.** We need targetClass, `sh:path` (IRIs and inverse paths),
  min/max count, datatype, class, `sh:in` and `sh:pattern`, with messages. A full engine (SPARQL-based constraints,
  severities, closed shapes) is a dependency no requirement needs yet. oxilite has shape validation (rudof) natively;
  when it runs here, the same shapes file can be checked by it and the results compared (phase 2 task).
- **Quantified path patterns as a bounded search.** SPARQL 1.1 property paths have `*` and `+` but no `{m,n}` and
  can't return the path. A bounded BFS over the in-memory edge list returns each path and enforces m..n hops and
  node filters, so discovery paths can be saved and replayed.
- **A* heuristic from landmarks.** For each of a few landmark nodes, exact hop distances are precomputed; the
  bound max(|d(L,goal) - d(L,n)|) never overestimates on an undirected view, so A* stays optimal; checked against
  BFS in the unit test.
- **Recall by mutation, not by memory.** A learning is remembered when its guard fails on a case that reintroduces
  its problem. Each QA-guarded learning gets a mutant built from synthetic data; recall = caught / mutants.
- **Evolution measures overtraining instead of hiding it.** Fitness is the learner's reward on training weeks; every
  generation is also scored on held-out weeks; the loop stops early when held-out stops improving for 3 generations
  or the train-minus-held-out gap passes 0.4. Rejected: tuning on all weeks (no way to see overfitting).

## Risks / Trade-offs

- The shapes encode our own conventions; a violation means "not as we said we'd build it", not "wrong".
- Evolution on a simulation can only tune the simulation; it proposes values for a person.
