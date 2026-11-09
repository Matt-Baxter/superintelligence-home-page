// Verification: scores how far a story's formal-proof claim has been checked (claimed, statement checked against a
// reference, checked outside the authors) and flags fidelity gaps. One analysis signal; no routes, pages or tables.
module.exports = {
  id: "verification",
  version: "0.1.0",
  description: "Machine-checked claims: a significance signal for formal proofs (claimed, statement checked, checked outside the authors) that flags when a formal statement is weaker than the claim.",
  requires: [],
  setup(ctx) {
    ctx.point("analysis.signals").add(require("./verification").signal);
  },
};
