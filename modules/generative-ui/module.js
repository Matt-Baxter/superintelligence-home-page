// Generative UI: any agent or person can produce a json-render spec (JSON) using only the enabled blocks and actions;
// the server validates it against the catalog and the browser renders it. Views are registered by modules
// ("ui.views": a builder over live data, or a static spec) and served at /m/view?name=<view>.
module.exports = {
  id: "generative-ui",
  version: "1.0.0",
  description: "json-render catalog for LLMs, spec validation, a view registry (ui.views), the Studio to generate and preview UI, and the view page.",
  requires: ["blocks-core"],
  setup(ctx) {
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/studio", label: "Studio", admin: true, order: 85 });
  },
};
