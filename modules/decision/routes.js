// /api/judges: list the judges every module registered, and run one on an input (no data is stored; the result and
// its json-render spec come back so the humans can paste them into the contract change log and both PRs).
const verdictSpec = require("./spec");

module.exports = function mountDecision(app, { auth, admin, wrap, bad, notFound, views }, JUDGES) {
  app.get("/api/judges", auth, admin, wrap(() => ({
    judges: [...JUDGES.values()].map(({ id, name, description, method, inputs, module }) => ({ id, name, description, method, inputs: inputs || null, module })),
    sample: require("./sample.json"),
  })));
  app.post("/api/judges/:id/run", auth, admin, wrap(async (req) => {
    const j = JUDGES.get(req.params.id); if (!j) notFound("That judge");
    let result;
    try { result = j.judge(req.body || {}); } catch (e) { if (e.status === 400) bad(e.message); throw e; }
    const { check } = await views();
    return { result, spec: check(verdictSpec(result, req.body || {})) };
  }));
};
