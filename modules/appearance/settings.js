// Pure helpers shared by the routes and the unit check: the catalog, validation and resolving a concept.
const CATALOG = require("./catalog.json");
const FIELDS = { theme: "themes", layout: "layouts", type: "types", size: "sizes" };
const ids = (list) => new Set(CATALOG[list].map((x) => x.id));
const concept = (id) => CATALOG.concepts.find((c) => c.id === id) || null;
// Validate a site default. Unknown keys are ignored; an unknown value is an error (message for a person).
function validate(input = {}) {
  const out = { ...CATALOG.default };
  if (input.concept !== undefined) { const c = concept(input.concept); if (!c) throw new Error(`Unknown concept "${input.concept}".`); Object.assign(out, { concept: c.id, theme: c.theme, layout: c.layout, type: c.type, size: c.size }); }
  for (const [field, list] of Object.entries(FIELDS)) if (input[field] !== undefined) { if (!ids(list).has(input[field])) throw new Error(`Unknown ${field} "${input[field]}".`); out[field] = input[field]; }
  if (input.allowReader !== undefined) { if (typeof input.allowReader !== "boolean") throw new Error("allowReader must be true or false."); out.allowReader = input.allowReader; }
  // A concept whose settings were then changed is reported as "custom".
  const c = concept(out.concept); if (!c || Object.keys(FIELDS).some((f) => c[f] !== out[f])) out.concept = "custom";
  return out;
}
module.exports = { CATALOG, FIELDS, validate, concept };
