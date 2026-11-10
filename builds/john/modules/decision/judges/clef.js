// CLEF as a pluggable judge. CLEF is an external decision model: it isn't defined in this repo, so this judge doesn't
// compute a verdict itself. It records the scores and recommendation from a CLEF run, and cross-checks them against
// the transparent weighted totals so both partners can see whether the two agree before signing off.
const { weighted } = require("../score");

module.exports = {
  id: "clef",
  name: "CLEF",
  description: "Records a CLEF run made outside this app (its per-criterion scores and its recommendation) and checks the recommendation against transparent weighted totals.",
  method: "external",
  inputs: { external: "{ recommendation: entry id or \"merge\", rationale, ranBy, runAt }" },
  judge(input) {
    const w = weighted(input), ext = input.external || {};
    const top = w.totals[0];
    if (!ext.recommendation) {
      return { judge: "clef", method: "external", ...w, recommendation: null,
        warnings: [...w.warnings, "No CLEF recommendation entered yet. Run CLEF, then add its recommendation and rationale; until then this shows the weighted totals only."] };
    }
    const label = ext.recommendation === "merge" ? "Merge" : (w.totals.find((t) => t.entry === ext.recommendation)?.label || ext.recommendation);
    const agrees = ext.recommendation === "merge" ? w.margin < 3 : ext.recommendation === top.entry;
    return {
      judge: "clef", method: "external", ...w,
      recommendation: { entry: ext.recommendation, label, reason: ext.rationale || "No rationale entered.", ranBy: ext.ranBy || "", runAt: ext.runAt || "" },
      agreement: { computedTop: top.entry, agrees, note: agrees ? "CLEF agrees with the weighted totals." : `CLEF recommends ${label}, but the weighted totals put ${top.label} first. Check the scores and evidence before signing off.` },
    };
  },
};
