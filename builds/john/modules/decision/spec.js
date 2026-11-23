// Turn a judge's result into a json-render spec (Verdict + Scorecard + per-criterion evidence). Used by the API and views.
module.exports = function verdictSpec(result, input) {
  const els = {}; let n = 0;
  const el = (type, props = {}, children = []) => { const id = `${type.toLowerCase()}-${++n}`; els[id] = { type, props, children }; return id; };
  const rec = result.recommendation;
  const kids = [
    el("Verdict", {
      judge: result.judge, method: result.method, title: input.title || "Decision",
      recommendation: rec ? rec.label : "No recommendation yet",
      reason: rec ? rec.reason : "Enter the external judge's recommendation to complete this decision.",
      tone: !rec ? "warn" : result.agreement && !result.agreement.agrees ? "warn" : "good",
      agreement: result.agreement ? result.agreement.note : "",
      warnings: result.warnings.slice(0, 8),
    }),
    el("Scorecard", {
      criteria: result.criteria.map((c) => ({ label: c.label, weight: c.weight })),
      entries: result.totals.map((t, i) => ({ label: t.label, total: t.total, scores: t.perCriterion.map((p) => p.score), leader: i === 0 })),
      caption: `Scores 0-10 per criterion; totals are weighted to 0-100. Margin between the top two: ${result.margin} points.`,
    }),
    el("Card", { title: "Evidence", subtitle: "What each score rests on" }, [
      el("Table", { columns: ["Entry", "Criterion", "Score", "Evidence"], rows: result.totals.flatMap((t) => t.perCriterion.map((p) => [t.label, p.label, p.score == null ? "—" : String(p.score), p.evidence || "—"])) }),
    ]),
  ];
  return { root: el("Stack", { gap: "md" }, kids), elements: els };
};
