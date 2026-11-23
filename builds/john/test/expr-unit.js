// si-expr builder, magic expressions and the registry pattern.
const assert = require("assert");
const X = require("../lib/expr");
const { createRegistry } = require("../lib/registry");
const { v, when, obj, tpl, let_, lit } = X;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// Magic expressions build the same JSON a person would write.
ok(JSON.stringify(v.text.firstMatch(v.strong)) === '{"si.first_match":[{"var":"text"},{"var":"strong"}]}', "firstMatch");
ok(JSON.stringify(v.tops.count().gte(v.min_topics)) === '{">=":[{"si.count":{"var":"tops"}},{"var":"min_topics"}]}', "count/gte");
ok(JSON.stringify(v.story.title) === '{"var":"story.title"}', "property access extends a var path");
ok(JSON.stringify(v.a.and(v.b.not())) === '{"and":[{"var":"a"},{"!":{"var":"b"}}]}', "and/not");
ok(v.x.plus(2).times(3).eval({ x: 1 }) === 9, "arithmetic evaluates");
ok(v.missing.default("d").eval({}) === "d", "default");
assert.throws(() => v.x.count().nosuchmethod, /isn.t an si-expr method/); n++; // on a variable, unknown names extend the path instead

// The builder reproduces lib/rules/scope.json exactly.
const r = let_({ term: v.text.firstMatch(v.strong), n: v.tops.count() },
  when(v.term).then(obj({ in: true, rule: "strong", term: v.term, reason: tpl('Superintelligence term: "{{term}}"', { term: v.term }) }))
  .when(v.n.gte(v.min_topics)).then(obj({ in: true, rule: "topics", topics: v.tops, reason: tpl("{{n}} superintelligence topics: {{labels}}", { n: v.n, labels: v.top_labels }) }))
  .when(v.n.eq(1)).then(obj({ in: false, rule: "none", topics: v.tops, reason: tpl("Only one topic ({{label}}) and no superintelligence term", { label: v.top_labels }) }))
  .otherwise(obj({ in: false, rule: "none", topics: v.tops, reason: "No superintelligence topic matched" })));
ok(JSON.stringify(r) === JSON.stringify(X.rule("scope").rule), "builder == lib/rules/scope.json");

// Unknown si. operators are errors; other one-key objects are literals.
assert.throws(() => X.evaluate({ "si.nope": [] }), /Unknown operator/); n++;
ok(JSON.stringify(X.evaluate({ k: { var: "x" } }, { x: 1 })) === '{"k":{"var":"x"}}', "plain objects are literals");
ok(lit([1, 2]).eval() .length === 2, "lit");

// Registry: validation, duplicates, factory.
const reg = createRegistry("thing", { required: ["id", "make"] });
reg.register({ id: "two-x", make: ({ k = 2 }) => (x) => x * k });
ok(reg.create("two-x", { k: 3 })(2) === 6, "factory");
assert.throws(() => reg.register({ id: "two-x", make() {} }), /already registered/); n++;
assert.throws(() => reg.register({ id: "Bad_Id", make() {} }), /kebab-case/); n++;
assert.throws(() => reg.register({ id: "no-make" }), /needs "make"/); n++;
assert.throws(() => reg.get("missing"), /No thing "missing"/); n++;

// Taggers: every adapter returns qualified, explainable tags.
const T = require("../lib/taggers");
const tags = T.tagAll("Anthropic reports 72% on SWE-bench Verified; alignment work toward AGI");
ok(tags.every((t) => /^[a-z]+:[a-z0-9-]+$/.test(t.qid) && Array.isArray(t.matched) && t.method), "tags have qid, matched, method");
ok(["topic:alignment", "org:anthropic", "benchmark:swe-bench-verified"].every((q) => tags.some((t) => t.qid === q)), "topic, org and benchmark adapters all ran");
console.log(`expr and registry unit checks: ${n} passed`);
