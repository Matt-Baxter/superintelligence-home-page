// Built-in element providers (REQ-072, REQ-073, proposed). A provider is { id, about, describe(ctx) -> descriptors,
// rows?(elementId, ctx) -> rows }. Modules add their own through the "elements.providers" extension point; other
// repos plug in the same way (vibe.js reads a vibe-coding checkout's prompts.md files).
const fs = require("node:fs"), path = require("node:path");
const ROOT = path.join(__dirname, "..", "..");
const SQL = require("./sql");

// Property descriptions from naming conventions, marked inferred, so a reader always gets something and the overlay
// can replace any of them with a reviewed sentence.
function inferDescription(table, col, p, rel) {
  if (rel) return `The ${rel.target.split(":")[1].replace(/_/g, " ").replace(/ies$/, "y").replace(/s$/, "")} this row ${rel.cardinality === "1" ? "belongs to" : "refers to, if any"} (${rel.target}.${rel.onDelete ? `; on delete ${rel.onDelete}` : ""})`.replace(".;", ";");
  if (col === "id") return `Surrogate key of ${table}: a generated number with no meaning outside this database.`;
  if (col === "at") return "When it happened (UTC, ISO 8601 text).";
  if (/_at$|^first_seen$|^last_(fetched|ok)$/.test(col)) { const w = col.replace(/_at$/, "").replace(/_/g, " "); return /^(created|updated|released|submitted|published|resolved|added|seen|started|finished|completed)$/.test(w) ? `When it was ${w} (UTC, ISO 8601 text).` : w === "expires" ? "When it expires (UTC, ISO 8601 text)." : `When the ${w} happened (UTC, ISO 8601 text).`; }
  if (/_date$/.test(col)) return `The ${col.replace(/_/g, " ")} (YYYY-MM-DD).`;
  if (/^(slug|akey|key)$/.test(col)) return `The ${col === "akey" ? "artifact's key within its kind" : col === "slug" ? "URL-safe name, unique" : "lookup key"}.`;
  if (/(^|_)qid$/.test(col)) return `A qualified id (namespace:id, docs/NAMING.md)${col !== "qid" ? ` of the ${col.replace(/_qid$/, "").replace(/_/g, " ")}` : ""}.`;
  if (/^(error|last_error)$/.test(col)) return "The error message from the last failure, if any.";
  if (/^(revision|published_revision|ord|sort_order|number|priority)$/.test(col)) return `${col.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())} (a number; higher is later or more important where it orders).`;
  if (/^published_(title|summary|body)$/.test(col)) return `The ${col.replace("published_", "")} as last published (the live copy).`;
  if (/^(src|dst)$/.test(col)) return `The edge's ${col === "src" ? "source" : "destination"} node (a qualified id).`;
  if (/^(rel|action)$/.test(col)) return `The ${col === "rel" ? "relation" : "action"} name.`;
  if (/^(weight|value|score|accuracy|triples|metric|unit)$/.test(col)) return `${col.charAt(0).toUpperCase()}${col.slice(1)} of this row (see its table for the scale).`;
  if (/^(tags|labels)$/.test(col)) return `${col.charAt(0).toUpperCase()}${col.slice(1)} as JSON text (a list of qualified ids or words).`;
  if (/^(hash)$/.test(col)) return "A content hash, to notice changes.";
  if (/^(model|vector)$/.test(col)) return col === "model" ? "The embedding model's name." : "The embedding vector as JSON text.";
  if (/^(actor|task|branch|intent|finding|asked_by|target|outlet|outlet_label|sentence|due|entity|example_id|concept_id|proposer|policy|output|result|label_note|authors|excerpt|session_date|agent|link)$/.test(col)) return null;
  if (/^(is_|has_)|^(private|public|soft|forced|disabled)$/.test(col)) return `Flag: ${col.replace(/^(is_|has_)/, "").replace(/_/g, " ")} (0 or 1).`;
  if (/_ms$/.test(col)) return `${col.replace(/_ms$/, "").replace(/_/g, " ")} in milliseconds.`;
  if (/(^|_)(count|chars|items|stored|failures|version)$/.test(col)) return `Count of ${col.replace(/_/g, " ")}.`;
  if (/^(title|name|label)$/.test(col)) return `Human-readable ${col}.`;
  if (/url$|^home$/.test(col)) return "A web address (absolute URL).";
  if (/^(status|state|kind|format|trigger)$/.test(col)) return `The ${col} of this row, from a fixed set of words the code uses.`;
  if (/^(body|package|nquads|detail|note|text|summary|description|files|topics|orgs)$/.test(col)) return `${col.charAt(0).toUpperCase()}${col.slice(1)} (${p.type === "string" ? "text or JSON text" : p.type}).`;
  return null;
}

