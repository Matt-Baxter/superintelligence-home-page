// Research site: public, plain-language write-ups of reviewed papers and topic dossiers, and an RSS feed of them that
// a simpler news feed can add as one more source ("feeds the feed"). Hidden unless RESEARCH_PUBLIC=1 (admins can always
// look), tagged "Research preview", noindex, and not in the nav. Runs alone as SITE_PROFILE=research, or inside extended.
module.exports = {
  id: "research",
  version: "0.1.0",
  description: "Plain-language research write-ups and their RSS feed, built from the review desk and topic dossiers; hidden unless RESEARCH_PUBLIC=1.",
  requires: ["review"],
  setup(ctx) {
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("meta.actions").add(require("./actions"));
    ctx.point("ui.nav").add({ href: "/m/control", label: "Research", admin: true, order: 79 });
    // The research version measures buzz from what it harvests, so it switches on the catalog's checked buzz feeds
    // (entries marked "(buzz)": Medium tags, Hacker News) once, if they aren't there yet. Only in SITE_PROFILE=research;
    // the extended and spec versions get no new sources. An admin can pause them like any other source.
    ctx.onStart(async ({ db }) => {
      if (require("../../lib/profile").current().name !== "research") return;
      const buzz = require("../../lib/source-catalog.json").sources.filter((x) => /\(buzz\)/.test(x.name));
      for (const x of buzz) if (!(await db.get("SELECT id FROM sources WHERE url = ?", x.url)))
        await db.run("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, ?, 'active')", x.name, x.kind, x.format, x.url, x.home || "");
    });
  },
};
