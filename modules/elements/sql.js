// Table descriptors from the schema SQL itself (REQ-072, proposed): every CREATE TABLE in lib/db.js and the modules
// (wherever a module keeps its SQL), plus CREATE [UNIQUE] INDEX and the columns added later (ADDED_COLUMNS). Columns
// become properties; PRIMARY KEY, UNIQUE and unique indexes become keys; REFERENCES become relationships with their
// direction, cardinality and ON DELETE; an INTEGER PRIMARY KEY id is the surrogate. Grain, series and lifecycle are
// inferred where the SQL says enough, and the overlay (overlay.json) fills in the rest.
const fs = require("node:fs"), path = require("node:path");
const ROOT = path.join(__dirname, "..", "..");

function walk(dir, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { if (e.name === "node_modules" || e.name.startsWith(".") || (e.name === "data" && path.basename(dir) !== "modules")) continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.js$/.test(e.name)) out.push(p); }
  return out;
}
// The statement body between the parenthesis after the table name and its matching close.
function body(text, from) {
  let depth = 0, i = text.indexOf("(", from); const start = i + 1;
  for (; i < text.length; i++) { if (text[i] === "(") depth++; else if (text[i] === ")" && --depth === 0) return text.slice(start, i); }
  return null;
}
const splitTop = (s) => { const out = []; let depth = 0, cur = ""; for (const ch of s) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
const TYPE = (t, col) => /^\$\{?\\?\$?\{?ID\}?/.test(t) || /\bSERIAL\b/i.test(t) ? "integer" : /INT/i.test(t) ? (/^(is_|has_)|^(private|public|soft|forced|disabled|admin)$/.test(col) ? "boolean" : "integer") : /REAL|FLOAT|DOUBLE|NUMERIC/i.test(t) ? "decimal" : /^TEXT/i.test(t) && /(^|_)at$|^(first_seen|started_at|finished_at|published_at|last_fetched|last_ok)$/.test(col) ? "dateTime" : "string";

function parse(text, file) {
  const tables = [], indexes = [];
  const src = text.replace(/\\\$\{/g, "${");
  for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\(/g)) {
    const b = body(src, m.index + m[0].length - 1); if (!b) continue;
    const t = { name: m[1], file, columns: [], primary: null, unique: [], fks: [], checks: [] };
    for (const part of splitTop(b.replace(/--[^\n]*/g, ""))) {
      const tp = part.match(/^PRIMARY KEY\s*\(([^)]+)\)/i), tu = part.match(/^UNIQUE\s*\(([^)]+)\)/i), tc = part.match(/^CHECK\s*\((.*)\)$/is);
      if (tp) { t.primary = tp[1].split(",").map((s) => s.trim()); continue; }
      if (tu) { t.unique.push(tu[1].split(",").map((s) => s.trim())); continue; }
      if (tc) { t.checks.push(tc[1].trim()); continue; }
      const c = part.match(/^(\w+)\s+(.*)$/s); if (!c || /^(FOREIGN|CONSTRAINT)$/i.test(c[1])) continue;
      const [_, name, rest] = c, rawType = rest.split(/\s+/)[0];
      const col = { name, type: TYPE(rawType, name), required: /\bNOT NULL\b/i.test(rest) || /\bPRIMARY KEY\b/i.test(rest), surrogate: /\$\{ID\}/.test(rawType) || (/^INTEGER PRIMARY KEY/i.test(rest) && name === "id") };
      const d = rest.match(/\bDEFAULT\s+('(?:[^']*)'|\$\{T\}|-?\d+(?:\.\d+)?|\([^)]*\))/i); if (d) col.default = /\$\{T\}/.test(d[1]) ? "now" : d[1].replace(/^'|'$/g, "");
      if (/\bPRIMARY KEY\b/i.test(rest) || col.surrogate) t.primary = [name];
      if (/\bUNIQUE\b/i.test(rest)) t.unique.push([name]);
      const fk = rest.match(/REFERENCES\s+(\w+)\s*\((\w+)\)(?:\s+ON DELETE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION))?/i);
      if (fk) t.fks.push({ column: name, table: fk[1], key: fk[2], onDelete: (fk[3] || "no action").toLowerCase(), required: col.required });
      const ck = rest.match(/CHECK\s*\((.*)\)/i); if (ck) t.checks.push(ck[1]);
      t.columns.push(col);
    }
    if (t.primary) for (const c of t.columns) if (t.primary.includes(c.name)) c.required = true;
    for (const f of t.fks) f.required = !!(t.columns.find((c) => c.name === f.column) || {}).required;
    tables.push(t);
  }
  for (const m of src.matchAll(/CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+) ON (\w+)\s*\(([^;]*?)\);?\s*$/gm)) indexes.push({ name: m[2], table: m[3], unique: !!m[1], columns: splitTop(m[4]).map((s) => s.trim()) });
  for (const m of src.matchAll(/CREATE (UNIQUE )?INDEX IF NOT EXISTS (\w+) ON (\w+)\s*\((.+?)\)\s*(?:;|`|\n|WHERE)/g)) if (!indexes.some((x) => x.name === m[2])) indexes.push({ name: m[2], table: m[3], unique: !!m[1], columns: splitTop(m[4]).map((s) => s.trim()) });
  const added = [...src.matchAll(/\["(\w+)",\s*"(\w+)",\s*"([^"]+)"\]/g)].map((m) => ({ table: m[1], column: m[2], def: m[3] }));
  return { tables, indexes, added };
}

function collect(root = ROOT) {
  const files = [path.join(root, "lib", "db.js"), ...walk(path.join(root, "modules"))];
  const all = { tables: [], indexes: [], added: [] };
  for (const f of files) {
    let t = ""; try { t = fs.readFileSync(f, "utf8"); } catch { continue; }
    if (!/CREATE TABLE IF NOT EXISTS|ADDED_COLUMNS/.test(t) || /modules[\\/](codemap[\\/]scan|work[\\/]advisor|elements[\\/])/.test(f)) continue; // scanners mention SQL in regexes
    const r = parse(t, path.relative(root, f));
    all.tables.push(...r.tables); all.indexes.push(...r.indexes); if (/lib[\\/]db\.js$/.test(f)) all.added.push(...r.added);
  }
  // Later columns (migrations) join their table.
  for (const a of all.added) { const t = all.tables.find((x) => x.name === a.table); if (t && !t.columns.some((c) => c.name === a.column)) t.columns.push({ name: a.column, type: TYPE(a.def.split(/\s+/)[0], a.column), required: /NOT NULL/i.test(a.def), added: true }); }
  const seen = new Set(); all.tables = all.tables.filter((t) => (seen.has(t.name) ? false : seen.add(t.name)));
  return all;
}

const words = (s) => s.replace(/_id$/, "").replace(/_/g, " ");
function describe({ tables, indexes }) {
  return tables.map((t) => {
    const props = {}, idx = indexes.filter((i) => i.table === t.name);
    for (const c of t.columns) props[c.name] = { type: c.type, ...(c.required ? { required: true } : {}), ...(c.default !== undefined ? { default: c.default } : {}) };
    const surrogate = (t.columns.find((c) => c.surrogate) || {}).name || null;
    const unique = [...t.unique, ...idx.filter((i) => i.unique).map((i) => i.columns.map((c) => c.replace(/^LOWER\((\w+)\)$/i, "$1")))];
    for (const u of unique) if (u.length === 1 && props[u[0]]) props[u[0]].unique = true;
    const natural = surrogate ? unique : (t.primary ? [] : unique);
    const relationships = t.fks.map((f) => ({ rel: f.column.replace(/_id$/, "").replace(/_/g, "-"), target: `table:${f.table}`, direction: "out", via: f.column,
      cardinality: f.required ? "1" : "0..1", inverse: `has-${t.name.replace(/_/g, "-")}`, onDelete: f.onDelete }));
    const timeCols = t.columns.filter((c) => c.type === "dateTime").map((c) => c.name);
    const seriesTime = ["at", "created_at", "first_seen", "started_at", "seen_at", "added_at", "published_at"].find((c) => timeCols.includes(c)) || null;
    const indexedTime = idx.some((i) => i.columns.includes(seriesTime));
    // Grain from the keys: a composite primary key is the grain; a surrogate with a natural key is one row per natural key.
    const pk = t.primary && !surrogate ? t.primary : null;
    const grain = pk ? { statement: `one row per ${pk.map(words).join(" per ")}`, keys: pk, inferred: true } : surrogate && natural.length ? { statement: `one row per ${natural[0].map(words).join(" and ")}`, keys: natural[0], inferred: true } : null;
    const lifecycle = t.columns.some((c) => c.name === "expires_at") ? { persistence: "leased" } : /_versions$|_snapshots$/.test(t.name) ? { persistence: "versioned" } : /audit|runs$|_saves$|_log/.test(t.name) ? { persistence: "append-only" } : { persistence: "perpetual" };
    const constraints = t.checks.map((c, i) => ({ id: `check-${i + 1}`, kind: "check", value: c }));
    for (const f of t.fks) constraints.push({ id: `fk-${f.column}`, kind: "reference", on: f.column, value: `table:${f.table}.${f.key}`, message: `on delete ${f.onDelete}` });
    return { id: `table:${t.name}`, kind: "table", label: t.name, source: t.file, owner: /^modules\//.test(t.file) ? t.file.split("/")[1] : "core",
      tags: [`layer:${/^modules\//.test(t.file) ? "module" : "core"}`, `storage:sql`], properties: props,
      keys: { surrogate, primary: t.primary || null, natural, unique }, grain, relationships, constraints, lifecycle,
      series: seriesTime ? { time: seriesTime, cadence: "event", order: "desc", indexed: indexedTime } : null,
      indexes: idx.map((i) => ({ name: i.name, columns: i.columns, unique: i.unique })), graph: { namedGraph: `urn:si:data:table:${t.name}` } };
  });
}

module.exports = { parse, collect, describe };
