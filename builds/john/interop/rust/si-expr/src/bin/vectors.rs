// Runs test/expr-vectors.json through the Rust interpreter.
use serde_json::Value;
fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| "../../../test/expr-vectors.json".into());
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(&path).expect("read vectors")).expect("parse vectors");
    let vs = doc["vectors"].as_array().expect("vectors");
    let mut bad = 0;
    for v in vs {
        match si_expr::evaluate(&v["rule"], &v["data"]) {
            Ok(got) if got == v["expect"] => {}
            Ok(got) => { bad += 1; println!("x {}: got {} expected {}", v["name"], got, v["expect"]); }
            Err(e) => { bad += 1; println!("x {}: error {}", v["name"], e); }
        }
    }
    println!("rust si-expr: {} of {} vectors pass", vs.len() - bad, vs.len());
    std::process::exit(if bad > 0 { 1 } else { 0 });
}
