// Kernel of the modular monolith. Everything beyond the core (accounts, stories, lists) is a module
// in modules/<id>/ that plugs into named extension points. Ideas taken from Backstage (owners declare extension
// points; modules contribute; owners read the contributions when they start) and BlockSuite (one provider per
// feature, string keys, headless parts separate from view parts).
//
// Lifecycle, for all enabled modules:
//   1. register(env)  a module may declare extension points it owns: env.registerExtensionPoint(id, api)
//   2. setup(ctx)     every module contributes, in dependency order: ctx.point(id).add(...)
//   3. start(deps)    the kernel mounts routes and runs each module's optional start(deps) (needs app helpers)
// Rules: additive-only; modules talk to each other only through extension points (never require another
// module's files); a missing dependency or unknown extension point fails at boot with the module's name.
const fs = require("node:fs"), path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MODULES_DIR = path.join(ROOT, "modules");

function readEnabled(dir = MODULES_DIR) {
  const file = path.join(dir, "modules.json");
  const all = JSON.parse(fs.readFileSync(file, "utf8")).enabled || [];
  // The site profile (lib/profile.js) narrows the real module list; test module folders are left alone.
  const list = dir === MODULES_DIR ? require("../lib/profile").modulesFor(all) : all;
  const off = new Set(String(process.env.MODULES_DISABLED || "").split(",").map((s) => s.trim()).filter(Boolean));
  return list.filter((id) => !off.has(id));
}

function manifestOf(id, modulesDir = MODULES_DIR) {
  const dir = path.join(modulesDir, id), file = path.join(dir, "module.js");
  if (!fs.existsSync(file)) throw new Error(`Module "${id}" is enabled in modules/modules.json but modules/${id}/module.js doesn't exist`);
  const m = require(file);
  if (m.id !== id) throw new Error(`modules/${id}/module.js must export id "${id}" (found "${m.id}")`);
  for (const k of ["version", "description"]) if (!m[k]) throw new Error(`Module "${id}" needs a ${k}`);
  return { requires: [], ...m, dir };
}

// Dependency order (Kahn). Throws on missing or circular dependencies.
function order(mods) {
  const byId = new Map(mods.map((m) => [m.id, m])), out = [], state = new Map();
  const visit = (m, trail) => {
    if (state.get(m.id) === "done") return;
    if (state.get(m.id) === "visiting") throw new Error(`Circular module dependency: ${[...trail, m.id].join(" → ")}`);
    state.set(m.id, "visiting");
    for (const dep of m.requires) {
      if (!byId.has(dep)) throw new Error(`Module "${m.id}" requires "${dep}", which isn't enabled`);
      visit(byId.get(dep), [...trail, m.id]);
    }
    state.set(m.id, "done"); out.push(m);
  };
  for (const m of mods) visit(m, []);
  return out;
}

