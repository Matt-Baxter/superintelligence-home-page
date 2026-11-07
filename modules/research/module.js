// Research site: public, plain-language write-ups of reviewed papers and topic dossiers, and an RSS feed of them that
// a simpler news feed can add as one more source ("feeds the feed"). Hidden unless RESEARCH_PUBLIC=1 (admins can always
// look), tagged "Research preview", noindex, and not in the nav. Runs alone as SITE_PROFILE=research, or inside extended.
module.exports = {
  id: "research",
  version: "0.1.0",
  description: "Plain-language research write-ups and their RSS feed, built from the review desk and topic dossiers; hidden unless RESEARCH_PUBLIC=1.",
  requires: ["review"],
  setup(ctx) { ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps)); },
};
