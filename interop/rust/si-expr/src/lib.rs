//! si-expr for Rust and WebAssembly: the same JSON AST rules as lib/expr (Node) and interop/python.
//! Semantics are pinned by test/expr-vectors.json (`cargo run --bin si-expr-vectors -- ../../../test/expr-vectors.json`).
//!
//! WebAssembly: `cargo build --release --target wasm32-unknown-unknown` exports
//! `si_alloc(len) -> ptr`, `si_eval(rule_ptr, rule_len, data_ptr, data_len) -> u64` (ptr << 32 | len of a JSON
//! result `{"ok": value}` or `{"error": message}`) and `si_free(ptr, len)`. See interop/rust/README.md.
use serde_json::{json, Map, Value};

/// Typed structs generated from schema/types.json (enable the `types` feature).
#[cfg(feature = "types")]
pub mod types { include!("../../../../schema/gen/si_types.rs"); }

#[cfg(all(test, feature = "types"))]
mod tests {
    #[test]
    fn types_examples() {
        let ex: serde_json::Value = serde_json::from_str(include_str!("../../../../schema/examples.json")).unwrap();
        let ex = &ex["examples"];
        // JSON numbers compare by value (2 and 2.0 are the same number).
        fn norm(v: serde_json::Value) -> serde_json::Value { match v {
            serde_json::Value::Number(n) => serde_json::json!(n.as_f64().unwrap()),
            serde_json::Value::Array(a) => serde_json::Value::Array(a.into_iter().map(norm).collect()),
            serde_json::Value::Object(m) => serde_json::Value::Object(m.into_iter().map(|(k, v)| (k, norm(v))).collect()),
            o => o } }
        macro_rules! check { ($($t:ident),*) => { $( let v: super::types::$t = serde_json::from_value(ex[stringify!($t)].clone()).expect(stringify!($t)); let back = serde_json::to_value(&v).unwrap(); assert_eq!(norm(back), norm(ex[stringify!($t)].clone()), stringify!($t)); )* println!("rust serde: examples round-trip"); } }
        check!(Tag, ScopeDecision, Story, Chunk, Embedding, Edge, TagRequest, TagResult, EvalRequest, EvalResult);
    }
}

pub type Result<T> = std::result::Result<T, String>;

const LAZY: &[&str] = &["var", "if", "and", "or", "map", "filter", "some", "all", "si.let", "si.obj"];
const EAGER: &[&str] = &[
    "!", "!!", "==", "!=", "<", "<=", ">", ">=", "in", "cat", "+", "-", "*", "min", "max",
    "si.match", "si.first_match", "si.matches", "si.count", "si.unique", "si.tpl",
];

fn known(op: &str) -> bool { LAZY.contains(&op) || EAGER.contains(&op) }

pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        Value::String(s) => !s.is_empty(),
        Value::Array(a) => !a.is_empty(),
        Value::Object(_) => true,
    }
}

fn key(v: &Value) -> String { serde_json::to_string(v).unwrap_or_default() }

fn num(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        Value::String(s) => s.parse().unwrap_or(f64::NAN),
        _ => 0.0,
    }
}

fn n(f: f64) -> Value {
    if f.fract() == 0.0 && f.abs() < 9.0e15 { json!(f as i64) } else { json!(f) }
}

fn s(v: &Value) -> String {
    match v {
        Value::Null => String::new(),
        Value::String(x) => x.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(_) => { let f = num(v); if f.fract() == 0.0 { format!("{}", f as i64) } else { f.to_string() } }
        other => key(other),
    }
}

pub fn get_path(data: &Value, path: &Value) -> Value {
    let p = match path { Value::Null => String::new(), Value::String(x) => x.clone(), other => s(other) };
    if p.is_empty() { return data.clone(); }
    let mut cur = data;
    for k in p.split('.') {
        cur = match cur {
            Value::Object(m) => match m.get(k) { Some(v) => v, None => return Value::Null },
            Value::Array(a) => match k.parse::<usize>().ok().and_then(|i| a.get(i)) { Some(v) => v, None => return Value::Null },
            _ => return Value::Null,
        };
    }
    cur.clone()
}

fn w(c: u8) -> bool { c.is_ascii_lowercase() || c.is_ascii_digit() }

/// Ontology term matcher; must equal lib/expr/eval.js `match` exactly.
pub fn term_match(text: &str, term: &str) -> Option<String> {
    let t = text.to_lowercase();
    let mut q = term.to_lowercase().trim().to_string();
    let prefix = q.ends_with('*');
    if prefix { q.pop(); }
    if q.is_empty() { return None; }
    let tb = t.as_bytes();
    let mut from = 0;
    while let Some(off) = t[from..].find(&q) {
        let i = from + off;
        let mut ok = !(i > 0 && w(tb[i - 1]));
        let mut end = i + q.len();
        if ok {
            if prefix { while end < tb.len() && (w(tb[end]) || tb[end] == b'-') { end += 1; } }
            else if end < tb.len() && w(tb[end]) { ok = false; }
        }
        if ok { return Some(t[i..end].to_string()); }
        from = i + t[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1);
        if from >= t.len() { break; }
    }
    None
}

