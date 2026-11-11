// /api/data/* (REQ-061, proposed): list and run sources and actions. Permission, input checks and the audit row are
// here, once, for every module's sources and actions.
//   GET  /api/data/sources                 sources this request may read (with their parameters)
//   GET  /api/data/sources/:id?params      run a source (query string), POST /api/data/sources/:id { params }
//   GET  /api/data/actions                 actions this request may run (with their input schemas)
//   POST /api/data/actions/:id { input }   run an action: validated, permission-checked, audited
const reg = require("./registry"), kgMod = require("./kg"), { artifacts } = require("./artifacts");
module.exports = function mountData(app, deps) {
  const { db, wrap, bad, forbid, notFound, audit, HttpError } = deps;
  // Errors from sources, actions, the graph or the artifact store carry a status; answer with it (not a 500).
  const asHttp = (e) => (HttpError && e && e.status && !(e instanceof HttpError) ? new HttpError(e.status, e.message) : e);
  const ctxFor = async (req) => ({ db, user: req.user || null, req, deps, kg: await kgMod.open(db), artifacts: artifacts(db), bad, notFound, forbid, audit });
  async function runSource(id, params, req) {
    const def = reg.sources.get(id); if (!def) notFound("That source");
    if (!reg.allowed(def, req.user)) { if (!req.user && def.access !== "public") throw asHttp(Object.assign(new Error("Sign in to read this."), { status: 401 })); forbid("You can't read that source."); }
    if (def.guard) await def.guard(req, deps);
    const c = reg.check(def.params, params || {}); if (!c.ok) bad(`${id}: ${c.errors.join("; ")}.`);
    try { return await def.run(c.value, await ctxFor(req)); } catch (e) { throw asHttp(e); }
  }
  async function runAction(id, input, req) {
    const def = reg.actions.get(id); if (!def) notFound("That action");
    if (!req.user) throw asHttp(Object.assign(new Error("Sign in first."), { status: 401 }));
    if (!reg.allowed(def, req.user)) forbid("You can't run that action.");
    if (def.guard) await def.guard(req, deps);
    const c = reg.check(def.params, input || {}); if (!c.ok) bad(`${id}: ${c.errors.join("; ")}.`);
    let result; try { result = await def.run(c.value, await ctxFor(req)); } catch (e) { throw asHttp(e); }
    await audit.log(req.user.id, "data.action", `action:${id}`, JSON.stringify(c.value).slice(0, 280));
    return { ok: true, action: id, result, refresh: def.refresh };
  }
  app.locals.data = { runSource, runAction }; // for other modules' routes (the Studio's bindings)
  app.get("/api/data/sources", wrap((req) => ({ sources: [...reg.sources.values()].filter((d) => reg.allowed(d, req.user)).map(reg.describe) })));
  app.get("/api/data/sources/:id", wrap(async (req) => ({ source: req.params.id, data: await runSource(req.params.id, req.query, req) })));
  app.post("/api/data/sources/:id", wrap(async (req) => ({ source: req.params.id, data: await runSource(req.params.id, (req.body || {}).params || {}, req) })));
  app.get("/api/data/actions", wrap((req) => ({ actions: [...reg.actions.values()].filter((d) => req.user && reg.allowed(d, req.user)).map(reg.describe) })));
  app.post("/api/data/actions/:id", wrap(async (req) => runAction(req.params.id, (req.body || {}).input || {}, req)));
};