function createKernel({ enabled, modulesDir = MODULES_DIR, extraPoints = {} } = {}) {
  const points = new Map();      // id -> { owner, api, contributions: [{module, value}] }
  const modules = order((enabled || readEnabled(modulesDir)).map((id) => manifestOf(id, modulesDir)));

  // A point's api is wrapped so every contribution is recorded with the module that made it (for /api/modules).
  const declare = (owner, id, makeApi) => {
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Extension point id "${id}" must look like "area.name"`);
    if (points.has(id)) throw new Error(`Extension point "${id}" is declared twice (${points.get(id).owner} and ${owner})`);
    const rec = { owner, contributions: [] };
    rec.forModule = (mod) => { const api = makeApi(mod); return new Proxy(api, { get: (t, k) => typeof t[k] === "function" && String(k).startsWith("add") ? (...a) => { rec.contributions.push({ module: mod, method: String(k) }); return t[k](...a); } : t[k] }); };
    points.set(id, rec);
  };

  // Kernel-owned extension points. Each keeps its contributions in a list the kernel (or core code) reads.
  const store = { routes: [], nav: [], views: new Map(), schema: [], columns: [], prune: [], formats: [], signals: [], taggers: [], starts: [], actions: [] };
  declare("kernel", "http.routes", (mod) => ({ add: (mount) => store.routes.push({ module: mod, mount }) }));
  declare("kernel", "ui.nav", (mod) => ({ add: (item) => store.nav.push({ order: 50, ...item, module: mod }) }));
  declare("kernel", "ui.views", (mod) => ({ add: (name, view) => { if (store.views.has(name)) throw new Error(`View "${name}" registered twice`); store.views.set(name, { title: name, admin: false, ...view, name, module: mod }); } }));
  declare("kernel", "db.schema", (mod) => ({ addSql: (sql) => store.schema.push(sql), addColumns: (cols) => store.columns.push(...cols), addPrune: (fn) => store.prune.push(fn) }));
  declare("kernel", "feeds.formats", (mod) => ({ add: (id, format) => store.formats.push({ id, format, module: mod }) }));
  declare("kernel", "analysis.signals", (mod) => ({ add: (signal) => store.signals.push({ ...signal, module: mod }) }));
  // Tag adapters ({ id, about, namespace, tag(text) -> Tag[] }) added to lib/taggers' registry when the server starts.
  declare("kernel", "knowledge.taggers", (mod) => ({ add: (adapter) => store.taggers.push({ ...adapter, module: mod }) }));
  // Plain-words descriptions of a module's routes ({ id, title, about, method, path, params, effect, undo, req, page }),
  // merged with the live route table by lib/meta.js into the catalog at /api/admin/meta.
  declare("kernel", "meta.actions", (mod) => ({ add: (...acts) => store.actions.push(...acts.flat().map((a) => ({ ...a, module: mod }))) }));
  for (const [id, make] of Object.entries(extraPoints)) declare("kernel", id, make);

  // 1. register: modules declare the extension points they own.
  for (const m of modules) m.register?.({ registerExtensionPoint: (id, makeApi) => declare(m.id, id, typeof makeApi === "function" ? makeApi : () => makeApi) });

  // 2. setup: modules contribute, in dependency order.
  for (const m of modules) {
    const ctx = {
      module: m.id, dir: m.dir, root: ROOT,
      point: (id) => { const p = points.get(id); if (!p) throw new Error(`Module "${m.id}" uses unknown extension point "${id}"`); return p.forModule(m.id); },
      // For a point owned by a module that may be switched off in this profile: null instead of an error.
      optional: (id) => { const p = points.get(id); return p ? p.forModule(m.id) : null; },
      onStart: (fn) => store.starts.push({ module: m.id, fn }),
    };
    try { m.setup?.(ctx); } catch (e) { e.message = `Module "${m.id}" failed in setup: ${e.message}`; throw e; }
  }

  return {
    modules, points, store,
    // 3a. mount: routes, synchronously, before the app's static files and 404 handler.
    mount(app, deps) { for (const r of store.routes) { try { r.mount(app, deps); } catch (e) { e.message = `Module "${r.module}" failed to mount routes: ${e.message}`; throw e; } } },
    // 3b. start: async hooks (after the database is ready), e.g. seeding a module's data.
    async start(deps) { for (const s of store.starts) await s.fn(deps); },
    nav: (user) => store.nav.filter((n) => !n.admin || user?.admin).sort((a, b) => a.order - b.order).map(({ href, label, admin, order, group }) => ({ href, label, admin: !!admin, order, group: admin ? "admin" : group || "reading" })),
    actions: () => store.actions,
    describe: () => ({
      modules: modules.map((m) => ({ id: m.id, version: m.version, description: m.description, requires: m.requires,
        contributes: [...points.entries()].map(([id, p]) => ({ point: id, n: p.contributions.filter((c) => c.module === m.id).length })).filter((x) => x.n) })),
      points: [...points.entries()].map(([id, p]) => ({ id, owner: p.owner, contributions: p.contributions.length })),
      views: [...store.views.values()].map(({ name, title, description, admin, module }) => ({ name, title, description, admin, module })),
    }),
  };
}

module.exports = { createKernel, readEnabled, MODULES_DIR };
