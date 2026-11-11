// si-elements: one portable descriptor for any element of a system (a table, a type, an API operation, a module, a
// requirement, a task, a document collection), and the generators that make it interoperable. No dependencies;
// copy this folder into any repo. The descriptor (element.schema.json) says, for every element:
//   what it is        id (kind:name), kind, label, description, aliases, tags, owner, source file
//   its properties    name, type, required, unique, unit, enum, pattern, min/max, maxLength, description, aliases
//   its keys          surrogate (a generated id), primary, natural keys, unique sets
//   its grain         one row (or item) per what, and the keys that make the grain unique
//   its relationships rel, target, direction, cardinality, via (column), inverse, on delete, acyclic (a DAG)
//   its constraints   anything else that must hold (check, range, pattern, acyclic, retention)
//   its lifecycle     perpetual | versioned | leased | append-only | ephemeral | generated, and its retention
//   its series        the time property, cadence, order and retention, for elements that grow over time
//   its graph         the RDF class and the named graph its rows live in (quads)
// Generators: SHACL shapes (core, plus SHACL-SPARQL for keys), N-Quads of the descriptors, JSON-LD, rows as quads,
// key and grain checks on rows, the relationship DAG, alias resolution, and a completeness score.
"use strict";

const NS = "https://superintelligence-homepage.example/ns#";
const XSD = "http://www.w3.org/2001/XMLSchema#", RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#", RDFS = "http://www.w3.org/2000/01/rdf-schema#", SH = "http://www.w3.org/ns/shacl#";
const KINDS = ["table", "type", "collection", "operation", "module", "requirement", "task", "learning", "page", "view", "block", "document", "file"];
const TYPES = { string: "string", text: "string", integer: "integer", decimal: "decimal", number: "decimal", boolean: "boolean", dateTime: "dateTime", date: "date", json: "string", iri: null };
const LIFECYCLES = ["perpetual", "versioned", "leased", "append-only", "ephemeral", "generated"];
const CARD = ["1", "0..1", "0..*", "1..*"];
const DIRECTIONS = ["out", "in", "both"];
const ID_RE = /^[a-z][a-z0-9-]*:[A-Za-z0-9_.\/@-]+$/;

