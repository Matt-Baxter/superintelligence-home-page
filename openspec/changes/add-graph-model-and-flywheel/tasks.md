## 1. Phase 1 (built)

- [x] 1.1 [agent] App graph export into `urn:si:app` (modules/graph/appgraph.js)
- [x] 1.2 [agent] SHACL-core validator and shapes for every node type (modules/graph/shacl.js, shapes.ttl)
- [x] 1.3 [agent] DAG check with topological order; quantified path patterns; A* with landmarks (modules/graph/algorithms.js)
- [x] 1.4 [agent] Flywheel: each learning names its rule; recall by mutation; evolutionary tuning with an overtraining stop (modules/graph/flywheel.js)
- [x] 1.5 [agent] `npm run graph -- report`, Data and graph page panel, bench suite `graph`, unit checks (test/graph-unit.js)

## 2. Gate for phase 2

- [ ] 2.1 [people] Approve REQ-065..REQ-067, and say which use cases the ensembles should serve (paper triage, explainer planning, offering)
- [ ] 2.2 [agent] Phase 1 recall at 100% and no SHACL violations on main for one week

## 3. Phase 2: learned graph representations

- [ ] 3.1 [agent] GraphSAGE encoder (mean aggregator, two layers) trained by link prediction on the app and event graphs; held-out edges for AUC
- [ ] 3.2 [agent] Q-learner over graph walks using the embeddings as state (discovery paths that end at unguarded or untraced nodes)
- [ ] 3.3 [agent] Sample example generator per node type from embedding neighbourhoods, validated by the shapes before use
- [ ] 3.4 [agent] Compare shapes with oxilite's native SHACL (rudof) where it runs

## 4. Phase 3: ensembles and benchmarks

- [ ] 4.1 [rules] Ensembles (A* plan, learned offering, hand rule) per use case, benchmarked on the same held-out weeks
- [ ] 4.2 [rules] Adopt any evolved values only when a person asks (REQ-029)
