// Ways to write si-expr trees without typing JSON by hand.
//
// 1. "Magic" expressions (a Proxy): property access extends a variable path, methods add operators.
//      const { v, lit } = require("./lib/expr");
//      v.text.firstMatch(v.strong)              -> {"si.first_match":[{"var":"text"},{"var":"strong"}]}
//      v.tops.count().gte(v.min_topics)         -> {">=":[{"si.count":{"var":"tops"}},{"var":"min_topics"}]}
//      v.a.and(v.b.not())                       -> {"and":[{"var":"a"},{"!":{"var":"b"}}]}
//    Every expression serialises with JSON.stringify (toJSON) and can be evaluated with .eval(data).
// 2. A builder for decision chains: when(cond).then(a).when(c2).then(b).otherwise(c) -> {"if":[...]}.
// 3. obj({...}), tpl(template, data), let_({...}, body) for the si. constructors.
const { evaluate, isOp } = require("./eval");

const AST = Symbol("ast");
const unwrap = (x) => (x && x[AST] !== undefined ? x[AST] : Array.isArray(x) ? x.map(unwrap) : x && typeof x === "object" && !(AST in x) ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, unwrap(y)])) : x);

// method name -> (self, ...args) => ast
const METHODS = {
  and: (s, ...a) => ({ and: [s, ...a.map(unwrap)] }),
  or: (s, ...a) => ({ or: [s, ...a.map(unwrap)] }),
  not: (s) => ({ "!": s }),
  bool: (s) => ({ "!!": s }),
  eq: (s, b) => ({ "==": [s, unwrap(b)] }),
  ne: (s, b) => ({ "!=": [s, unwrap(b)] }),
  lt: (s, b) => ({ "<": [s, unwrap(b)] }),
  lte: (s, b) => ({ "<=": [s, unwrap(b)] }),
  gt: (s, b) => ({ ">": [s, unwrap(b)] }),
  gte: (s, b) => ({ ">=": [s, unwrap(b)] }),
  in: (s, b) => ({ in: [s, unwrap(b)] }),
  contains: (s, b) => ({ in: [unwrap(b), s] }),
  plus: (s, ...a) => ({ "+": [s, ...a.map(unwrap)] }),
  minus: (s, b) => ({ "-": [s, unwrap(b)] }),
  times: (s, ...a) => ({ "*": [s, ...a.map(unwrap)] }),
  count: (s) => ({ "si.count": s }),
  unique: (s) => ({ "si.unique": s }),
  match: (s, term) => ({ "si.match": [s, unwrap(term)] }),
  firstMatch: (s, terms) => ({ "si.first_match": [s, unwrap(terms)] }),
  matches: (s, terms) => ({ "si.matches": [s, unwrap(terms)] }),
  map: (s, f) => ({ map: [s, unwrap(f)] }),
  filter: (s, f) => ({ filter: [s, unwrap(f)] }),
  some: (s, f) => ({ some: [s, unwrap(f)] }),
  all: (s, f) => ({ all: [s, unwrap(f)] }),
  default: (s, d) => ({ var: [s.var, unwrap(d)] }),
};

function wrap(ast) {
  const target = function () {};
  return new Proxy(target, {
    get(_, prop) {
      if (prop === AST) return ast;
      if (prop === "toJSON") return () => ast;
      if (prop === "eval") return (data) => evaluate(ast, data);
      if (prop === Symbol.toPrimitive || prop === "toString") return () => JSON.stringify(ast);
      if (typeof prop === "symbol") return undefined;
      if (METHODS[prop]) return (...args) => wrap(METHODS[prop](ast, ...args));
      // anything else extends a variable path: v.story.title -> {"var":"story.title"}
      if (ast && typeof ast === "object" && "var" in ast && typeof ast.var === "string") return wrap({ var: `${ast.var}.${prop}` });
      throw new Error(`"${String(prop)}" isn't an si-expr method (${Object.keys(METHODS).join(", ")})`);
    },
    has: (_, prop) => prop === AST,
  });
}

const v = new Proxy({}, { get: (_, prop) => (typeof prop === "symbol" ? undefined : wrap({ var: prop })) });
const lit = (x) => wrap(unwrap(x));
const obj = (fields) => wrap({ "si.obj": unwrap(fields) });
// Template data given as a plain object becomes {"si.obj": ...} so its values are evaluated.
const tpl = (template, data) => { const d = unwrap(data); const plain = d && typeof d === "object" && !Array.isArray(d) && !isOp(d); return wrap({ "si.tpl": [template, plain ? { "si.obj": d } : d] }); };
const let_ = (bindings, body) => wrap({ "si.let": [unwrap(bindings), unwrap(body)] });
const cat = (...xs) => wrap({ cat: xs.map(unwrap) });

// Decision-chain builder: when(c).then(x)...otherwise(y).build()
function when(cond) {
  const arms = [];
  const api = (pending) => ({
    then: (val) => { arms.push(unwrap(pending), unwrap(val)); return { when: (c) => api(c), otherwise: (val2) => wrap({ if: [...arms, unwrap(val2)] }), build: () => wrap({ if: [...arms] }) }; },
  });
  return api(cond);
}

module.exports = { v, lit, obj, tpl, let_, cat, when, unwrap, AST };