const tables = { id: "tables", about: "Every SQL table, from the schema SQL in lib/db.js and the modules: columns, keys, references, indexes.",
  describe() {
    return SQL.describe(SQL.collect()).map((d) => {
      for (const [n, p] of Object.entries(d.properties)) { const rel = d.relationships.find((r) => r.via === n); const s = inferDescription(d.label, n, p, rel); if (s && !p.description) { p.description = s; p.inferred = true; } }
      return d;
    });
  },
  async rows(id, ctx) { if (!ctx || !ctx.db || !id.startsWith("table:")) return null; const name = id.slice(6); if (!/^\w+$/.test(name)) return null; return ctx.db.all(`SELECT * FROM ${name} LIMIT ${Math.min(5000, ctx.limit || 1000)}`); } };

const TYPEMAP = { string: "string", int: "integer", float: "decimal", bool: "boolean", datetime: "dateTime", json: "json" };
const types = { id: "types", about: "The canonical knowledge types in schema/types.json (the ones generated into zod, pydantic, protobuf, Arrow, JSON-LD, OpenRPC and Rust).",
  describe() {
    let t; try { t = JSON.parse(fs.readFileSync(path.join(ROOT, "schema", "types.json"), "utf8")); } catch { return []; }
    return Object.entries(t.types || {}).map(([name, ty]) => {
      const properties = {}, relationships = [];
      for (const [f, def] of Object.entries(ty.fields || {})) {
        const raw = def.type, list = raw.endsWith("[]"), opt = raw.endsWith("?"), base = raw.replace(/\[\]$|\?$/g, "");
        const enumDef = t.enums && t.enums[base];
        properties[f] = { type: list ? "json" : TYPEMAP[base] || (enumDef ? "string" : "json"), ...(opt || list ? {} : { required: true }), ...(enumDef ? { enum: enumDef.values } : {}), ...(def.about ? { description: def.about } : {}) };
        if (t.types[base]) relationships.push({ rel: f.replace(/_/g, "-"), target: `type:${base}`, direction: "out", via: f, cardinality: list ? "0..*" : opt ? "0..1" : "1" });
      }
      return { id: `type:${name}`, kind: "type", label: name, description: ty.about || "", source: "schema/types.json", owner: "schema", tags: ["layer:schema", "interop:generated"], properties,
        keys: properties.qid ? { surrogate: null, primary: ["qid"], natural: [["qid"]] } : properties.id ? { surrogate: null, primary: ["id"], natural: [] } : properties.key ? { primary: ["key"], natural: [["key"]] } : null,
        relationships, lifecycle: { persistence: "ephemeral", retention: "a message shape; stored only where a table keeps it" }, graph: { class: `https://superintelligence-homepage.example/ns#${name}` } };
    });
  } };

