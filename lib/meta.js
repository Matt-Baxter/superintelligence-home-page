// The app describing itself (REQ-030). One document a person or another agent can learn the whole web app from:
// every route the server really has (read from Express, so nothing can be left off), merged with the plain-words
// description a module gave it through the kernel's "meta.actions" point. Routes nobody has described yet are still
// listed, marked undescribed, so the gap shows instead of hiding. The control room builds a runnable form for each
// action from this same document, so what an agent reads and what a person clicks can't drift apart.
//
// A described action: { id, title, about, method, path, params: [{ name, in: "path"|"query"|"body", type, enum,
// required, about, example }], effect: "read"|"write", undo, req: ["REQ-030"], page }.

const norm = (m, p) => `${m.toUpperCase()} ${p}`;

// Every route mounted on the Express 4 app, in mount order.
function routesOf(app) {
  const out = [], seen = new Set();
  for (const layer of (app._router && app._router.stack) || []) {
    const r = layer.route;
    if (!r || typeof r.path !== "string") continue;
    for (const m of Object.keys(r.methods).filter((k) => r.methods[k] && k !== "_all")) {
      const key = norm(m, r.path);
      if (!seen.has(key)) { seen.add(key); out.push({ method: m.toUpperCase(), path: r.path }); }
    }
  }
  return out;
}

const area = (path) => {
  const p = path.replace(/^\/api\//, "").replace(/^admin\//, "").split("/")[0];
  return path.startsWith("/api/") ? p : path.split("/")[1] || "pages";
};
const pathParams = (path) => [...path.matchAll(/:([A-Za-z_]+)/g)].map((m) => ({ name: m[1], in: "path", type: "string", required: true }));

// Merge the live routes with the described actions. Descriptions for routes that don't exist are reported, not shown.
function catalog(app, described = []) {
  const byKey = new Map(described.map((a) => [norm(a.method || "GET", a.path), a]));
  const used = new Set();
  const actions = routesOf(app).map(({ method, path }) => {
    const key = norm(method, path), d = byKey.get(key);
    if (d) used.add(key);
    const declared = (d && d.params) || [];
    const params = [...pathParams(path).map((p) => ({ ...p, ...(declared.find((x) => x.name === p.name) || {}) })),
      ...declared.filter((x) => !pathParams(path).some((p) => p.name === x.name))];
    return {
      id: d ? d.id : key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      title: d ? d.title : null, about: d ? d.about : null, described: !!d,
      method, path, area: area(path), module: d ? d.module : null,
      admin: path.startsWith("/api/admin/") || !!(d && d.admin),
      effect: d && d.effect ? d.effect : (method === "GET" ? "read" : "write"),
      undo: d ? d.undo || null : null, params, req: d ? d.req || [] : [], page: d ? d.page || null : null,
    };
  });
  const stale = described.filter((a) => !used.has(norm(a.method || "GET", a.path))).map((a) => ({ id: a.id, method: a.method || "GET", path: a.path, module: a.module }));
  const api = actions.filter((a) => a.path.startsWith("/api/"));
  return {
    actions,
    coverage: { routes: api.length, described: api.filter((a) => a.described).length, writes: api.filter((a) => a.effect === "write").length },
    stale,
  };
}

// How to use the catalog, said once, for whoever reads the JSON.
const HOW = [
  "Each action is one HTTP route. Path parameters go in the path (:id), query parameters in the query string, body parameters as a JSON body.",
  "Send the session cookie from /api/login. Routes under /api/admin/ need an admin account.",
  "effect 'read' never changes anything. effect 'write' changes data; 'undo' says how to reverse it when that's possible.",
  "Actions with described: false exist but nobody has explained them yet. Read the route in the module named by 'area' before using one.",
  "Nothing here merges, deploys or publishes outside the app.",
];

module.exports = { routesOf, catalog, HOW };
