## 1. Plan

- [x] 1.1 [agent] OpenSpec beside Spec Kit: config, capability specs generated from specs/ (scripts/openspec.js), this change
- [x] 1.2 [agent] Spec Kit entry with REQ-061..REQ-064 (specs/007-data-and-builders) and trace rows

## 2. Data layer

- [x] 2.1 [agent] `data` module: `data.sources` and `data.actions` points, input schema, permissions, audit (modules/data)
- [x] 2.2 [agent] Artifacts with versions and file references, restore as a new version
- [x] 2.3 [agent] Knowledge graph adapter: oxilite when it loads, else Oxigraph WebAssembly with snapshots in the database

## 3. Builders

- [x] 3.1 [agent] Paper responses contribute sources and actions, save versions and write their graph
- [x] 3.2 [agent] Response builder page (/m/builder)
- [x] 3.3 [agent] Studio: `bindings` resolved on the server, `runAction` and `refresh`
- [x] 3.4 [agent] Learn worker: a render stores files, QA and learnings as a new version

## 4. Checks and preview

- [x] 4.1 [agent] Unit and route checks on synthetic data (test/data-unit.js)
- [x] 4.2 [agent] Vercel preview of this branch (exception to CLAUDE.md requested by John)
- [ ] 4.3 [people] Approve, change or drop REQ-061..REQ-064, and decide whether the graph is worth a dependency
- [ ] 4.4 [agent] oxilite on Linux and Vercel once a linux-x64 prebuilt is published (then oxilite is the only engine)
