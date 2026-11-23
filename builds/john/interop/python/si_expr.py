"""si-expr for Python: the same JSON AST rules as lib/expr (Node) and interop/rust (Rust, WebAssembly).

    from si_expr import evaluate, V, when, obj, tpl, let
    evaluate({"si.match": ["The AGI debate", "agi"]}, {})            # -> "agi"
    rule = (V.tops.count() >= V.min_topics) & ~V.hidden              # magic methods build the AST
    rule.to_json()  # {"and": [{">=": [{"si.count": {"var": "tops"}}, {"var": "min_topics"}]}, {"!": {"var": "hidden"}}]}

No dependencies. Semantics are pinned by test/expr-vectors.json (run: python3 interop/python/si_expr.py test/expr-vectors.json).
"""
from __future__ import annotations
import json
import re
import sys
from typing import Any, Callable

OPS: dict[str, tuple[Callable, bool]] = {}


def register(name: str, lazy: bool = False):
    def deco(fn):
        OPS[name] = (fn, lazy)
        return fn
    return deco


def truthy(v: Any) -> bool:
    if isinstance(v, list):
        return len(v) > 0
    if isinstance(v, str):
        return v != ""
    return bool(v) if v is not None else False


def is_op(node: Any) -> bool:
    return isinstance(node, dict) and len(node) == 1 and next(iter(node)) in OPS


def evaluate(node: Any, data: Any = None) -> Any:
    if data is None:
        data = {}
    if isinstance(node, list):
        return [evaluate(n, data) for n in node]
    if not isinstance(node, dict):
        return node
    if len(node) != 1 or next(iter(node)) not in OPS:
        if len(node) == 1 and next(iter(node)).startswith("si."):
            raise ValueError(f'Unknown operator "{next(iter(node))}"')
        return node
    name = next(iter(node))
    fn, lazy = OPS[name]
    args = node[name]
    if lazy:
        return fn(args, data)
    if not isinstance(args, list):
        args = [args]
    return fn(*[evaluate(a, data) for a in args])


def get_path(data: Any, path: Any) -> Any:
    if path in ("", None):
        return data
    cur = data
    for k in str(path).split("."):
        if cur is None:
            return None
        if isinstance(cur, list) and k.isdigit():
            i = int(k)
            cur = cur[i] if i < len(cur) else None
        elif isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    return cur


def _w(c: str) -> bool:
    return ("a" <= c <= "z") or ("0" <= c <= "9")


def match(text: Any, term: Any) -> Any:
    """Ontology term match; must equal lib/expr/eval.js match() exactly."""
    if not isinstance(text, str) or not isinstance(term, str):
        return None
    t = text.lower()
    q = term.lower().strip()
    prefix = q.endswith("*")
    if prefix:
        q = q[:-1]
    if not q:
        return None
    i = t.find(q)
    while i != -1:
        ok = not (i > 0 and _w(t[i - 1]))
        end = i + len(q)
        if ok:
            if prefix:
                while end < len(t) and (_w(t[end]) or t[end] == "-"):
                    end += 1
            elif end < len(t) and _w(t[end]):
                ok = False
        if ok:
            return t[i:end]
        i = t.find(q, i + 1)
    return None


def _num(x: Any) -> float:
    if isinstance(x, bool):
        return 1 if x else 0
    if x is None:
        return 0
    return float(x) if isinstance(x, str) else x


def _norm(x: Any) -> Any:
    # JSON numbers: 3.0 and 3 are the same value; keep ints when whole so output matches Node's JSON.
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


def _key(x: Any) -> str:
    return json.dumps(x, sort_keys=False, separators=(",", ":"))


def _str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, float) and x.is_integer():
        return str(int(x))
    return str(x)


# ---- core JSONLogic ----
@register("var", lazy=True)
def _var(args, data):
    a = args if isinstance(args, list) else [args]
    v = get_path(data, evaluate(a[0], data))
    return evaluate(a[1], data) if v is None and len(a) > 1 else v


@register("if", lazy=True)
def _if(args, data):
    i = 0
    while i + 1 < len(args):
        if truthy(evaluate(args[i], data)):
            return evaluate(args[i + 1], data)
        i += 2
    return evaluate(args[i], data) if i < len(args) else None


