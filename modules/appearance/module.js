// Appearance: themes, feed layouts and design concepts (REQ-053, proposed). An admin sets the site default; readers can
// switch for themselves (kept in their own browser). Extended profile only; the spec version has none of it.
module.exports = {
  id: "appearance",
  version: "0.1.0",
  description: "Site default and per-reader choice of theme, feed layout, headline face and text size, bundled as named concepts.",
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS appearance_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT \${T},
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL);`);
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/appearance", label: "Appearance", admin: true, order: 87 });
  },
};
