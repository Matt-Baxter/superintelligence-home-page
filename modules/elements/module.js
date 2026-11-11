// Elements (REQ-072..REQ-075, proposed, spec 010; openspec/changes/add-element-descriptors; extended version only).
// One descriptor for every element of the system (tables, types, operations, modules, requirements, tasks, learnings,
// and any other repo's records through a provider), built by the portable package packages/si-elements:
// properties, keys and surrogates, grain, relationships with direction and cardinality, constraints, lifecycle,
// series, aliases, tags, SHACL shapes and quads.
//   extension point  elements.providers  add({ id, about, describe(ctx) -> descriptors, rows?(id, ctx) -> rows })
// The catalog = every provider's descriptors, merged with overlay.json, relationship targets resolved by alias.
const fs = require("node:fs"), path = require("node:path");
const E = require("../../packages/si-elements"), B = require("./providers"), V = require("./vibe");
const OVERLAY = path.join(__dirname, "overlay.json");
const providers = new Map();

function overlay() { try { return JSON.parse(fs.readFileSync(OVERLAY, "utf8")).elements || {}; } catch { return {}; } }

let memo = null;
async function catalog(ctx = {}, { fresh = false } = {}) {
  if (memo && !fresh && Date.now() - memo.at < 30e3) return memo.c;
  const all = [], errors = [];
  for (const p of [...B.BUILTIN, ...(process.env.VIBE_REPO ? [V.provider()] : []), ...providers.values()]) {
    try { for (const d of (await p.describe(ctx)) || []) all.push({ ...d, provider: p.id }); } catch (e) { errors.push(`${p.id}: ${e.message}`); }
  }
  const ov = overlay(), seen = new Set(), descs = [];
  for (const d of all) { if (seen.has(d.id)) { errors.push(`${d.id} is described twice (${d.provider})`); continue; } seen.add(d.id); descs.push(E.merge(d, ov[d.id])); }
  const unknownOverlay = Object.keys(ov).filter((id) => !seen.has(id));
  const aliases = E.aliasIndex(descs);
  for (const d of descs) for (const r of d.relationships || []) { const t = seen.has(r.target) ? r.target : aliases.resolve(r.target); if (t && t !== r.target) { r.declaredTarget = r.target; r.target = t; } }
  const invalid = descs.flatMap(E.validate);
  const c = { descs, byId: new Map(descs.map((d) => [d.id, d])), aliases, errors, invalid, unknownOverlay, providers: [...B.BUILTIN, ...providers.values()].map((p) => ({ id: p.id, about: p.about })) };
  memo = { at: Date.now(), c }; return c;
}
const providerFor = (id, c) => { const d = c.byId.get(id); return d && [...B.BUILTIN, ...(process.env.VIBE_REPO ? [V.provider()] : []), ...providers.values()].find((p) => p.id === d.provider); };
const summary = (d) => ({ id: d.id, kind: d.kind, label: d.label, description: d.description, owner: d.owner, tags: d.tags, aliases: d.aliases, grain: d.grain && d.grain.statement, lifecycle: d.lifecycle && d.lifecycle.persistence, completeness: E.completeness(d) });

// Check an element's rows: keys, grain, required, enums, vocabularies, references, acyclic rows; and SHACL on the quads.
async function checkData(id, ctx, { shacl = true } = {}) {
  const c = await catalog(ctx), d = c.byId.get(id); if (!d) return null;
  const p = providerFor(id, c), rows = p && p.rows ? await p.rows(id, ctx) : null;
  if (!rows) return { id, rows: 0, note: "no rows available for this element here" };
  // References resolve against the target's rows when its provider can read them.
  const cache = new Map(), lookup = (target, v) => { if (!cache.has(target)) cache.set(target, null); const t = cache.get(target); return t ? t.has(String(v)) : true; };
  for (const r of d.relationships || []) if (r.via && c.byId.has(r.target) && !cache.has(r.target)) {
    const tp = providerFor(r.target, c), td = c.byId.get(r.target), trows = tp && tp.rows ? await tp.rows(r.target, ctx) : null, key = r.key || (td.keys && (td.keys.surrogate || (td.keys.primary || [])[0]));
    cache.set(r.target, trows && key ? new Set(trows.map((x) => String(x[key]))) : null);
  }
  const problems = E.checkRows(d, rows, { lookup });
  let shaclResult = null;
  if (shacl) {
    const S = require("../graph/shacl"), targets = Object.fromEntries((d.relationships || []).filter((r) => r.via).map((r) => [r.target, true]));
    const quads = rows.flatMap((row) => E.rowToQuads(d, row, { targets: {} }).quads.map((q) => q.replace(/ <urn:si:data:[^>]+> \.$/, " .")));
    const shapes = S.loadShapes(E.toShacl([{ ...d, relationships: (d.relationships || []).map((r) => ({ ...r, targetClass: false })) }]));
    const v = S.validate(shapes, quads.join("\n")); shaclResult = { conforms: v.conforms, violations: v.results.length, sample: v.results.slice(0, 10), triples: quads.length };
    void targets;
  }
  return { id, rows: rows.length, problems: problems.slice(0, 200), problemCount: problems.length, byRule: problems.reduce((m, x) => ((m[x.rule] = (m[x.rule] || 0) + 1), m), {}), shacl: shaclResult };
}

