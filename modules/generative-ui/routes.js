// /api/ui/*: catalog (with the LLM prompt), validate, and the view registry.
const { OPERATORS } = require("../../views/operators");
const bindings = require("../data/bindings"), reg = require("../data/registry");
// How a spec binds data and calls operators (json-render's dynamic values), added to the LLM prompt.
const BINDING_HELP = [
  'Data binding: a spec may carry "state". Bind props with {"$state": "/path"}, {"$template": "text ${/path}"} or {"$cond": {"$state": "/path", "eq": value}, "$then": a, "$else": b}.',
  'Repeat an element over an array with "repeat": {"statePath": "/items"} and read fields of each item with {"$item": "field"}. Show or hide with "visible": {"$state": "/tab", "eq": "x"}. Switch tabs with the built-in action setState {statePath, value}.',
  'Live data: a spec may carry "bindings": {"/path": {"source": "module.name", "params": {...}}}. The server runs each source as the viewer and puts the result in state at that path (a source the viewer can\'t read leaves it null, with the reason under /_errors). Buttons run writes with the action runAction {id, input} and reload data with refresh {}. The sources and data actions a viewer may use are listed in the catalog.',
  'Operators, called as {"$computed": name, "args": {...}}:',
  ...Object.entries(OPERATORS).map(([k, v]) => `- ${k}: ${v.about}`),
].join("\n");
module.exports = function mountGenerativeUi(app, deps) {
  const { auth, wrap, bad, notFound, views, kernel } = deps;
  const catalogInfo = async () => {
    const { catalog } = await views(), { blocks } = await import("../../views/catalog.mjs");
    return { catalog, blocks };
  };

  // Everything an LLM (or a person) needs to generate a valid spec: the blocks, the actions, the JSON schema and a ready prompt.
  app.get("/api/ui/catalog", auth, wrap(async (req) => {
    const { catalog, blocks } = await catalogInfo();
    return {
      blocks: blocks.map(({ def, module }) => ({ name: def.name, description: def.description, module })),
      actions: Object.keys((await import("../../views/actions.mjs")).actions),
      prompt: `${catalog.prompt()}\n\n${BINDING_HELP}`,
      operators: Object.entries(OPERATORS).map(([name, v]) => ({ name, about: v.about })),
      sources: [...reg.sources.values()].filter((d) => reg.allowed(d, req.user)).map(reg.describe),
      dataActions: [...reg.actions.values()].filter((d) => reg.allowed(d, req.user)).map(reg.describe),
      jsonSchema: catalog.jsonSchema(),
    };
  }));

  // Validate a spec someone generated. Returns the issues instead of throwing, so the Studio can show them.
  app.post("/api/ui/validate", auth, wrap(async (req) => {
    const spec = req.body?.spec;
    if (!spec || typeof spec !== "object") bad("Send {spec: {root, elements}}.");
    const { catalog } = await catalogInfo();
    const r = catalog.validate(spec);
    const issues = r.success ? [] : (r.error?.issues || []).slice(0, 30).map((i) => ({ path: (i.path || []).join("."), message: i.message }));
    // Also catch children that point at elements that don't exist (the renderer would drop them silently).
    if (r.success) for (const [id, e] of Object.entries(spec.elements || {})) for (const c of e.children || []) if (!spec.elements[c]) issues.push({ path: `elements.${id}.children`, message: `"${c}" isn't an element` });
    if (r.success && !spec.elements?.[spec.root]) issues.push({ path: "root", message: `root "${spec.root}" isn't an element` });
    return { ok: !issues.length, issues, elements: Object.keys(spec.elements || {}).length };
  }));

  const visible = (v, user) => !v.admin || user.admin;
  app.get("/api/ui/views", auth, wrap((req) => ({ views: kernel.describe().views.filter((v) => visible(v, req.user)) })));
  app.get("/api/ui/views/:name", auth, wrap(async (req) => {
    const v = kernel.store.views.get(req.params.name);
    if (!v || !visible(v, req.user)) notFound("That view");
    const spec = v.spec || (await v.build(deps, req));
    const { check } = await views();
    return { view: { name: v.name, title: v.title, description: v.description, module: v.module }, spec: await resolveSpec(check(spec), req) };
  }));
  // Resolve a spec's bindings as this viewer (the Studio's preview and a view's refresh).
  const resolveSpec = (spec, req) => (app.locals.data ? bindings.resolve(spec, req, app.locals.data.runSource) : spec);
  app.post("/api/ui/resolve", auth, wrap(async (req) => {
    const spec = req.body?.spec; if (!spec || typeof spec !== "object") bad("Send {spec}.");
    const { catalog } = await catalogInfo(), r = catalog.validate(spec); if (!r.success) bad("That spec doesn't validate; check it first.");
    return { spec: await resolveSpec(spec, req) };
  }));
};
