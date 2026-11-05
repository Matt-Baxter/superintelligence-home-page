# Module template

`modules/<id>/module.js`:
```js
// <One line: what this feature does for the reader.>
module.exports = {
  id: "<id>",                     // lowercase-kebab, same as the folder
  version: "0.1.0",
  description: "<what it adds: pages, routes, blocks, judges…>",
  requires: [],                   // module ids this one needs (e.g. ["generative-ui"])
  // register(env) { env.registerExtensionPoint("<id>.things", (mod) => ({ add(thing) { … } })); },
  setup(ctx) {
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/<page>", label: "<Label>", admin: false, order: 50 });
    // ctx.point("ui.views").add("<view>", { title: "…", build: (deps, req) => require("./view")(deps, req) });
    // ctx.point("db.schema").addSql(`CREATE TABLE IF NOT EXISTS <id>_items (id \${ID}, created_at TEXT DEFAULT \${T});`);
  },
};
```

`modules/<id>/routes.js`:
```js
module.exports = function mount(app, { db, auth, wrap, str, bad }) {
  app.get("/api/<id>/items", auth, wrap(async () => ({ items: await db.all("SELECT * FROM <id>_items ORDER BY id DESC LIMIT 50") })));
};
```

Layout: `module.js`, `README.md`, `routes.js`, `pages/*.html`, `blocks/<Name>/{block.mjs,render.jsx}`, `view.js`, plus anything private to the module.
