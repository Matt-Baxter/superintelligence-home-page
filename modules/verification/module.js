// Verification: scores how far a story's formal-proof claim has been checked (claimed, statement checked against a
// reference, checked outside the authors) and flags fidelity gaps. An analysis signal and a tag adapter; no routes, pages or tables.
module.exports = {
  id: "verification",
  version: "0.1.0",
  description: "Machine-checked claims: a significance signal for formal proofs (claimed, statement checked, checked outside the authors) that flags when a formal statement is weaker than the claim.",
  requires: [],
  setup(ctx) {
    const V = require("./verification");
    ctx.point("analysis.signals").add(V.signal);
    // The same rules tag text for the Review desk and the knowledge graph, so the topic and the score can't disagree there.
    ctx.point("knowledge.taggers").add({
      id: "machine-checked", namespace: "topic", about: "Formal-proof claims found by the Machine-checked rules (modules/verification/rules.json)",
      tag: (text) => { const r = V.check(text); return r.rung.id === "none" ? [] : [{ qid: "topic:formal-verification", label: "Formal verification", matched: r.found.map((w) => w.toLowerCase()), method: "rule" }]; },
    });
  },
};
