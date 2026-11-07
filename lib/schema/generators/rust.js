// Rust serde structs (included by interop/rust/si-expr as si_expr::types).
module.exports = {
  id: "rust", file: "si_types.rs", about: "Rust serde structs and enums",
  generate(m, { header }) {
    const KW = new Set(["in", "type", "match", "ref", "use", "mod", "fn", "struct", "enum", "impl", "loop", "move", "self", "super", "where", "while", "as", "box", "const", "crate", "dyn", "else", "extern", "false", "for", "if", "let", "mut", "pub", "return", "static", "trait", "true", "unsafe", "async", "await"]);
    const scalar = { string: "String", int: "i64", float: "f64", bool: "bool", datetime: "String", json: "serde_json::Value" };
    const ty = (f) => { let s = f.scalar ? scalar[f.base] : f.base; if (f.list) s = `Vec<${s}>`; if (f.optional) s = `Option<${s}>`; return s; };
    const L = [header("//"), "use serde::{Deserialize, Serialize};", ""];
    for (const e of m.enums) L.push(`/// ${e.about}`, "#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]", '#[serde(rename_all = "kebab-case")]', `pub enum ${e.name} {`, ...e.values.map((v) => `    ${v.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("")},`), "}", "");
    for (const t of m.types) {
      L.push(`/// ${t.about}`, "#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]", "#[serde(deny_unknown_fields)]", `pub struct ${t.name} {`);
      for (const f of t.fields) { if (f.about) L.push(`    /// ${f.about}`); if (KW.has(f.name)) L.push(`    #[serde(rename = ${JSON.stringify(f.name)})]`); if (f.optional) L.push("    #[serde(default, skip_serializing_if = \"Option::is_none\")]"); L.push(`    pub ${KW.has(f.name) ? f.name + "_" : f.name}: ${ty(f)},`); }
      L.push("}", "");
    }
    return L.join("\n");
  },
};
