// A small typed registry: the one pattern behind taggers, schema generators, embedders and si-expr operators.
//   const taggers = createRegistry("tagger", { required: ["id", "tag"] });
//   taggers.register({ id: "ontology-terms", tag(text) { ... } });     // adapter
//   taggers.get("ontology-terms"); taggers.list(); taggers.create("hash", opts)  // factory for registered constructors
// Entries are validated when registered; ids follow docs/NAMING.md (kebab-case).
const { KEBAB } = require("./ids");

function createRegistry(kind, { required = ["id"], defaults = {} } = {}) {
  const items = new Map();
  const reg = {
    kind,
    register(entry) {
      if (!entry || typeof entry !== "object") throw new Error(`A ${kind} must be an object`);
      for (const k of required) if (entry[k] === undefined) throw new Error(`A ${kind} needs "${k}"`);
      if (!KEBAB.test(entry.id)) throw new Error(`${kind} id "${entry.id}" must be kebab-case`);
      if (items.has(entry.id)) throw new Error(`${kind} "${entry.id}" is already registered`);
      items.set(entry.id, { ...defaults, ...entry });
      return reg;
    },
    get(id) { const e = items.get(id); if (!e) throw new Error(`No ${kind} "${id}" (have: ${[...items.keys()].join(", ") || "none"})`); return e; },
    has: (id) => items.has(id),
    list: () => [...items.values()],
    ids: () => [...items.keys()],
    // Factory: an entry with make(options) builds a configured instance.
    create(id, options = {}) { const e = reg.get(id); if (typeof e.make !== "function") throw new Error(`${kind} "${id}" has no make()`); return e.make(options); },
    unregister: (id) => items.delete(id),
  };
  return reg;
}
module.exports = { createRegistry };
