// si-expr interpreter for Node (see lib/expr/README.md and spec.json).
// A registry of operators: core JSONLogic plus "si." extensions. Register more with register(name, fn, { lazy }).
// Lazy operators receive unevaluated arguments and an evaluate(node, data) callback (needed for if/and/or/let/map...).

const OPS = new Map();
const register = (name, fn, { lazy = false } = {}) => { OPS.set(name, { fn, lazy }); return fn; };

const isOp = (node) => node !== null && typeof node === "object" && !Array.isArray(node) && Object.keys(node).length === 1 && OPS.has(Object.keys(node)[0]);
const truthy = (v) => (Array.isArray(v) ? v.length > 0 : !!v);

function evaluate(node, data = {}) {
  if (Array.isArray(node)) return node.map((n) => evaluate(n, data));
  if (node === null || typeof node !== "object") return node;
  const keys = Object.keys(node);
  if (keys.length !== 1 || !OPS.has(keys[0])) {
    if (keys.length === 1 && keys[0].startsWith("si.")) throw new Error(`Unknown operator "${keys[0]}"`);
    return node; // any other object that isn't an operator is a literal (same rule in every runtime)
  }
  const name = keys[0], op = OPS.get(name);
  let args = node[name];
  if (op.lazy) return op.fn(args, data, evaluate);
  if (!Array.isArray(args)) args = [args];
  return op.fn(...args.map((a) => evaluate(a, data)));
}

function getPath(data, path) {
  if (path === "" || path === null || path === undefined) return data;
  let cur = data;
  for (const k of String(path).split(".")) { if (cur === null || cur === undefined) return null; cur = Array.isArray(cur) && /^\d+$/.test(k) ? cur[Number(k)] : cur[k]; }
  return cur === undefined ? null : cur;
}

// ---- term matching, identical across runtimes: no regex engine features beyond plain scanning ----
const W = (c) => (c >= "a" && c <= "z") || (c >= "0" && c <= "9");
function match(text, term) {
  if (typeof text !== "string" || typeof term !== "string") return null;
  const t = text.toLowerCase(); let q = term.toLowerCase().trim();
  const prefix = q.endsWith("*"); if (prefix) q = q.slice(0, -1);
  if (!q) return null;
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    if (i > 0 && W(t[i - 1])) continue;
    let end = i + q.length;
    if (prefix) { while (end < t.length && (W(t[end]) || t[end] === "-")) end++; }
    else if (end < t.length && W(t[end])) continue;
    return t.slice(i, end);
  }
  return null;
}

// ---- core JSONLogic ----
register("var", (args, data, ev) => { const a = Array.isArray(args) ? args : [args]; const v = getPath(data, ev(a[0], data)); return v === null && a.length > 1 ? ev(a[1], data) : v; }, { lazy: true });
register("if", (args, data, ev) => { let i = 0; for (; i + 1 < args.length; i += 2) if (truthy(ev(args[i], data))) return ev(args[i + 1], data); return i < args.length ? ev(args[i], data) : null; }, { lazy: true });
register("and", (args, data, ev) => { let v = true; for (const a of args) { v = ev(a, data); if (!truthy(v)) return v; } return v; }, { lazy: true });
register("or", (args, data, ev) => { let v = false; for (const a of args) { v = ev(a, data); if (truthy(v)) return v; } return v; }, { lazy: true });
register("!", (a) => !truthy(a));
register("!!", (a) => truthy(a));
register("==", (a, b) => JSON.stringify(a) === JSON.stringify(b));
register("!=", (a, b) => JSON.stringify(a) !== JSON.stringify(b));
register("<", (a, b) => a < b);
register("<=", (a, b) => a <= b);
register(">", (a, b) => a > b);
register(">=", (a, b) => a >= b);
register("in", (a, b) => (Array.isArray(b) ? b.some((x) => JSON.stringify(x) === JSON.stringify(a)) : typeof b === "string" ? b.includes(a) : false));
register("cat", (...xs) => xs.map((x) => (x === null ? "" : String(x))).join(""));
register("+", (...xs) => xs.reduce((s, x) => s + Number(x), 0));
register("-", (a, b) => (b === undefined ? -Number(a) : Number(a) - Number(b)));
register("*", (...xs) => xs.reduce((s, x) => s * Number(x), 1));
register("min", (...xs) => (xs.length ? Math.min(...xs.map(Number)) : null));
register("max", (...xs) => (xs.length ? Math.max(...xs.map(Number)) : null));
const each = (fn) => (args, data, ev) => { const arr = ev(args[0], data); return fn(Array.isArray(arr) ? arr : [], (item) => ev(args[1], item)); };
register("map", each((arr, f) => arr.map(f)), { lazy: true });
register("filter", each((arr, f) => arr.filter((x) => truthy(f(x)))), { lazy: true });
register("some", each((arr, f) => arr.some((x) => truthy(f(x)))), { lazy: true });
register("all", each((arr, f) => arr.length > 0 && arr.every((x) => truthy(f(x)))), { lazy: true });

// ---- si. extensions ----
register("si.match", (text, term) => match(text, term));
const termList = (terms) => (typeof terms === "string" ? [terms] : Array.isArray(terms) ? terms : []);
register("si.first_match", (text, terms) => { for (const t of termList(terms)) { const m = match(text, t); if (m !== null) return m; } return null; });
register("si.matches", (text, terms) => { const out = []; for (const t of termList(terms)) { const m = match(text, t); if (m !== null && !out.includes(m)) out.push(m); } return out; });
register("si.count", (x) => (x === null || x === undefined ? 0 : x.length ?? 0));
register("si.unique", (arr) => { const out = [], seen = new Set(); for (const x of arr || []) { const k = JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } } return out; });
register("si.let", (args, data, ev) => { const scope = { ...(data && typeof data === "object" ? data : {}) }; for (const [k, e] of Object.entries(args[0] || {})) scope[k] = ev(e, scope); return ev(args[1], scope); }, { lazy: true });
register("si.obj", (args, data, ev) => Object.fromEntries(Object.entries(args || {}).map(([k, e]) => [k, ev(e, data)])), { lazy: true });
register("si.tpl", (tpl, ctx) => String(tpl).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => { const v = getPath(ctx || {}, p); return v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v); }));

const operators = () => [...OPS.keys()];
module.exports = { evaluate, register, operators, match, getPath, isOp, truthy };