@register("and", lazy=True)
def _and(args, data):
    v: Any = True
    for a in args:
        v = evaluate(a, data)
        if not truthy(v):
            return v
    return v


@register("or", lazy=True)
def _or(args, data):
    v: Any = False
    for a in args:
        v = evaluate(a, data)
        if truthy(v):
            return v
    return v


register("!")(lambda a=None: not truthy(a))
register("!!")(lambda a=None: truthy(a))
register("==")(lambda a, b: _key(a) == _key(b))
register("!=")(lambda a, b: _key(a) != _key(b))
register("<")(lambda a, b: a < b)
register("<=")(lambda a, b: a <= b)
register(">")(lambda a, b: a > b)
register(">=")(lambda a, b: a >= b)
register("in")(lambda a, b: any(_key(x) == _key(a) for x in b) if isinstance(b, list) else (a in b if isinstance(b, str) and isinstance(a, str) else False))
register("cat")(lambda *xs: "".join(_str(x) for x in xs))
register("+")(lambda *xs: _norm(sum(_num(x) for x in xs)))
register("-")(lambda a, b=None: _norm(-_num(a) if b is None else _num(a) - _num(b)))


@register("*")
def _mul(*xs):
    p: Any = 1
    for x in xs:
        p *= _num(x)
    return _norm(p)


register("min")(lambda *xs: _norm(min(_num(x) for x in xs)) if xs else None)
register("max")(lambda *xs: _norm(max(_num(x) for x in xs)) if xs else None)


def _each(fn):
    def run(args, data):
        arr = evaluate(args[0], data)
        arr = arr if isinstance(arr, list) else []
        return fn(arr, lambda item: evaluate(args[1], item))
    return run


register("map", lazy=True)(_each(lambda arr, f: [f(x) for x in arr]))
register("filter", lazy=True)(_each(lambda arr, f: [x for x in arr if truthy(f(x))]))
register("some", lazy=True)(_each(lambda arr, f: any(truthy(f(x)) for x in arr)))
register("all", lazy=True)(_each(lambda arr, f: len(arr) > 0 and all(truthy(f(x)) for x in arr)))


# ---- si. extensions ----
def _terms(terms):
    return [terms] if isinstance(terms, str) else (terms if isinstance(terms, list) else [])


register("si.match")(lambda text, term: match(text, term))


@register("si.first_match")
def _first(text, terms):
    for t in _terms(terms):
        m = match(text, t)
        if m is not None:
            return m
    return None


@register("si.matches")
def _matches(text, terms):
    out = []
    for t in _terms(terms):
        m = match(text, t)
        if m is not None and m not in out:
            out.append(m)
    return out


register("si.count")(lambda x=None: 0 if x is None else (len(x) if isinstance(x, (list, str)) else 0))


@register("si.unique")
def _unique(arr):
    out, seen = [], set()
    for x in arr or []:
        k = _key(x)
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out


@register("si.let", lazy=True)
def _let(args, data):
    scope = dict(data) if isinstance(data, dict) else {}
    for k, e in (args[0] or {}).items():
        scope[k] = evaluate(e, scope)
    return evaluate(args[1], scope)


@register("si.obj", lazy=True)
def _obj(args, data):
    return {k: evaluate(e, data) for k, e in (args or {}).items()}


@register("si.tpl")
def _tpl(tpl, ctx=None):
    def fill(m):
        v = get_path(ctx or {}, m.group(1))
        if v is None:
            return ""
        return ", ".join(_str(x) for x in v) if isinstance(v, list) else _str(v)
    return re.sub(r"\{\{\s*([\w.]+)\s*\}\}", fill, str(tpl))


