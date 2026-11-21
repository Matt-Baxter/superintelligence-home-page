# Patterns used, and where

| Pattern | Where | Why |
| --- | --- | --- |
| **Registry** | `lib/registry.js`, used by taggers, embedders, schema generators, and si-expr operators (`register`) | One place to add, list and look up plug-ins, with validation and kebab-case ids |
| **Adapter** | Taggers (ontology, orgs, benchmarks, people, Learn concepts); embedders (`hash-256`, `minilm`); generators (zod, pydantic, protobuf, Arrow, JSON-LD, OpenRPC, Rust, vocab) | Different sources behind one interface: `tag(text) -> Tag[]`, `embed(text) -> number[]`, `generate(model) -> text` |
| **Factory** | `registry.create(id, options)`; `embedders.create("hash-256", { dims })` | Configured instances without knowing the class |
| **Builder** | `lib/expr/build.js` `when(...).then(...).otherwise(...)`, `obj`, `tpl`, `let_` (Python: `when`, `obj`, `tpl`, `let`) | Write decision trees as code, keep them as data |
| **Metaprogramming and magic methods** | JS Proxy in `lib/expr/build.js`: `v.story.title`, `.and()`, `.gte()`. Python operator overloading in `si_expr.E`: `&`, `\|`, `~`, `>=`, `==`, `+` | Expressions read naturally but produce a portable AST |
| **Interpreter** | `lib/expr/eval.js`, `interop/python/si_expr.py`, `interop/rust/si-expr` (also compiles to WebAssembly) | The same rule file runs everywhere; shared vectors pin the semantics |
| **Templating** | the `si.tpl` operator (`{{path}}`); generators emit source code from the model | Explanations and generated code come from data |
| **Repository** | `lib/expr` `rule(name)` loads `lib/rules/*.json`; routes keep SQL inside the module that owns the table | Callers ask for things by name, not by file or query |
| **Single source of truth** | `schema/types.json` → `schema/gen/*` (checked in CI) | Types can't drift between Node, Python, Rust, protobuf and Arrow |
| **Extension points** | `kernel/kernel.js` (`http.routes`, `db.schema`, `knowledge.taggers`, ...) | Modules plug in without importing each other |
