// Paper responses (REQ-056..059, proposed, spec 006; extended version only). Reads a paper in full, analyses its
// claims against its own body, plans a response, and drafts an animated explainer, an article and posts for a person
// to check and publish. Behind a feature flag in the CMS meta layer (off / staff / public); rendering runs off the
// web server (scripts/respond.js, or the Learn worker's "response" job).
module.exports = {
  id: "responses",
  version: "0.1.0",
  description: "Full-text paper reading and analysis, response plans, explainer videos, articles and posts, behind a feature flag.",
  requires: ["appearance", "editorial", "review", "lab"],
  api: ["/api/admin/features"], // the site's feature flags live here, beside the look (docs/NAMING.md)
  setup(ctx) {
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS responses_papers (id \${ID}, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, url TEXT DEFAULT '',
  package TEXT NOT NULL, created_at TEXT DEFAULT \${T}, updated_at TEXT DEFAULT \${T},
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL);`);
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/responses", label: "Paper responses", admin: true, order: 89 });
  },
};
