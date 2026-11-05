// Shared, transparent arithmetic every judge can use: normalize weights, weighted totals (0-100), ranking, warnings.
// Input: { title, criteria: [{id, label, weight}], entries: [{id, label, link?}], scores: {entryId: {criterionId: {score 0-10, evidence}}} }
function weighted(input) {
  const warnings = [];
  const criteria = (input.criteria || []).filter((c) => c && c.id);
  const entries = (input.entries || []).filter((e) => e && e.id);
  if (criteria.length < 1) throw Object.assign(new Error("Add at least one criterion."), { status: 400 });
  if (entries.length < 2) throw Object.assign(new Error("Add at least two entries to compare."), { status: 400 });
  const wsum = criteria.reduce((a, c) => a + Math.max(0, Number(c.weight) || 0), 0);
  if (!wsum) throw Object.assign(new Error("Give at least one criterion a weight above zero."), { status: 400 });
  if (Math.abs(wsum - 100) > 0.5) warnings.push(`Weights add up to ${+wsum.toFixed(1)}, not 100; they were scaled to 100.`);
  const totals = entries.map((e) => {
    const per = criteria.map((c) => {
      const cell = input.scores?.[e.id]?.[c.id] || {};
      const raw = cell.score === "" || cell.score == null ? null : Number(cell.score);
      const score = raw == null || Number.isNaN(raw) ? null : Math.max(0, Math.min(10, raw));
      const weight = (Math.max(0, Number(c.weight) || 0) / wsum) * 100;
      if (score == null) warnings.push(`${e.label || e.id}: no score for "${c.label || c.id}" (counted as 0).`);
      else if (!String(cell.evidence || "").trim()) warnings.push(`${e.label || e.id}: no evidence for "${c.label || c.id}".`);
      return { criterion: c.id, label: c.label || c.id, weight: +weight.toFixed(1), score, weighted: +(((score || 0) / 10) * weight).toFixed(2), evidence: cell.evidence || "" };
    });
    return { entry: e.id, label: e.label || e.id, link: e.link || "", total: +per.reduce((a, p) => a + p.weighted, 0).toFixed(1), perCriterion: per };
  }).sort((a, b) => b.total - a.total);
  return { criteria: criteria.map((c) => ({ id: c.id, label: c.label || c.id, weight: +((Math.max(0, Number(c.weight) || 0) / wsum) * 100).toFixed(1) })), totals, ranking: totals.map((t) => t.entry), margin: +(totals[0].total - totals[1].total).toFixed(1), warnings };
}
module.exports = { weighted };