const operations = { id: "operations", about: "Named data sources (reads) and actions (writes) in the data layer, with their parameters as properties.",
  describe() {
    let reg; try { reg = require("../data/registry"); } catch { return []; }
    const out = [];
    for (const [kind, map] of [["source", reg.sources], ["action", reg.actions]]) for (const d of map.values()) {
      const properties = {};
      for (const [n, p] of Object.entries(d.params || {})) properties[n] = { type: p.type === "array" || p.type === "object" ? "json" : p.type === "number" ? "decimal" : p.type, ...(p.required ? { required: true } : {}), ...(p.enum ? { enum: p.enum } : {}), ...(p.max !== undefined ? (p.type === "string" ? { maxLength: p.max } : { max: p.max }) : {}), ...(p.min !== undefined ? { min: p.min } : {}), ...(p.about ? { description: p.about } : {}) };
      out.push({ id: `operation:${d.id}`, kind: "operation", label: d.id, description: d.about, owner: d.module, tags: [`operation:${kind}`, `access:${d.access}`, ...(d.guard ? ["gated:feature-flag"] : [])], properties,
        relationships: [{ rel: "owned-by", target: `module:${d.module}`, direction: "out", cardinality: "1" }, ...(d.refresh || []).map((s) => ({ rel: "refreshes", target: `operation:${s}`, direction: "out", cardinality: "0..*" }))],
        lifecycle: { persistence: "ephemeral" } });
    }
    return out;
  } };

const modules = { id: "modules", about: "The plug-in modules and what they require (a DAG).",
  describe(ctx) {
    let list = []; try { list = ctx && ctx.kernel ? ctx.kernel.modules : require("../../kernel/kernel").createKernel().modules; } catch { return []; }
    return list.map((m) => ({ id: `module:${m.id}`, kind: "module", label: m.id, description: m.description || "", owner: m.id, source: `modules/${m.id}/module.js`, tags: ["layer:module"],
      relationships: (m.requires || []).map((r) => ({ rel: "requires", target: `module:${r}`, direction: "out", cardinality: "1", acyclic: true })), lifecycle: { persistence: "perpetual", retention: "code" } }));
  } };

const plans = { id: "plans", about: "Requirements from Spec Kit and tasks from Spec Kit and OpenSpec, with what each task depends on (a DAG) and serves.",
  describe() {
    const S = require("../project/specs"), I = require("../work/items"), out = [];
    for (const r of S.collect().reqs) out.push({ id: `requirement:${r.spec}-${r.id}`, kind: "requirement", label: r.id, aliases: [`req:${r.id}`, `${r.spec}:${r.id}`], description: r.text, owner: `spec:${r.spec}`, source: `specs/${r.spec}`,
      tags: [`level:${(r.level || "none").toLowerCase()}`, `status:${r.status}`, ...(r.trace ? ["traced:yes"] : ["traced:no"])], lifecycle: { persistence: "versioned", retention: "git history" } });
    for (const i of I.collect()) out.push({ id: `task:${i.key.replace(/^(spec|change):/, "$1-").replace(/\//g, "-")}`, kind: "task", label: i.key, aliases: [i.key], description: i.text, owner: i.spec ? `spec:${i.spec}` : `change:${i.change}`,
      tags: [`who:${i.who}`, `state:${i.done ? "done" : i.blockedBy.length ? "blocked" : "open"}`, `source:${i.source}`],
      relationships: [...i.dependsOn.map((d) => ({ rel: "depends-on", target: `task:${d.replace(/^(spec|change):/, "$1-").replace(/\//g, "-")}`, direction: "out", cardinality: "0..*", acyclic: true })),
        ...i.reqs.map((r) => ({ rel: "serves", target: `req:${r}`, direction: "out", cardinality: "0..*" }))], lifecycle: { persistence: "versioned", retention: "git history" } });
    return out;
  } };

const learnings = { id: "learnings", about: "The learnings ledger: each problem with its cause, fix and guard.",
  describe() {
    let L = []; try { L = require("../responses/learnings.json").learnings; } catch { return []; }
    return L.map((l) => ({ id: `learning:${l.id}`, kind: "learning", label: l.id, description: l.symptom, owner: "responses", source: "modules/responses/learnings.json", tags: [`area:${l.area}`, `guard:${l.guard.split(":")[0]}`],
      properties: { found: { type: "date", required: true, description: `Found ${l.found}.` }, cause: { type: "string", required: true, description: l.cause }, fix: { type: "string", required: true, description: l.fix }, guard: { type: "string", required: true, description: l.guard } }, lifecycle: { persistence: "perpetual", retention: "kept as the record" }, series: { time: "found", cadence: "event" } }));
  } };

module.exports = { tables, types, operations, modules, plans, learnings, inferDescription, BUILTIN: [tables, types, operations, modules, plans, learnings] };