fn terms(v: &Value) -> Vec<String> {
    match v {
        Value::String(x) => vec![x.clone()],
        Value::Array(a) => a.iter().filter_map(|x| x.as_str().map(String::from)).collect(),
        _ => vec![],
    }
}

fn args_of(v: &Value) -> Vec<Value> { match v { Value::Array(a) => a.clone(), other => vec![other.clone()] } }

pub fn evaluate(node: &Value, data: &Value) -> Result<Value> {
    match node {
        Value::Array(a) => a.iter().map(|x| evaluate(x, data)).collect::<Result<Vec<_>>>().map(Value::Array),
        Value::Object(m) if m.len() == 1 => {
            let (op, raw) = m.iter().next().unwrap();
            if !known(op) {
                if op.starts_with("si.") { return Err(format!("Unknown operator \"{}\"", op)); }
                return Ok(node.clone());
            }
            if LAZY.contains(&op.as_str()) { return lazy(op, raw, data); }
            let a = args_of(raw).iter().map(|x| evaluate(x, data)).collect::<Result<Vec<_>>>()?;
            eager(op, &a)
        }
        other => Ok(other.clone()),
    }
}

fn lazy(op: &str, raw: &Value, data: &Value) -> Result<Value> {
    let a = args_of(raw);
    match op {
        "var" => {
            let p = evaluate(a.get(0).unwrap_or(&Value::Null), data)?;
            let v = get_path(data, &p);
            if v.is_null() && a.len() > 1 { evaluate(&a[1], data) } else { Ok(v) }
        }
        "if" => {
            let mut i = 0;
            while i + 1 < a.len() { if truthy(&evaluate(&a[i], data)?) { return evaluate(&a[i + 1], data); } i += 2; }
            if i < a.len() { evaluate(&a[i], data) } else { Ok(Value::Null) }
        }
        "and" => { let mut v = Value::Bool(true); for x in &a { v = evaluate(x, data)?; if !truthy(&v) { return Ok(v); } } Ok(v) }
        "or" => { let mut v = Value::Bool(false); for x in &a { v = evaluate(x, data)?; if truthy(&v) { return Ok(v); } } Ok(v) }
        "map" | "filter" | "some" | "all" => {
            let arr = match evaluate(a.get(0).unwrap_or(&Value::Null), data)? { Value::Array(x) => x, _ => vec![] };
            let f = a.get(1).cloned().unwrap_or(Value::Null);
            match op {
                "map" => arr.iter().map(|x| evaluate(&f, x)).collect::<Result<Vec<_>>>().map(Value::Array),
                "filter" => { let mut out = vec![]; for x in arr { if truthy(&evaluate(&f, &x)?) { out.push(x); } } Ok(Value::Array(out)) }
                "some" => { for x in &arr { if truthy(&evaluate(&f, x)?) { return Ok(json!(true)); } } Ok(json!(false)) }
                _ => { if arr.is_empty() { return Ok(json!(false)); } for x in &arr { if !truthy(&evaluate(&f, x)?) { return Ok(json!(false)); } } Ok(json!(true)) }
            }
        }
        "si.let" => {
            let mut scope = match data { Value::Object(m) => m.clone(), _ => Map::new() };
            if let Some(Value::Object(b)) = a.get(0) {
                for (k, e) in b { let v = evaluate(e, &Value::Object(scope.clone()))?; scope.insert(k.clone(), v); }
            }
            evaluate(a.get(1).unwrap_or(&Value::Null), &Value::Object(scope))
        }
        "si.obj" => {
            let mut out = Map::new();
            if let Value::Object(fields) = raw { for (k, e) in fields { out.insert(k.clone(), evaluate(e, data)?); } }
            Ok(Value::Object(out))
        }
        _ => Err(format!("Unknown operator \"{}\"", op)),
    }
}

fn cmp(a: &Value, b: &Value) -> Option<std::cmp::Ordering> {
    match (a, b) { (Value::String(x), Value::String(y)) => Some(x.cmp(y)), _ => num(a).partial_cmp(&num(b)) }
}

