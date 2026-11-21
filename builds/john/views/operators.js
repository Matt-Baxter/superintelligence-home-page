// Operators a json-render view can call with { "$computed": "<name>", "args": { ... } }. The browser registers them
// with JSONUIProvider (client/jr.jsx); the catalog prompt lists them for an LLM writing a spec. Each takes one args
// object and returns a string or number, so a view binds numbers from its `state` and lets these format them.
// "rule" evaluates a portable si-expr rule (lib/expr) against the other args: the same rule runs in Node, Python,
// Rust and WebAssembly, so a threshold shown in a view is the threshold the server uses.
const expr = require("../lib/expr/eval");
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const OPERATORS = {
  str: { about: "Any value as text (null or undefined become an empty string).", fn: ({ value }) => (value == null ? "" : String(value)) },
  fixed: { about: "A number with a fixed number of decimals: { value, digits }.", fn: ({ value, digits = 0 }) => num(value).toFixed(num(digits)) },
  percent: { about: "part / whole as a whole-number percentage, or an en dash when whole is 0: { part, whole }.", fn: ({ part, whole }) => (num(whole) ? `${Math.round((num(part) / num(whole)) * 100)}%` : "–") },
  ratio: { about: "'part of whole': { part, whole }.", fn: ({ part, whole }) => `${num(part)} of ${num(whole)}` },
  plural: { about: "A count with the right noun: { n, one, many } -> '1 paper' or '3 papers'.", fn: ({ n, one, many }) => `${num(n)} ${num(n) === 1 ? one : many || `${one}s`}` },
  capitalize: { about: "First letter upper case: { value }.", fn: ({ value }) => { const s = String(value ?? ""); return s.charAt(0).toUpperCase() + s.slice(1); } },
  rule: { about: "Evaluate a portable si-expr rule (lib/expr) with the other args as its data: { rule, ...data }. Returns its result as text.", fn: ({ rule, ...data }) => { try { const v = expr.evaluate(rule, data); return typeof v === "string" ? v : JSON.stringify(v); } catch (e) { return `rule error: ${e.message}`; } } },
};
const functions = Object.fromEntries(Object.entries(OPERATORS).map(([k, v]) => [k, (args = {}) => v.fn(args || {})]));
module.exports = { OPERATORS, functions };
