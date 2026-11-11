// Type mappings both ways (schema/types.json <-> every generated format, and lib/ids.js format <-> parse), and
// property-based instances: generated values of every type pass the generated zod schema, survive a JSON round trip,
// and a broken copy (missing field, wrong scalar, unknown key, bad enum, malformed qid) is refused. Seeded.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const S = require("../lib/schema"), ids = require("../lib/ids");
const model = S.load(), GEN = path.join(__dirname, "..", "schema", "gen");
let seed = 1110, n = 0; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// 1. Forward: what each generated format must carry from types.json. Not every format carries everything, on purpose:
// Arrow stores enums as dictionary-encoded strings (the value set is lost there), the JSON-LD context names fields,
// and OpenRPC describes the service methods. Those are recorded losses, checked so a new one can't creep in silently.
const files = fs.readdirSync(GEN).filter((f) => !f.endsWith(".md")).map((f) => [f, fs.readFileSync(path.join(GEN, f), "utf8")]);
const CARRIES = { "zod.mjs": "types fields enums", "si.schema.json": "types fields enums", "models.py": "types fields enums", "si.proto": "types fields enums", "si_types.rs": "types fields enums", "arrow_schema.py": "types fields", "context.jsonld": "fields", "openrpc.json": "services" };
assert.deepEqual(files.map(([f]) => f).sort(), Object.keys(CARRIES).sort(), "a generated format was added or removed: say what it carries in CARRIES");
for (const [f, text] of files) {
  const c = CARRIES[f];
  if (c.includes("types")) for (const t of model.types) assert.ok(text.includes(t.name), `${f} lacks type ${t.name}`);
  if (c.includes("fields")) for (const t of model.types) for (const fd of t.fields) assert.ok(text.includes(`"${fd.name}"`) || new RegExp(`\\b${fd.name}\\b`).test(text), `${f} lacks ${t.name}.${fd.name}`);
  if (c.includes("enums")) for (const e of model.enums) for (const v of e.values) { const pascal = v.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(""); assert.ok(text.includes(v) || text.includes(v.toUpperCase().replace(/-/g, "_")) || new RegExp(`\\b${pascal}\\b`).test(text), `${f} lacks ${e.name} value ${v}`); }
  if (c.includes("services")) for (const [svc, d] of Object.entries(model.services || {})) for (const [m, io] of Object.entries(d.methods)) { assert.ok(text.includes(`${svc.toLowerCase()}.${m}`), `${f} lacks ${svc}.${m}`); assert.ok(text.includes(io.input) && text.includes(io.output), `${f}: ${m} lacks its types`); }
  n++;
}
// 2. Backward: nothing in the generated zod or JSON Schema that types.json doesn't declare.
const declared = new Set([...model.types.map((t) => t.name), ...model.enums.map((e) => e.name)]);
const zodText = files.find(([f]) => f === "zod.mjs")[1];
for (const m of zodText.matchAll(/export const ([A-Z]\w*) = /g)) assert.ok(declared.has(m[1]), `zod.mjs exports ${m[1]}, which types.json doesn't declare`);
const registry = (zodText.match(/export const types = \{([^}]*)\}/) || [])[1] || "";
assert.deepEqual(registry.split(",").map((x) => x.trim()).filter(Boolean).sort(), [...declared].sort(), "zod.mjs's types registry differs from types.json");
const js = JSON.parse(files.find(([f]) => f === "si.schema.json")[1]), defs = js.$defs || js.definitions || {};
for (const k of Object.keys(defs)) assert.ok(declared.has(k), `si.schema.json defines ${k}, which types.json doesn't declare`);
for (const t of model.types) { const d = defs[t.name]; if (d?.properties) assert.deepEqual(Object.keys(d.properties).sort(), t.fields.map((f) => f.name).sort(), `${t.name}: JSON Schema properties differ from types.json`); }
n++;

// 3. Qualified ids both ways: qid(ns, id) is parsed back to the same parts, and matches the schema's pattern.
const QRE = new RegExp(ids.QID_PATTERN);
const kebab = () => Array.from({ length: int(1, 3) }, () => Array.from({ length: int(1, 6) }, () => pick("abcdefghijklmnopqrstuvwxyz0123456789")).join("")).join("-");
const idFor = (ns) => (ns === "req" ? `REQ-${String(int(0, 999)).padStart(3, "0")}` : ns === "source" || ns === "story" ? String(int(1, 99999)) : ns === "outlet" ? pick([`${kebab()}.org`, `news.${kebab()}.com`, "[2001:db8::1]"]) : kebab());
for (let i = 0; i < 500; i++) {
  const ns = pick(Object.keys(ids.NAMESPACES)), id = idFor(ns), q = ids.qid(ns, id), back = ids.parse(q);
  assert.deepEqual(back, { ns, id, qid: q }, `qid round trip: ${q}`); assert.ok(QRE.test(q), `schema pattern refuses ${q}`);
}
for (const bad of ["topic:Alignment", "topic:", "req:REQ-1", "story:x", "nope:abc", "topic:a--b", " topic:a"]) assert.ok(!ids.parse(bad) || bad.trim() !== bad, `parsed malformed ${bad}`);
n++;