fn eager(op: &str, a: &[Value]) -> Result<Value> {
    let g = |i: usize| a.get(i).cloned().unwrap_or(Value::Null);
    use std::cmp::Ordering::*;
    Ok(match op {
        "!" => json!(!truthy(&g(0))),
        "!!" => json!(truthy(&g(0))),
        "==" => json!(key(&g(0)) == key(&g(1))),
        "!=" => json!(key(&g(0)) != key(&g(1))),
        "<" => json!(cmp(&g(0), &g(1)) == Some(Less)),
        "<=" => json!(matches!(cmp(&g(0), &g(1)), Some(Less) | Some(Equal))),
        ">" => json!(cmp(&g(0), &g(1)) == Some(Greater)),
        ">=" => json!(matches!(cmp(&g(0), &g(1)), Some(Greater) | Some(Equal))),
        "in" => match g(1) {
            Value::Array(xs) => json!(xs.iter().any(|x| key(x) == key(&g(0)))),
            Value::String(hay) => json!(g(0).as_str().map(|n| hay.contains(n)).unwrap_or(false)),
            _ => json!(false),
        },
        "cat" => json!(a.iter().map(s).collect::<String>()),
        "+" => n(a.iter().map(num).sum()),
        "-" => if a.len() < 2 { n(-num(&g(0))) } else { n(num(&g(0)) - num(&g(1))) },
        "*" => n(a.iter().map(num).product()),
        "min" => if a.is_empty() { Value::Null } else { n(a.iter().map(num).fold(f64::INFINITY, f64::min)) },
        "max" => if a.is_empty() { Value::Null } else { n(a.iter().map(num).fold(f64::NEG_INFINITY, f64::max)) },
        "si.match" => match (g(0).as_str(), g(1).as_str()) { (Some(t), Some(q)) => term_match(t, q).map(Value::String).unwrap_or(Value::Null), _ => Value::Null },
        "si.first_match" => {
            let text = g(0); let t = match text.as_str() { Some(x) => x, None => return Ok(Value::Null) };
            terms(&g(1)).iter().find_map(|q| term_match(t, q)).map(Value::String).unwrap_or(Value::Null)
        }
        "si.matches" => {
            let text = g(0); let mut out: Vec<Value> = vec![];
            if let Some(t) = text.as_str() { for q in terms(&g(1)) { if let Some(m) = term_match(t, &q) { let v = Value::String(m); if !out.contains(&v) { out.push(v); } } } }
            Value::Array(out)
        }
        "si.count" => match g(0) { Value::Array(x) => json!(x.len()), Value::String(x) => json!(x.encode_utf16().count()), _ => json!(0) },
        "si.unique" => {
            let mut out: Vec<Value> = vec![]; let mut seen = std::collections::HashSet::new();
            if let Value::Array(xs) = g(0) { for x in xs { if seen.insert(key(&x)) { out.push(x); } } }
            Value::Array(out)
        }
        "si.tpl" => {
            let tpl = s(&g(0)); let ctx = g(1); let mut out = String::new(); let mut rest = tpl.as_str();
            while let Some(st) = rest.find("{{") {
                out.push_str(&rest[..st]);
                match rest[st + 2..].find("}}") {
                    Some(en) => {
                        let name = rest[st + 2..st + 2 + en].trim();
                        if !name.is_empty() && name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.') {
                            match get_path(&ctx, &json!(name)) {
                                Value::Null => {}
                                Value::Array(xs) => out.push_str(&xs.iter().map(s).collect::<Vec<_>>().join(", ")),
                                v => out.push_str(&s(&v)),
                            }
                        } else { out.push_str(&rest[st..st + 4 + en]); }
                        rest = &rest[st + 4 + en..];
                    }
                    None => { out.push_str(&rest[st..]); rest = ""; }
                }
            }
            out.push_str(rest);
            Value::String(out)
        }
        other => return Err(format!("Unknown operator \"{}\"", other)),
    })
}

/// Evaluate rule and data given as JSON text; returns `{"ok": result}` or `{"error": message}` as JSON text.
pub fn eval_json(rule: &str, data: &str) -> String {
    let r = (|| -> Result<Value> {
        let rule: Value = serde_json::from_str(rule).map_err(|e| e.to_string())?;
        let data: Value = if data.trim().is_empty() { json!({}) } else { serde_json::from_str(data).map_err(|e| e.to_string())? };
        evaluate(&rule, &data)
    })();
    match r { Ok(v) => json!({ "ok": v }).to_string(), Err(e) => json!({ "error": e }).to_string() }
}

// ---- WebAssembly ABI (plain exports, no wasm-bindgen needed) ----
#[no_mangle]
pub extern "C" fn si_alloc(len: usize) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len.max(1));
    let p = buf.as_mut_ptr(); std::mem::forget(buf); p
}

#[no_mangle]
pub unsafe extern "C" fn si_free(ptr: *mut u8, len: usize) { drop(Vec::from_raw_parts(ptr, 0, len.max(1))); }

#[no_mangle]
pub unsafe extern "C" fn si_eval(rp: *const u8, rl: usize, dp: *const u8, dl: usize) -> u64 {
    let rule = std::str::from_utf8(std::slice::from_raw_parts(rp, rl)).unwrap_or("null");
    let data = std::str::from_utf8(std::slice::from_raw_parts(dp, dl)).unwrap_or("{}");
    let out = eval_json(rule, data).into_bytes();
    let len = out.len(); let mut out = out.into_boxed_slice(); let p = out.as_mut_ptr(); std::mem::forget(out);
    ((p as u64) << 32) | len as u64
}
