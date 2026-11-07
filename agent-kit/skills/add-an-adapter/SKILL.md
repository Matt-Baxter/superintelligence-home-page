---
name: add-an-adapter
description: Add one pluggable piece through its registry - a tagger, embedder, si-expr rule or operator, schema type or generator (zod, pydantic, protobuf/gRPC, Arrow, JSON-LD, OpenRPC, Rust), JSON-RPC method or extension point - so it works across every runtime. Use when asked to add a tagger, a tag source, an embedding model, a rule, a type, a format or a protocol, or to make something "pluggable".
---

# Add an adapter

Every pluggable piece is an entry in a registry (`lib/registry.js`: `register`, `get`, `list`, `create` for factories). Ids are kebab-case, and every output carries qualified ids (`namespace:id`, docs/NAMING.md). Pick the row, follow its one step, then run the check.

| You're adding | Where | The one step | Check |
| --- | --- | --- | --- |
| **A tagger** (a new kind of tag) | core: `lib/taggers/index.js`; module: `ctx.point("knowledge.taggers").add({...})` | `{ id, about, namespace, tag(text) -> [{ qid, label, matched, method, via?, score? }], edges?() }`. Return the words that matched, so the tag can explain itself. | `node test/expr-unit.js`; Knowledge page "Build" |
| **An embedder** | `modules/knowledge/knowledge.js` → `embedders.register` | `{ id, about, make(opts) -> { id, dims, embed(text) } }`. Paid or remote models are off by default (free tier). | `/api/knowledge/similar` |
| **A rule** (a decision as data) | `lib/rules/<name>.json` `{ about, version, input, output, rule }` | Write it with the builder (`lib/expr/build.js`): `when(c).then(x)...otherwise(y)`, `v.text.firstMatch(...)`. Run it with `expr.run(name, data)` or JSON-RPC `knowledge.evaluate`. | Add vectors to `test/expr-vectors.json`; `npm run expr:check` |
| **An si-expr operator** | Node: `lib/expr/eval.js` `register`; Python: `interop/python/si_expr.py`; Rust: `interop/rust/si-expr/src/lib.rs`; docs: `lib/expr/spec.json` | Implement it in all three with the same semantics (no regex features, so behaviour is identical), and give it an `si.` name. | `npm run expr:check` fails if one runtime is missing it; CI's Interop job covers WebAssembly |
| **A type or field** | `schema/types.json` | Add it (`string`, `int`, `float`, `bool`, `datetime`, `json`, `T[]`, `T?`, `Enum`, `Type`; `ld` for a JSON-LD term), then `npm run schema` and update `schema/examples.json`. | `node scripts/schema.js check --runtimes` |
| **An output format** | `lib/schema/generators/<id>.js` | `{ id, file, about, generate(model, { ordered, header }) -> text }`. It's picked up automatically. | Same as above; add a runtime load to `scripts/schema.js` |
| **A JSON-RPC method** | `schema/types.json` `services.Knowledge.methods` and `METHODS` in `modules/knowledge/routes.js` | Declare its input and output types (OpenRPC and gRPC are generated), then implement `run(params)`. Params are checked with the generated zod schema. | `POST /api/knowledge/rpc` |
| **An extension point** | Kernel: `kernel/kernel.js` `declare(...)`; a module: `register(env)` → `env.registerExtensionPoint` | Owner declares; others contribute through `ctx.point(id)`. Modules never import each other's files. | `npm run preflight` (modules check) |

Then run `npm run preflight`: naming, rules and schemas, codemap and smoke. Log any new route, table or response shape in `docs/INTERFACES.md`. Read `references/patterns.md` when you need to know why things are shaped this way.
