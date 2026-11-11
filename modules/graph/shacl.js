// SHACL core over the knowledge graph store (REQ-065, proposed): shapes (Turtle) and data are loaded into Oxigraph
// stores and each constraint is checked with SPARQL. Supported: sh:targetClass; sh:path as an IRI or
// [ sh:inversePath IRI ]; sh:minCount, sh:maxCount, sh:datatype, sh:class, sh:in, sh:pattern, sh:message.
const { Store } = require("oxigraph");
const SH = "http://www.w3.org/ns/shacl#", RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const rows = (store, q) => [...store.query(q)].map((m) => Object.fromEntries([...m.entries()].map(([k, t]) => [k, t])));
const list = (store, head) => { const out = []; let n = head, guard = 0; while (n && n.value !== `${RDF}nil` && guard++ < 200) { const r = rows(store, `SELECT ?f ?r WHERE { <${n.value}> <${RDF}first> ?f ; <${RDF}rest> ?r }`.replace(`<${n.value}>`, n.termType === "BlankNode" ? `_:${n.value}` : `<${n.value}>`)); if (!r.length) break; out.push(r[0].f); n = r[0].r; } return out; };

function loadShapes(ttl) {
  const s = new Store(); s.load(ttl, { format: "text/turtle" });
  // Blank nodes can't be named in a later query, so read every property shape's fields in one query per field.
  const shapes = [];
  for (const ns of rows(s, `SELECT ?shape ?cls WHERE { ?shape a <${SH}NodeShape> ; <${SH}targetClass> ?cls }`)) {
    const props = rows(s, `SELECT ?p ?path ?inv ?min ?max ?dt ?cls ?pat ?msg ?in WHERE { <${ns.shape.value}> <${SH}property> ?p .
      OPTIONAL { ?p <${SH}path> ?path FILTER(isIRI(?path)) } OPTIONAL { ?p <${SH}path> ?b . ?b <${SH}inversePath> ?inv }
      OPTIONAL { ?p <${SH}minCount> ?min } OPTIONAL { ?p <${SH}maxCount> ?max } OPTIONAL { ?p <${SH}datatype> ?dt } OPTIONAL { ?p <${SH}class> ?cls }
      OPTIONAL { ?p <${SH}pattern> ?pat } OPTIONAL { ?p <${SH}message> ?msg } OPTIONAL { ?p <${SH}in> ?in } }`);
    // sh:in lists: walk each list with a store-side query from the property shape (blank node ids are per-store).
    const inLists = new Map();
    for (const r of rows(s, `SELECT ?p ?v WHERE { <${ns.shape.value}> <${SH}property> ?p . ?p <${SH}in>/<${RDF}rest>*/<${RDF}first> ?v }`)) { const k = r.p.value; if (!inLists.has(k)) inLists.set(k, []); inLists.get(k).push(r.v); }
    shapes.push({ id: ns.shape.value, targetClass: ns.cls.value, properties: props.map((p) => ({
      path: p.path ? p.path.value : null, inverse: p.inv ? p.inv.value : null, min: p.min ? Number(p.min.value) : null, max: p.max ? Number(p.max.value) : null,
      datatype: p.dt ? p.dt.value : null, class: p.cls ? p.cls.value : null, pattern: p.pat ? p.pat.value : null, message: p.msg ? p.msg.value : null,
      in: inLists.get(p.p.value) || null })) });
  }
  return shapes;
}

// Validate data (a Store, or N-Quads/N-Triples lines) against shapes. Returns { conforms, results: [{ focus, shape, path, message }] }.
function validate(shapes, data) {
  let store = data; if (!(data instanceof Store)) { store = new Store(); store.load(Array.isArray(data) ? data.join("\n") : data, { format: "application/n-quads" }); }
  const results = [];
  for (const sh of shapes) {
    const focus = rows(store, `SELECT DISTINCT ?f WHERE { { ?f a <${sh.targetClass}> } UNION { GRAPH ?g { ?f a <${sh.targetClass}> } } }`).map((r) => r.f);
    for (const f of focus) for (const p of sh.properties) {
      if (!p.path && !p.inverse) continue;
      const pat = p.inverse ? `?v <${p.inverse}> <${f.value}>` : `<${f.value}> <${p.path}> ?v`;
      const vals = rows(store, `SELECT ?v WHERE { { ${pat} } UNION { GRAPH ?g { ${pat} } } }`).map((r) => r.v);
      const pathLabel = p.inverse ? `^${p.inverse}` : p.path, add = (why) => results.push({ focus: f.value, shape: sh.id, path: pathLabel, message: p.message ? `${p.message} (${why})` : why });
      if (p.min !== null && vals.length < p.min) add(`${vals.length} value(s), at least ${p.min} needed`);
      if (p.max !== null && vals.length > p.max) add(`${vals.length} value(s), at most ${p.max} allowed`);
      for (const v of vals) {
        if (p.datatype && (v.termType !== "Literal" || v.datatype.value !== p.datatype)) add(`${v.value} isn't a ${p.datatype.split("#").pop()}`);
        if (p.class && !rows(store, `ASK { { <${v.value}> a <${p.class}> } UNION { GRAPH ?g { <${v.value}> a <${p.class}> } } }`.replace(/^ASK/, "SELECT (1 AS ?x) WHERE")).length) add(`${v.value} isn't a ${p.class.split("#").pop()}`);
        if (p.in && !p.in.some((x) => x.value === v.value)) add(`${v.value} isn't one of ${p.in.map((x) => x.value).join(", ")}`);
        if (p.pattern && !new RegExp(p.pattern).test(v.value)) add(`“${v.value}” doesn't match ${p.pattern}`);
      }
    }
  }
  return { conforms: !results.length, results };
}
module.exports = { loadShapes, validate };
