// The knowledge graph store (REQ-063, proposed): RDF with SPARQL behind one adapter, two engines.
//   oxilite (@oxilite/node): Oxigraph-compatible, on a SQLite file (DATA_DIR/kg.sqlite), used when its native build
//     loads and the app runs on SQLite (a local machine). Its npm package ships a macOS arm64 binary today.
//   Oxigraph (WebAssembly): same API, runs everywhere (Linux, Vercel); in memory, so every write saves an N-Quads
//     snapshot to data_kg_snapshots and every read checks the snapshot's version, so another server instance's write
//     is seen. A snapshot over MAX_TRIPLES is refused (Neon Free).
// KG_ENGINE=oxigraph|oxilite forces one. Queries from outside are read-only; writes go through write().
const path = require("node:path"), fs = require("node:fs");
const NS = "https://superintelligence-homepage.example/ns#", MAX_TRIPLES = Number(process.env.KG_MAX_TRIPLES || 20000);
const READ = /^(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i;
// Comments start at a "#" after whitespace or a line start (a "#" inside an IRI like <...ns#> is not one).
const stripPrologue = (q) => String(q).replace(/(^|\s)#[^\n]*/g, "$1").replace(/^\s*((PREFIX\s+[\w-]*:\s*<[^>]*>|BASE\s+<[^>]*>)\s*)*/i, "").trim();
const isReadOnly = (q) => READ.test(stripPrologue(q)) && !/\b(INSERT|DELETE|LOAD|CLEAR|DROP|CREATE|COPY|MOVE|ADD)\s+(DATA|WHERE|SILENT|GRAPH|DEFAULT|NAMED|ALL|\{|<)/i.test(stripPrologue(q).replace(/"(?:[^"\\]|\\.)*"/g, '""'));

// N-Quads terms. Literals are escaped; IRIs must not contain spaces or angle brackets.
const iri = (s) => { const v = String(s); if (/[\s<>"{}|^`\\]/.test(v)) throw new Error(`Not an IRI: ${v.slice(0, 80)}`); return `<${v}>`; };
const si = (local) => iri(NS + local);
const lit = (v, type) => {
  const s = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  if (type === "int" || (type === undefined && Number.isInteger(v))) return `"${s}"^^<http://www.w3.org/2001/XMLSchema#integer>`;
  if (type === "decimal" || (type === undefined && typeof v === "number")) return `"${s}"^^<http://www.w3.org/2001/XMLSchema#decimal>`;
  if (type === "bool" || typeof v === "boolean") return `"${s}"^^<http://www.w3.org/2001/XMLSchema#boolean>`;
  if (type === "date") return `"${s}"^^<http://www.w3.org/2001/XMLSchema#dateTime>`;
  return `"${s}"`;
};
const A = iri("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), LABEL = iri("http://www.w3.org/2000/01/rdf-schema#label");

// SELECT -> { vars, rows: [{ var: value }] }, ASK -> boolean, CONSTRUCT/DESCRIBE -> { triples: N-Triples lines }.
function toJson(res) {
  if (typeof res === "boolean") return { boolean: res };
  const arr = Array.isArray(res) ? res : [...res];
  if (!arr.length) return { vars: [], rows: [] };
  if (arr[0] instanceof Map) {
    const vars = [...new Set(arr.flatMap((m) => [...m.keys()]))];
    return { vars, rows: arr.map((m) => Object.fromEntries([...m.entries()].map(([k, t]) => [k, t.value]))) };
  }
  return { triples: arr.map((q) => `${q.subject.termType === "NamedNode" ? `<${q.subject.value}>` : `_:${q.subject.value}`} <${q.predicate.value}> ${q.object.termType === "Literal" ? JSON.stringify(q.object.value) : `<${q.object.value}>`} .`) };
}

let current = null; // one store per process
async function open(db, { dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data"), engine = process.env.KG_ENGINE || "" } = {}) {
  if (current && current.db === db) return current;
  let store = null, kind = null, note = "";
  if (engine !== "oxigraph" && (engine === "oxilite" || db.engine === "sqlite")) {
    try {
      const ox = await import("@oxilite/node");
      fs.mkdirSync(dataDir, { recursive: true });
      store = new ox.Store({ path: path.join(dataDir, "kg.sqlite") }); kind = "oxilite";
    } catch (e) { note = `oxilite unavailable here (${String(e.message).split("\n")[0].slice(0, 400)})`; if (engine === "oxilite") throw e; }
  }
  if (!store) { const { Store } = require("oxigraph"); store = new Store(); kind = "oxigraph"; }
  const kg = { db, kind, note, store, version: -1, persistent: kind === "oxilite" ? "sqlite file" : "snapshot in the app database" };
  // Oxigraph: load the newest snapshot now, and again whenever another instance has written a newer one.
  kg.sync = async () => {
    if (kind !== "oxigraph") return;
    const row = await db.get("SELECT version FROM data_kg_snapshots WHERE name = 'main'");
    if (!row || row.version === kg.version) return;
    const full = await db.get("SELECT nquads, version FROM data_kg_snapshots WHERE name = 'main'");
    const { Store } = require("oxigraph"); const s = new Store(); if (full.nquads) s.load(full.nquads, { format: "application/n-quads" });
    kg.store = s; kg.version = full.version;
  };
  kg.persist = async () => {
    if (kind !== "oxigraph") return;
    const nq = kg.store.dump({ format: "application/n-quads" }), n = kg.store.size, now = db.now ? db.now() : new Date().toISOString();
    const have = await db.get("SELECT version FROM data_kg_snapshots WHERE name = 'main'");
    if (have) await db.run("UPDATE data_kg_snapshots SET nquads = ?, triples = ?, version = ?, updated_at = ? WHERE name = 'main'", nq, n, have.version + 1, now);
    else await db.run("INSERT INTO data_kg_snapshots (name, nquads, triples, version, updated_at) VALUES ('main', ?, ?, 1, ?)", nq, n, now);
    kg.version = (have ? have.version : 0) + 1;
  };
  kg.query = async (q) => { if (!isReadOnly(q)) { const e = new Error("Only read-only SPARQL (SELECT, ASK, CONSTRUCT, DESCRIBE) can be run here; changes go through actions."); e.status = 400; throw e; } await kg.sync(); return toJson(kg.store.query(q)); };
  // Replace one named graph with the given N-Quads lines (each "s p o ." without a graph; the graph is added here).
  kg.replaceGraph = async (graph, lines) => {
    await kg.sync();
    const g = iri(graph), before = kg.store.size;
    // Refuse before touching anything when the result would pass the limit (works for both engines).
    const had = Number(toJson(kg.store.query(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH ${g} { ?s ?p ?o } }`)).rows[0]?.n || 0);
    if (before - had + lines.length > MAX_TRIPLES) { const e = new Error(`The knowledge graph would hold ${before - had + lines.length} triples, over the ${MAX_TRIPLES} limit; nothing was written.`); e.status = 400; throw e; }
    kg.store.update(`DROP SILENT GRAPH ${g}`);
    const nq = lines.map((l) => l.replace(/\s*\.\s*$/, ` ${g} .`)).join("\n");
    if (nq) kg.store.load(nq, { format: "application/n-quads" });
    await kg.persist();
    return { graph, triples: lines.length, delta: kg.store.size - before };
  };
  kg.addLinks = async (lines) => { await kg.sync(); kg.store.load(lines.map((l) => l.replace(/\s*\.\s*$/, ` ${iri("urn:si:links")} .`)).join("\n"), { format: "application/n-quads" }); await kg.persist(); };
  kg.info = async () => { await kg.sync(); return { engine: kind, persistent: kg.persistent, triples: kg.store.size, max: MAX_TRIPLES, note }; };
  await kg.sync();
  current = kg;
  return kg;
}
const reset = () => { current = null; };

module.exports = { open, reset, NS, iri, si, lit, A, LABEL, isReadOnly, toJson, MAX_TRIPLES };