module.exports = {
  id: "elements",
  version: "0.1.0",
  description: "One descriptor for every element (tables, types, operations, modules, requirements, tasks, learnings, other repos' records): keys, grain, relationships, constraints, lifecycle, series, aliases, tags, SHACL and quads.",
  requires: ["data", "graph", "work"],
  register({ registerExtensionPoint }) {
    providers.clear(); memo = null;
    registerExtensionPoint("elements.providers", (mod) => ({ add: (p) => { if (!p || !p.id || typeof p.describe !== "function") throw new Error(`${mod}: a provider needs an id and describe()`); providers.set(p.id, { ...p, module: mod }); memo = null; } }));
  },
  setup(ctx) {
    ctx.point("ui.nav").add({ href: "/m/elements", label: "Elements", admin: true, order: 91 });
    const S = ctx.point("data.sources"), Ac = ctx.point("data.actions");
    const cx = (c) => ({ db: c.db, kernel: c.deps && c.deps.kernel });
    S.add("elements.list", { about: "Every element with its kind, owner, tags, grain, lifecycle and completeness: { kind?, tag?, q? }.",
      params: { kind: { type: "string", enum: E.KINDS }, tag: { type: "string", max: 80 }, q: { type: "string", max: 80 } }, access: "admin",
      run: async (p, c) => { const k = await catalog(cx(c)), q = (p.q || "").toLowerCase(); const id = q ? k.aliases.resolve(q) : null;
        return k.descs.filter((d) => (!p.kind || d.kind === p.kind) && (!p.tag || (d.tags || []).includes(p.tag)) && (!q || d.id === id || d.id.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q))).map(summary); } });
    S.add("elements.get", { about: "One element's full descriptor (resolved by id or any alias), with its completeness and validation.", params: { id: { type: "string", required: true, max: 160 } }, access: "admin",
      run: async (p, c) => { const k = await catalog(cx(c)), id = k.byId.has(p.id) ? p.id : k.aliases.resolve(p.id); const d = id && k.byId.get(id); if (!d) c.notFound("That element"); return { ...d, completeness: E.completeness(d), problems: E.validate(d) }; } });
    S.add("elements.report", { about: "The catalog's health: counts by kind, completeness, alias conflicts, invalid descriptors, the relationship DAG, overlay ids that match nothing.", params: {}, access: "admin",
      run: async (p, c) => { const k = await catalog(cx(c)), byKind = {}, comp = k.descs.map((d) => ({ id: d.id, ...E.completeness(d) }));
        for (const d of k.descs) byKind[d.kind] = (byKind[d.kind] || 0) + 1;
        const g = E.dag(k.descs);
        return { elements: k.descs.length, byKind, providers: k.providers, completeness: { mean: +(comp.reduce((s, x) => s + x.score, 0) / (comp.length || 1)).toFixed(3), complete: comp.filter((x) => x.score === 1).length, lowest: comp.sort((a, b) => a.score - b.score).slice(0, 15) },
          aliasConflicts: k.aliases.conflicts, invalid: k.invalid, errors: k.errors, unknownOverlay: k.unknownOverlay, dag: { isDag: g.isDag, edges: g.edges.length, violations: g.violations, dangling: g.dangling.length, loadOrder: g.order.filter((x) => x.startsWith("table:")).reverse() } }; } }); // referenced tables first
    S.add("elements.shapes", { about: "SHACL shapes (Turtle) for every element, or one: { id? }.", params: { id: { type: "string", max: 160 } }, access: "admin",
      run: async (p, c) => { const k = await catalog(cx(c)); return { turtle: E.toShacl(p.id ? k.descs.filter((d) => d.id === p.id) : k.descs) }; } });
    S.add("elements.check", { about: "Check an element's rows here: required values, keys and grain unique, enums, vocabularies, references, acyclic rows, and SHACL on its quads.", params: { id: { type: "string", required: true, max: 160 } }, access: "admin",
      run: async (p, c) => (await checkData(p.id, cx(c))) || c.notFound("That element") });
    Ac.add("elements.export", { about: "Write the catalog into the knowledge graph (named graph urn:si:elements), replacing the previous export.", input: {}, access: "admin", refresh: ["elements.report"],
      run: async (i, c) => { const k = await catalog(cx(c), { fresh: true }); return c.kg.replaceGraph("urn:si:elements", E.toQuads(k.descs, { graph: null })); } });
  },
  lib: { catalog, checkData, providers, reset: () => { memo = null; } },
};
