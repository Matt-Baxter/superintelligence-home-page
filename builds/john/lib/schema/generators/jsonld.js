// JSON-LD context: makes API JSON (stories, tags, chunks, edges) linked data with schema.org terms.
module.exports = {
  id: "json-ld", file: "context.jsonld", about: "JSON-LD 1.1 context",
  generate(m) {
    const ctx = { ...m.ld };
    for (const t of m.types) {
      if (t.ld) ctx[t.name] = t.ld;
      for (const f of t.fields) {
        if (ctx[f.name] && typeof ctx[f.name] === "object") continue;
        if (f.ld === "@id") ctx[f.name] = "@id";
        else if (f.ld) ctx[f.name] = f.base === "datetime" ? { "@id": f.ld, "@type": "schema:DateTime" } : f.list && !f.scalar ? { "@id": f.ld, "@container": "@set" } : f.ld;
        else if (!ctx[f.name]) ctx[f.name] = f.list ? { "@id": `si:${f.name}`, "@container": "@set" } : `si:${f.name}`;
      }
    }
    return JSON.stringify({ "@context": { "@version": 1.1, ...ctx } }, null, 2) + "\n";
  },
};
