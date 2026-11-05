// Admin: sources and harvesting (test, find feed, catalog, OPML, harvest log), users, moderation, ontology, audit log, free-tier usage.
module.exports = {
  id: "admin",
  version: "1.0.0",
  description: "Admin layer: sources and harvesting, users, moderation, ontology, audit log and free-tier usage.",
  setup(ctx) {
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/admin", label: "Admin", admin: true, order: 90 });
  },
};
