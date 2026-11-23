// Decision: pluggable judges for bake-offs and other choices. Owns the "decision.judges" extension point, so any
// module can add a judge. Ships three: weighted-criteria (transparent, computed here) and JEV and CLEF, which are
// external decision models: their scores and recommendation come from running them, and this module records them
// and checks them against the transparent weighted totals. It doesn't define how JEV or CLEF work.
// The judge registry is created fresh each time a kernel registers this module (no state shared between kernels).
let JUDGES = new Map();

module.exports = {
  id: "decision",
  version: "1.0.0",
  description: "Pluggable judges (decision.judges) for bake-offs: weighted-criteria, JEV and CLEF; Scorecard and Verdict blocks; the Decide page and API.",
  requires: ["generative-ui"],
  register(env) {
    JUDGES = module.exports.judges = new Map();
    env.registerExtensionPoint("decision.judges", (mod) => ({
      weighted: require("./score").weighted, // shared arithmetic for judges in other modules
      add(judge) {
        for (const k of ["id", "name", "description", "method", "judge"]) if (!judge[k]) throw new Error(`Judge from module "${mod}" needs ${k}`);
        if (!["builtin", "external"].includes(judge.method)) throw new Error(`Judge "${judge.id}": method must be "builtin" or "external"`);
        if (JUDGES.has(judge.id)) throw new Error(`Judge "${judge.id}" registered twice`);
        JUDGES.set(judge.id, { ...judge, module: mod });
      },
    }));
  },
  setup(ctx) {
    const judges = ctx.point("decision.judges");
    for (const id of ["weighted-criteria", "jev", "clef"]) judges.add(require(`./judges/${id}`));
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps, JUDGES));
    ctx.point("ui.nav").add({ href: "/m/decide", label: "Decide", admin: true, order: 82 });
    ctx.point("ui.views").add("bakeoff-sample", {
      title: "Bake-off verdict (sample)",
      description: "What a judged bake-off looks like, on synthetic test data.",
      admin: true,
      build: () => require("./spec")(JUDGES.get("weighted-criteria").judge(require("./sample.json")), require("./sample.json")),
    });
  },
  judges: JUDGES,
};