# ---- magic methods: build ASTs with Python operators ----
class E:
    """An si-expr node. V.x gives {"var": "x"}; operators and methods build larger trees."""

    def __init__(self, ast: Any):
        object.__setattr__(self, "ast", ast)

    def __getattr__(self, name: str) -> "E":
        if isinstance(self.ast, dict) and isinstance(self.ast.get("var"), str):
            return E({"var": f'{self.ast["var"]}.{name}'})
        raise AttributeError(name)

    def to_json(self) -> Any:
        return self.ast

    def eval(self, data: Any = None) -> Any:
        return evaluate(self.ast, data)

    def __repr__(self) -> str:
        return f"E({json.dumps(self.ast)})"

    # boolean logic: & | ~ (Python can't overload and/or/not)
    def __and__(self, o): return E({"and": [self.ast, _u(o)]})
    def __or__(self, o): return E({"or": [self.ast, _u(o)]})
    def __invert__(self): return E({"!": self.ast})
    # comparisons
    def __eq__(self, o): return E({"==": [self.ast, _u(o)]})  # type: ignore[override]
    def __ne__(self, o): return E({"!=": [self.ast, _u(o)]})  # type: ignore[override]
    def __lt__(self, o): return E({"<": [self.ast, _u(o)]})
    def __le__(self, o): return E({"<=": [self.ast, _u(o)]})
    def __gt__(self, o): return E({">": [self.ast, _u(o)]})
    def __ge__(self, o): return E({">=": [self.ast, _u(o)]})
    # arithmetic
    def __add__(self, o): return E({"+": [self.ast, _u(o)]})
    def __sub__(self, o): return E({"-": [self.ast, _u(o)]})
    def __mul__(self, o): return E({"*": [self.ast, _u(o)]})
    def __contains__(self, o): raise TypeError("use x.is_in(list) or list_expr.contains(x)")
    __hash__ = None  # type: ignore[assignment]

    # named operators
    def count(self): return E({"si.count": self.ast})
    def unique(self): return E({"si.unique": self.ast})
    def match(self, term): return E({"si.match": [self.ast, _u(term)]})
    def first_match(self, terms): return E({"si.first_match": [self.ast, _u(terms)]})
    def matches(self, terms): return E({"si.matches": [self.ast, _u(terms)]})
    def is_in(self, xs): return E({"in": [self.ast, _u(xs)]})
    def contains(self, x): return E({"in": [_u(x), self.ast]})
    def map(self, f): return E({"map": [self.ast, _u(f)]})
    def filter(self, f): return E({"filter": [self.ast, _u(f)]})
    def some(self, f): return E({"some": [self.ast, _u(f)]})
    def all(self, f): return E({"all": [self.ast, _u(f)]})


def _u(x: Any) -> Any:
    if isinstance(x, E):
        return x.ast
    if isinstance(x, list):
        return [_u(y) for y in x]
    if isinstance(x, dict):
        return {k: _u(y) for k, y in x.items()}
    return x


class _Vars:
    def __getattr__(self, name: str) -> E:
        return E({"var": name})


V = _Vars()


def obj(fields: dict) -> E:
    return E({"si.obj": _u(fields)})


def tpl(template: str, data: Any) -> E:
    d = _u(data)
    return E({"si.tpl": [template, {"si.obj": d} if isinstance(d, dict) and not is_op(d) else d]})


def let(bindings: dict, body: Any) -> E:
    return E({"si.let": [_u(bindings), _u(body)]})


class when:
    """when(c).then(a).when(c2).then(b).otherwise(c) -> {"if": [...]}"""

    def __init__(self, cond: Any, arms: list | None = None):
        self._arms = list(arms or [])
        self._cond = cond

    def then(self, val: Any) -> "when":
        nxt = when(None, self._arms + [_u(self._cond), _u(val)])
        return nxt

    def when(self, cond: Any) -> "when":
        return when(cond, self._arms)

    def otherwise(self, val: Any) -> E:
        return E({"if": self._arms + [_u(val)]})


def run_vectors(path: str) -> int:
    vectors = json.load(open(path))["vectors"]
    bad = 0
    for v in vectors:
        got = evaluate(v["rule"], v["data"])
        if json.dumps(got, sort_keys=True) != json.dumps(v["expect"], sort_keys=True):
            bad += 1
            print(f"x {v['name']}: got {json.dumps(got)} expected {json.dumps(v['expect'])}")
    print(f"python si-expr: {len(vectors) - bad} of {len(vectors)} vectors pass")
    return bad


if __name__ == "__main__":
    sys.exit(1 if run_vectors(sys.argv[1] if len(sys.argv) > 1 else "test/expr-vectors.json") else 0)
