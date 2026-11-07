// pydantic v2 models for Python workers and notebooks: from models import Tag.
module.exports = {
  id: "pydantic", file: "models.py", about: "pydantic v2 models",
  generate(m, { ordered, header }) {
    const KW = new Set(["in", "from", "class", "def", "for", "is", "not", "and", "or", "if", "else", "import", "return", "global", "lambda", "with", "as", "pass", "try", "raise", "del", "while", "yield", "assert", "async", "await"]);
    const scalar = { string: "str", int: "int", float: "float", bool: "bool", datetime: "datetime", json: "Any" };
    const ty = (f) => { let s = f.scalar ? scalar[f.base] : f.base; if (f.list) s = `list[${s}]`; if (f.optional) s = `Optional[${s}]`; return s; };
    const L = [header("#"), "from __future__ import annotations", "from datetime import datetime", "from enum import Enum", "from typing import Any, Optional", "from pydantic import BaseModel, ConfigDict, Field", ""];
    for (const e of m.enums) L.push("", `class ${e.name}(str, Enum):`, `    """${e.about}"""`, ...e.values.map((v) => `    ${v.replace(/-/g, "_")} = ${JSON.stringify(v)}`), "");
    for (const t of ordered) {
      L.push("", `class ${t.name}(BaseModel):`, `    """${t.about}"""`, "    model_config = ConfigDict(extra=\"forbid\", populate_by_name=True)", "");
      for (const f of t.fields) {
        const name = KW.has(f.name) ? `${f.name}_` : f.name;
        const args = [f.optional ? "default=None" : "...", KW.has(f.name) ? `alias=${JSON.stringify(f.name)}` : null, f.pattern ? `pattern=${JSON.stringify(f.pattern)}` : null, f.about ? `description=${JSON.stringify(f.about)}` : null].filter(Boolean);
        L.push(`    ${name}: ${ty(f)} = Field(${args.join(", ")})`);
      }
      L.push("");
    }
    return L.join("\n").replace(/\n{3,}/g, "\n\n\n") + "\n";
  },
};