const pascal = (s) => String(s).replace(/(^|[^A-Za-z0-9])([A-Za-z0-9])/g, (m, a, b) => b.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
const camel = (s) => { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1); };
const classOf = (d, ns = NS) => (d.graph && d.graph.class) || `${ns}${pascal(d.kind)}${pascal(d.id.split(":").slice(1).join(":"))}`;
const propIri = (d, p, ns = NS) => `${ns}${camel(d.id.split(":").slice(1).join(":"))}_${camel(p)}`;
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
const lit = (v, dt) => (dt ? `"${esc(v)}"^^<${dt}>` : `"${esc(v)}"`);
const iri = (s) => { if (/[\s<>"{}|\\^`]/.test(s)) throw new Error(`Not an IRI: ${s}`); return `<${s}>`; };

// ---------------------------------------------------------------------------------------------------------------
// Validation: is it a well-formed descriptor? (structure, not completeness)
function validate(d) {
  const e = [], at = (m) => e.push(`${d && d.id ? d.id : "?"}: ${m}`);
  if (!d || typeof d !== "object") return ["not an object"];
  if (!ID_RE.test(d.id || "")) at("id must be kind:name");
  if (!KINDS.includes(d.kind)) at(`kind must be one of ${KINDS.join(", ")}`);
  if (d.id && d.kind && !d.id.startsWith(`${d.kind}:`)) at("id must start with its kind");
  for (const [n, p] of Object.entries(d.properties || {})) {
    if (!(p.type in TYPES)) at(`property ${n} has unknown type ${p.type}`);
    if (p.min !== undefined && p.max !== undefined && p.min > p.max) at(`property ${n} has min > max`);
  }
  const props = new Set(Object.keys(d.properties || {}));
  const keys = d.keys || {};
  for (const k of [...(keys.primary ? [keys.primary] : []), ...(keys.natural || []), ...(keys.unique || [])]) for (const c of k) if (props.size && !props.has(c)) at(`key column ${c} is not a property`);
  if (keys.surrogate && props.size && !props.has(keys.surrogate)) at(`surrogate ${keys.surrogate} is not a property`);
  for (const r of d.relationships || []) {
    if (!r.rel || !r.target) at("a relationship needs rel and target");
    if (r.direction && !DIRECTIONS.includes(r.direction)) at(`relationship ${r.rel} has direction ${r.direction}`);
    if (r.cardinality && !CARD.includes(r.cardinality)) at(`relationship ${r.rel} has cardinality ${r.cardinality}`);
    if (r.via && props.size && !props.has(r.via)) at(`relationship ${r.rel} goes via ${r.via}, which is not a property`);
  }
  if (d.lifecycle && !LIFECYCLES.includes(d.lifecycle.persistence)) at(`lifecycle must be one of ${LIFECYCLES.join(", ")}`);
  if (d.series && d.series.time && props.size && !props.has(d.series.time)) at(`series time ${d.series.time} is not a property`);
  if (d.grain && d.grain.keys) for (const c of d.grain.keys) if (props.size && !props.has(c)) at(`grain key ${c} is not a property`);
  return e;
}

// Completeness: how much of what an interoperable element should say does it say? Each check is named.
const NEEDS = {
  all: [["description", (d) => (d.description || "").length >= 12], ["tags", (d) => (d.tags || []).length > 0], ["lifecycle", (d) => !!(d.lifecycle && d.lifecycle.persistence)]],
  data: [["properties", (d) => Object.keys(d.properties || {}).length > 0], ["keys", (d) => (d.lifecycle && d.lifecycle.persistence === "ephemeral") || !!(d.keys && (d.keys.primary || d.keys.surrogate || (d.keys.natural || []).length))], // a message shape has no identity to key
    ["grain", (d) => !!(d.grain && d.grain.statement)], ["property descriptions", (d) => Object.values(d.properties || {}).every((p) => p.description)],
    ["series", (d) => !hasTime(d) || !!(d.series && d.series.time)]],
};
const DATA_KINDS = new Set(["table", "type", "collection"]);
const hasTime = (d) => Object.entries(d.properties || {}).some(([n, p]) => p.type === "dateTime" || /(^|_)(at|date|time)$/.test(n));
function completeness(d) {
  const checks = [...NEEDS.all, ...(DATA_KINDS.has(d.kind) ? NEEDS.data : [])];
  const missing = checks.filter(([, f]) => !f(d)).map(([n]) => n);
  return { score: +(1 - missing.length / checks.length).toFixed(2), missing, checks: checks.length };
}

// Overlays: what code can't know (grain, series, aliases, tags, descriptions) comes from a reviewed file.
function merge(d, o) {
  if (!o) return d;
  const out = { ...d, ...Object.fromEntries(Object.entries(o).filter(([k]) => !["aliases", "tags", "properties", "relationships", "constraints"].includes(k))) };
  out.aliases = [...new Set([...(d.aliases || []), ...(o.aliases || [])])];
  out.tags = [...new Set([...(d.tags || []), ...(o.tags || [])])];
  out.properties = { ...(d.properties || {}) };
  for (const [n, p] of Object.entries(o.properties || {})) out.properties[n] = { ...(out.properties[n] || {}), ...p };
  out.relationships = [...(d.relationships || []), ...(o.relationships || [])];
  out.constraints = [...(d.constraints || []), ...(o.constraints || [])];
  return out;
}

// Aliases resolve to one element; an alias claimed by two elements is a conflict.
function aliasIndex(descs) {
  const idx = new Map(), conflicts = [];
  for (const d of descs) for (const a of [d.id, d.id.split(":").slice(1).join(":"), d.label, ...(d.aliases || [])].filter(Boolean)) {
    const k = String(a).toLowerCase(), have = idx.get(k);
    if (have && have !== d.id) { if (a !== d.id.split(":").slice(1).join(":")) conflicts.push({ alias: a, ids: [have, d.id] }); } else idx.set(k, d.id);
  }
  return { resolve: (name) => idx.get(String(name).toLowerCase()) || null, conflicts, size: idx.size };
}

// ---------------------------------------------------------------------------------------------------------------
// SHACL: one node shape per element. SHACL core for properties and relationships; keys and grain as SHACL-SPARQL
// constraints (standard SHACL, checked here by checkRows because the core validator doesn't run SPARQL constraints).
function toShacl(descs, { ns = NS, header = true } = {}) {
  const L = header ? [`@prefix sh: <${SH}> .`, `@prefix xsd: <${XSD}> .`, `@prefix rdfs: <${RDFS}> .`, `@prefix si: <${ns}> .`, ""] : [];
  for (const d of descs) {
    if (!Object.keys(d.properties || {}).length && !(d.relationships || []).length) continue;
    const ps = [];
    for (const [n, p] of Object.entries(d.properties || {})) {
      const rel = (d.relationships || []).find((r) => r.via === n && r.direction !== "in");
      const f = [`sh:path <${propIri(d, n, ns)}>`, `sh:maxCount 1`];
      if (p.required) f.push("sh:minCount 1");
      if (rel && rel.targetClass !== false) f.push(`sh:class <${rel.targetClassIri || classOfId(rel.target, ns)}>`);
      else if (TYPES[p.type]) f.push(`sh:datatype xsd:${TYPES[p.type]}`);
      if (p.enum) f.push(`sh:in ( ${p.enum.map((v) => lit(v)).join(" ")} )`);
      if (p.pattern) f.push(`sh:pattern "${esc(p.pattern)}"`);
      if (p.min !== undefined) f.push(`sh:minInclusive ${p.min}`);
      if (p.max !== undefined) f.push(`sh:maxInclusive ${p.max}`);
      if (p.maxLength) f.push(`sh:maxLength ${p.maxLength}`);
      f.push(`sh:message "${esc(`${d.id}.${n}: ${[p.required ? "required" : "optional", rel ? `points at ${rel.target}` : p.type, p.enum ? `one of ${p.enum.join(" | ")}` : ""].filter(Boolean).join(", ")}.`)}"`);
      ps.push(`  sh:property [ ${f.join(" ; ")} ]`);
    }
    const keySets = [...(d.keys && d.keys.primary ? [d.keys.primary] : []), ...((d.keys && d.keys.natural) || []), ...((d.keys && d.keys.unique) || [])];
    const sparql = keySets.map((k) => `  sh:sparql [ a sh:SPARQLConstraint ; sh:message "${esc(`${d.id}: (${k.join(", ")}) must be unique`)}" ; sh:select """SELECT $this WHERE { ?other a <${classOf(d, ns)}> . FILTER(?other != $this) ${k.map((c, i) => `$this <${propIri(d, c, ns)}> ?k${i} . ?other <${propIri(d, c, ns)}> ?k${i} .`).join(" ")} }""" ]`);
    L.push(`# ${d.id}${d.grain && d.grain.statement ? ` · grain: ${d.grain.statement}` : ""}`, `<${ns}${pascal(d.id)}Shape> a sh:NodeShape ; sh:targetClass <${classOf(d, ns)}> ; rdfs:comment "${esc(d.description || d.id)}" ;`, [...ps, ...sparql].join(" ;\n") + " .", "");
  }
  return L.join("\n");
}
const classOfId = (id, ns = NS) => classOf({ id, kind: id.split(":")[0] }, ns);

// N-Quads describing the descriptors themselves (the catalog as data, in one named graph).
function toQuads(descs, { graph = "urn:si:elements", ns = NS } = {}) {
  const G = graph ? iri(graph) : null, out = [], q = (s, p, o) => out.push(G ? `${s} ${p} ${o} ${G} .` : `${s} ${p} ${o} .`);
  const el = (d) => iri(`urn:si:element:${d.id}`);
  for (const d of descs) {
    const s = el(d);
    q(s, iri(`${RDF}type`), iri(`${ns}Element`)); q(s, iri(`${ns}kind`), lit(d.kind)); q(s, iri(`${RDFS}label`), lit(d.label || d.id));
    if (d.description) q(s, iri(`${RDFS}comment`), lit(d.description));
    q(s, iri(`${ns}describesClass`), iri(classOf(d, ns)));
    for (const a of d.aliases || []) q(s, iri(`${ns}alias`), lit(a));
    for (const t of d.tags || []) q(s, iri(`${ns}tag`), lit(t));
    if (d.owner) q(s, iri(`${ns}owner`), lit(d.owner));
    if (d.grain && d.grain.statement) q(s, iri(`${ns}grain`), lit(d.grain.statement));
    if (d.lifecycle) { q(s, iri(`${ns}persistence`), lit(d.lifecycle.persistence)); if (d.lifecycle.retention) q(s, iri(`${ns}retention`), lit(d.lifecycle.retention)); }
    if (d.series && d.series.time) { q(s, iri(`${ns}seriesTime`), lit(d.series.time)); if (d.series.cadence) q(s, iri(`${ns}seriesCadence`), lit(d.series.cadence)); }
    if (d.keys && d.keys.surrogate) q(s, iri(`${ns}surrogateKey`), lit(d.keys.surrogate));
    for (const k of [...(d.keys && d.keys.primary ? [d.keys.primary] : []), ...((d.keys && d.keys.natural) || [])]) q(s, iri(`${ns}naturalKey`), lit(k.join(",")));
    for (const [n, p] of Object.entries(d.properties || {})) { const pi = iri(`urn:si:element:${d.id}#${n}`); q(s, iri(`${ns}hasProperty`), pi); q(pi, iri(`${RDFS}label`), lit(n)); q(pi, iri(`${ns}type`), lit(p.type)); if (p.required) q(pi, iri(`${ns}required`), lit("true", `${XSD}boolean`)); if (p.description) q(pi, iri(`${RDFS}comment`), lit(p.description)); }
    for (const r of d.relationships || []) { q(s, iri(`${ns}rel_${camel(r.rel)}`), iri(`urn:si:element:${r.target}`)); }
  }
  return out;
}

function toJsonLd(descs, { ns = NS } = {}) {
  return { "@context": { "@vocab": ns, rdfs: RDFS, label: "rdfs:label", description: "rdfs:comment", id: "@id", relationships: { "@container": "@list" } },
    "@graph": descs.map((d) => ({ ...d, "@id": `urn:si:element:${d.id}`, "@type": "Element" })) };
}

// ---------------------------------------------------------------------------------------------------------------
// Rows as quads: subject from the surrogate (or the natural/primary key), each property a typed literal when its value
// fits the declared type (otherwise a plain string, so the shape reports it), each relationship an IRI to the target's
// row. The graph is urn:si:data:<name>.
const fits = (v, t) => t === "integer" ? Number.isInteger(typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v) : t === "decimal" || t === "number" ? typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
  : t === "boolean" ? v === true || v === false || v === 0 || v === 1 : t === "dateTime" ? typeof v === "string" && !isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}T/.test(v) : t === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(String(v)) : true;
const keyOf = (d) => (d.keys && d.keys.surrogate ? [d.keys.surrogate] : (d.keys && (d.keys.primary || (d.keys.natural || [])[0])) || null);
const subjectOf = (d, row, base) => { const k = keyOf(d); if (!k) return null; const vals = k.map((c) => row[c]); if (vals.some((v) => v === null || v === undefined)) return null; return `${base}${d.id.replace(":", "/")}/${vals.map((v) => encodeURIComponent(String(v))).join("/")}`; };
function rowToQuads(d, row, { base = "urn:si:", ns = NS, targets = {} } = {}) {
  const s = subjectOf(d, row, base); if (!s) return { quads: [], subject: null, skipped: "no key value" };
  const G = iri(`urn:si:data:${d.id}`), out = [`${iri(s)} ${iri(`${RDF}type`)} ${iri(classOf(d, ns))} ${G} .`];
  for (const [n, p] of Object.entries(d.properties || {})) {
    const v = row[n]; if (v === null || v === undefined) continue;
    const rel = (d.relationships || []).find((r) => r.via === n && r.direction !== "in");
    if (rel && targets[rel.target]) { out.push(`${iri(s)} ${iri(propIri(d, n, ns))} ${iri(`${base}${rel.target.replace(":", "/")}/${encodeURIComponent(String(v))}`)} ${G} .`); continue; }
    const t = TYPES[p.type], dt = t && fits(v, p.type) ? `${XSD}${t}` : null;
    const lex = p.type === "boolean" && dt ? String(v === true || v === 1) : String(v);
    out.push(`${iri(s)} ${iri(propIri(d, n, ns))} ${lit(lex, dt)} ${G} .`);
  }
  return { quads: out, subject: s };
}

// Keys and grain on rows: required values, unique key sets, the grain's keys unique, foreign keys resolvable.
function checkRows(d, rows, { lookup = null } = {}) {
  const problems = [];
  for (const [n, p] of Object.entries(d.properties || {})) if (p.required) rows.forEach((r, i) => { if (r[n] === null || r[n] === undefined || r[n] === "") problems.push({ row: i, rule: "required", message: `${d.id}.${n} is empty in row ${i}` }); });
  const sets = [...(d.keys && d.keys.primary ? [["primary", d.keys.primary]] : []), ...(d.keys && d.keys.surrogate ? [["surrogate", [d.keys.surrogate]]] : []), ...((d.keys && d.keys.natural) || []).map((k) => ["natural", k]), ...((d.keys && d.keys.unique) || []).map((k) => ["unique", k]), ...(d.grain && d.grain.keys ? [["grain", d.grain.keys]] : [])];
  for (const [kind, cols] of sets) {
    const seen = new Map();
    rows.forEach((r, i) => { if (cols.some((c) => r[c] === null || r[c] === undefined)) return; const k = JSON.stringify(cols.map((c) => (typeof r[c] === "string" && /lower/i.test(kind) ? r[c].toLowerCase() : r[c]))); if (seen.has(k)) problems.push({ row: i, rule: kind, message: `${d.id}: ${kind} key (${cols.join(", ")}) repeats rows ${seen.get(k)} and ${i}` }); else seen.set(k, i); });
  }
  for (const [n, p] of Object.entries(d.properties || {})) if (p.enum) rows.forEach((r, i) => { const v = r[n]; if (v !== null && v !== undefined && !p.enum.includes(v)) problems.push({ row: i, rule: "enum", message: `${d.id}.${n} = ${JSON.stringify(v)} in row ${i} is not one of ${p.enum.join(", ")}` }); });
  for (const c of d.constraints || []) if (c.kind === "vocabulary" && Array.isArray(c.value) && c.value.length) rows.forEach((r, i) => { for (const v of [].concat(r[c.on] || [])) if (!c.value.includes(v)) problems.push({ row: i, rule: "vocabulary", message: `${d.id}.${c.on} has "${v}" in row ${i}, which isn't in the vocabulary` }); });
  for (const c of d.constraints || []) if (c.kind === "acyclic" && Array.isArray(c.on) && c.on.length === 2) {
    const g = new Map(); for (const r of rows) { const a = r[c.on[0]], b = r[c.on[1]]; if (a == null || b == null) continue; if (!g.has(a)) g.set(a, []); g.get(a).push(b); }
    const state = new Map(), stack = []; let loop = null;
    const visit = (n) => { if (loop) return; state.set(n, 1); stack.push(n); for (const m of g.get(n) || []) { if (state.get(m) === 1) { loop = [...stack.slice(stack.indexOf(m)), m]; return; } if (!state.get(m)) visit(m); } stack.pop(); state.set(n, 2); };
    for (const n of g.keys()) if (!state.get(n)) visit(n);
    if (loop) problems.push({ row: null, rule: "acyclic", message: `${d.id}: ${c.on.join(" → ")} loops: ${loop.join(" → ")}` });
  }
  if (lookup) for (const r of d.relationships || []) if (r.via && r.direction !== "in") rows.forEach((row, i) => { const v = row[r.via]; if (v !== null && v !== undefined && !lookup(r.target, v)) problems.push({ row: i, rule: "reference", message: `${d.id}.${r.via} = ${v} points at no ${r.target}` }); });
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// The relationship graph: direction from each relationship; acyclic relations must form a DAG.
function dag(descs, { rels = null } = {}) {
  const ids = new Set(descs.map((d) => d.id)), edges = [];
  for (const d of descs) for (const r of d.relationships || []) {
    if (rels && !rels.includes(r.rel)) continue;
    if (r.target === d.id && !r.acyclic) continue; // a self-reference (a tree) isn't a cycle between elements
    const [from, to] = r.direction === "in" ? [r.target, d.id] : [d.id, r.target];
    edges.push({ from, to, rel: r.rel, acyclic: !!r.acyclic, known: ids.has(r.target) });
  }
  const order = [], indeg = new Map([...ids].map((i) => [i, 0])), out = new Map([...ids].map((i) => [i, []]));
  for (const e of edges) if (ids.has(e.from) && ids.has(e.to)) { out.get(e.from).push(e.to); indeg.set(e.to, indeg.get(e.to) + 1); }
  const queue = [...ids].filter((i) => indeg.get(i) === 0).sort();
  while (queue.length) { const n = queue.shift(); order.push(n); for (const m of out.get(n)) { indeg.set(m, indeg.get(m) - 1); if (!indeg.get(m)) queue.push(m); } }
  const cyclic = [...ids].filter((i) => !order.includes(i));
  // A cycle matters only if it runs through an edge declared acyclic.
  const bad = edges.filter((e) => e.acyclic && cyclic.includes(e.from) && cyclic.includes(e.to));
  return { edges, order, isDag: cyclic.length === 0, cyclic, violations: bad, dangling: edges.filter((e) => !e.known) };
}

module.exports = { NS, KINDS, TYPES, LIFECYCLES, CARD, validate, completeness, merge, aliasIndex, toShacl, toQuads, toJsonLd, rowToQuads, checkRows, dag, classOf, propIri, pascal, camel, subjectOf };
