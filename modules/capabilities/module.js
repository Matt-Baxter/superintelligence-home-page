// Capability tracker: where frontier capabilities are moving (areas, benchmarks, people, organizations, top signals).
module.exports = {
  id: "capabilities",
  version: "1.0.0",
  description: "Capability tracker page and API, plus a live json-render view of the week's capability snapshot.",
  setup(ctx) {
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/capabilities", label: "Capabilities", order: 15 });
    ctx.point("ui.views").add("capability-snapshot", {
      title: "Capability snapshot",
      description: "This week's capability areas, top benchmark results and strongest signals, as a generated view.",
      build: (deps, req) => require("./view")(deps, req),
    });
  },
};
