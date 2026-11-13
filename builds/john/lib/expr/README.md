# si-expr: rules as JSON that every runtime can run

Rules (what puts a story in scope, how a tag explains itself, which chunk matches a concept) are written as **JSON abstract syntax trees**, not code. One rule file then runs the same way in Node (the site), Python (workers, notebooks, pydantic/pyarrow pipelines), Rust, and WebAssembly (browser or edge).

## The language

si-expr is a strict superset of [JSONLogic](https://jsonlogic.com). Every node is either a literal (string, number, boolean, null, array) or an object with exactly one key, the operator: `{"op": args}`. Because of that, any JSONLogic interpreter (`json-logic-js`, `json-logic-py`, `datalogic-rs`, Go, Java, .NET) already runs the core of a rule. Our extra operators carry the `si.` prefix.

| Operator | Meaning |
| --- | --- |
| `var`, `if`, `and`, `or`, `!`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `cat`, `+`, `-`, `*`, `min`, `max`, `some`, `all`, `map`, `filter` | JSONLogic core (`var` takes dotted paths and an optional default) |
| `si.match` `[text, term]` | The term matcher used by the ontology, lowercased: the matched words, or `null`. Matching is case-insensitive and whole-word (no letter or digit just before, or just after without `*`); a trailing `*` also takes the rest of the word, hyphens included. |
| `si.first_match` `[text, [terms]]` | The first term in the list that matches, or `null` |
| `si.matches` `[text, [terms]]` | Every matching term, de-duplicated |
| `si.count` `x` | The length of an array or string |
| `si.unique` `[array]` | Remove duplicates, keeping order |
| `si.let` `[{name: expr}, body]` | Bind names, then evaluate `body` with them added to the data |
| `si.obj` `{key: expr}` | Build an object (each value is evaluated) |
| `si.tpl` `[template, data]` | Fill `{{name}}` placeholders. Arrays are joined with ", ". |

`spec.json` is the machine-readable list (operators, arity, purpose) and is checked against every interpreter.

## Interpreters

| Runtime | File | How |
| --- | --- | --- |
| Node | `lib/expr/eval.js` | `require("./lib/expr").evaluate(rule, data)` |
| Python | `interop/python/si_expr.py` | `from si_expr import evaluate` (no dependencies) |
| Rust, and WebAssembly from the same crate | `interop/rust/si-expr` | `si_expr::evaluate(&rule, &data)`; `cargo build --target wasm32-unknown-unknown` |

`test/expr-vectors.json` holds the shared test vectors (rule, data, expected result). `npm run expr:check` runs them in every runtime that's installed, and preflight runs the Node set.

## Writing rules

- **As JSON:** see `lib/rules/*.json`. The REQ-003 scope rule is `lib/rules/scope.json`.
- **With the builder** (`lib/expr/build.js`): `when(cond).then(a).when(cond2).then(b).otherwise(c)` builds an `if` chain.
- **With "magic" expressions:** a Proxy builds the tree as you write.
  - In Node, `v.text.firstMatch(v.strong)` gives `{"si.first_match": [{"var": "text"}, {"var": "strong"}]}`.
  - `v.tops.count().gte(v.min_topics)`, `a.and(b)`, `x.not()`.
  - In Python, operator overloading does the same: `(V.tops.count() >= V.min_topics) & ~V.hidden`.
