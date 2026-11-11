// Sources (named reads) and actions (named writes) contributed by modules (REQ-061, proposed), with the small input
// schema they share: { field: { type: string|integer|number|boolean|object|array, required?, max?, min?, enum?, about? } }.
// The same schema checks input on the server, draws a form in the builder and documents the action for an LLM.
const sources = new Map(), actions = new Map();
const NAME = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;
function add(map, kind, mod, id, def) {
  if (!NAME.test(id)) throw new Error(`${kind} "${id}" must look like "module.name"`);
  if (map.has(id)) throw new Error(`${kind} "${id}" is registered twice`);
  if (typeof def.run !== "function") throw new Error(`${kind} "${id}" needs a run function`);
  map.set(id, { id, module: mod, about: def.about || "", params: def.params || def.input || {}, access: def.access || (kind === "action" ? "admin" : "user"), guard: def.guard || null, run: def.run, refresh: def.refresh || [] });
}
function check(schema, input = {}) {
  const out = {}, bad = [];
  for (const [k, f] of Object.entries(schema)) {
    let v = input[k];
    if (v === undefined || v === "" || v === null) { if (f.required) bad.push(`${k} is required`); else if (f.default !== undefined) out[k] = f.default; continue; }
    if ((f.type === "integer" || f.type === "number") && typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) v = Number(v);
    if (f.type === "boolean" && typeof v === "string") v = v === "true" || v === "1";
    const ok = f.type === "string" ? typeof v === "string" : f.type === "integer" ? Number.isInteger(v) : f.type === "number" ? typeof v === "number" && isFinite(v) : f.type === "boolean" ? typeof v === "boolean" : f.type === "array" ? Array.isArray(v) : f.type === "object" ? v && typeof v === "object" && !Array.isArray(v) : true;
    if (!ok) { bad.push(`${k} must be ${f.type === "integer" ? "a whole number" : `a ${f.type}`}`); continue; }
    if (f.enum && !f.enum.includes(v)) { bad.push(`${k} must be one of ${f.enum.join(", ")}`); continue; }
    if (f.type === "string" && f.max && v.length > f.max) { bad.push(`${k} must be at most ${f.max} characters`); continue; }
    if ((f.type === "integer" || f.type === "number") && ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) { bad.push(`${k} must be between ${f.min ?? "-∞"} and ${f.max ?? "∞"}`); continue; }
    out[k] = v;
  }
  const extra = Object.keys(input || {}).filter((k) => !(k in schema));
  if (extra.length) bad.push(`unknown field${extra.length > 1 ? "s" : ""}: ${extra.join(", ")}`);
  return { ok: !bad.length, value: out, errors: bad };
}
const allowed = (def, user) => def.access === "public" || (def.access === "user" && !!user) || (def.access === "admin" && !!(user && user.admin));
const describe = (def) => ({ id: def.id, module: def.module, about: def.about, access: def.access, params: def.params });
module.exports = { sources, actions, add, check, allowed, describe };