// 4. Instances: generated values of every type pass zod, round-trip through JSON, and broken copies fail.
const typeBy = Object.fromEntries(model.types.map((t) => [t.name, t])), enumBy = Object.fromEntries(model.enums.map((e) => [e.name, e]));
function scalar(base) {
  switch (base) {
    case "string": return pick(["", "Sample (test data)", "ünïcödé ∇θ", "a".repeat(int(1, 40))]);
    case "int": return int(-5, 5000);
    case "float": return pick([0, -1.5, 3.25, rnd() * 100]);
    case "bool": return rnd() < 0.5;
    case "datetime": return new Date(Date.UTC(2026, int(0, 11), int(1, 28), int(0, 23))).toISOString();
    case "json": return pick([{}, { a: 1 }, [1, "x"], "text", 3, null]);
  }
  throw new Error(`no generator for ${base}`);
}
function qidValue() { const ns = pick(["topic", "org", "concept", "req", "story"]); return ids.qid(ns, idFor(ns)); }
function value(f, depth) {
  const one = () => (f.pattern ? qidValue() : enumBy[f.base] ? pick(enumBy[f.base].values) : typeBy[f.base] ? instance(typeBy[f.base], depth + 1) : scalar(f.base));
  return f.list ? Array.from({ length: depth > 2 ? 0 : int(0, 3) }, one) : one();
}
function instance(t, depth = 0) {
  const o = {};
  for (const f of t.fields) { if (f.optional && rnd() < 0.35) { if (rnd() < 0.5) o[f.name] = null; continue; } o[f.name] = value(f, depth); }
  return o;
}
(async () => {
  const Z = await import(path.join(GEN, "zod.mjs"));
  let cases = 0;
  for (const t of model.types) {
    const schema = Z[t.name]; assert.ok(schema, `zod has no ${t.name}`);
    for (let i = 0; i < 60; i++) {
      const v = instance(t), r = schema.safeParse(v);
      assert.ok(r.success, `${t.name} refused a generated instance: ${JSON.stringify(v).slice(0, 200)} ${r.error?.issues?.[0]?.message} at ${r.error?.issues?.[0]?.path}`);
      assert.deepEqual(schema.parse(JSON.parse(JSON.stringify(v))), schema.parse(v), `${t.name}: JSON round trip changed the value`);
      // Broken copies.
      const req = t.fields.filter((f) => !f.optional);
      if (req.length) { const f = pick(req), b = { ...v }; delete b[f.name]; assert.ok(!schema.safeParse(b).success, `${t.name} accepted a missing ${f.name}`); }
      const sc = t.fields.filter((f) => !f.optional && !f.list && f.scalar && f.base !== "json");
      if (sc.length) { const f = pick(sc), b = { ...v, [f.name]: f.base === "string" || f.base === "datetime" ? 12345 : "not-a-number" }; assert.ok(!schema.safeParse(b).success, `${t.name} accepted a wrong ${f.base} in ${f.name}`); }
      assert.ok(!schema.safeParse({ ...v, not_in_types_json: 1 }).success, `${t.name} accepted an unknown key`);
      const en = t.fields.filter((f) => enumBy[f.base] && !f.list && !f.optional);
      if (en.length) { const f = pick(en); assert.ok(!schema.safeParse({ ...v, [f.name]: "not-a-value" }).success, `${t.name} accepted a bad ${f.base}`); }
      const pf = t.fields.find((f) => f.pattern);
      if (pf) assert.ok(!schema.safeParse({ ...v, [pf.name]: "Topic:Bad Id" }).success, `${t.name} accepted a malformed ${pf.name}`);
      cases++;
    }
  }
  n++;
  console.log(`Schema properties: ${n} passed, 0 failed; ${files.length} generated formats mapped both ways, 500 qids round-tripped, ${cases} generated instances with broken copies.`);
})().catch((e) => { console.error(e); process.exit(1); });
