// JSON Schema (draft 2020-12): the lingua franca; zod, pydantic and OpenAPI tools can all read it.
module.exports = {
  id: "json-schema", file: "si.schema.json", about: "JSON Schema 2020-12 with every type in $defs",
  generate(m) {
    const scalar = { string: { type: "string" }, int: { type: "integer" }, float: { type: "number" }, bool: { type: "boolean" }, datetime: { type: "string", format: "date-time" }, json: {} };
    const one = (f) => (f.scalar ? { ...scalar[f.base] } : { $ref: `#/$defs/${f.base}` });
    const field = (f) => { let s = one(f); if (f.pattern) s.pattern = f.pattern; if (f.list) s = { type: "array", items: s }; if (f.optional) s = { anyOf: [s, { type: "null" }] }; if (f.about) s.description = f.about; return s; };
    const defs = {};
    for (const e of m.enums) defs[e.name] = { description: e.about, enum: e.values };
    for (const t of m.types) defs[t.name] = { type: "object", description: t.about, properties: Object.fromEntries(t.fields.map((f) => [f.name, field(f)])), required: t.fields.filter((f) => !f.optional).map((f) => f.name), additionalProperties: false };
    return JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", $id: `urn:${m.pkg}`, title: m.pkg, description: "Generated from schema/types.json; do not edit.", $defs: defs }, null, 2) + "\n";
  },
};
