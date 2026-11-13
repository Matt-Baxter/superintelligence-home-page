// Agreement between people, and between the judge and people, on blind labels (REQ-027, REQ-029). The judge is only
// worth trusting as far as it agrees with careful people, and only as far as those people agree with each other: if two
// people agree 70% of the time, a judge at 70% is as good as a second person and 95% would be suspicious.
//
// Labels are "yes" (would rely on it), "no" (would not) or "unsure". Kappa uses pieces both sides answered yes or no;
// "unsure" is counted, not dropped silently. The judge's label: "no" when its verdict is doubtful or withdrawn.

const judgeLabel = (verdict) => (["doubtful", "withdrawn"].includes(verdict) ? "no" : "yes");

// Cohen's kappa for two raters over paired binary labels [["yes","no"], ...], with an approximate 95% interval
// (SE = sqrt(po(1-po) / (n(1-pe)^2)), the large-sample form). Fewer than 2 pairs: nothing to say.
function kappa(pairs) {
  const n = pairs.length;
  if (n < 2) return { n, agree: null, kappa: null, low: null, high: null };
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pa = pairs.filter(([a]) => a === "yes").length / n, pb = pairs.filter(([, b]) => b === "yes").length / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  const r = (x) => Math.round(x * 100) / 100;
  if (pe === 1) return { n, agree: r(po), kappa: null, low: null, high: null, why: "both always gave the same answer, so chance agreement is total and kappa is undefined" };
  const k = (po - pe) / (1 - pe), se = Math.sqrt((po * (1 - po)) / (n * (1 - pe) ** 2));
  return { n, agree: r(po), kappa: r(k), low: r(Math.max(-1, k - 1.96 * se)), high: r(Math.min(1, k + 1.96 * se)) };
}

// Plain words for a kappa (Landis and Koch's bands, the usual reading).
const reading = (k) => (k == null ? "not enough labels yet" : k < 0 ? "worse than chance" : k < 0.2 ? "slight" : k < 0.4 ? "fair" : k < 0.6 ? "moderate" : k < 0.8 ? "substantial" : "almost perfect");

// rows: [{ doc, user, name, credible, verdict }] (one per person per piece). Returns everything the labels page shows.
function stats(rows) {
  const people = [...new Map(rows.map((r) => [r.user, r.name])).entries()].map(([id, name]) => ({ id, name, n: rows.filter((r) => r.user === id).length, unsure: rows.filter((r) => r.user === id && r.credible === "unsure").length }));
  const byDoc = new Map();
  for (const r of rows) { if (!byDoc.has(r.doc)) byDoc.set(r.doc, { verdict: r.verdict, by: new Map() }); byDoc.get(r.doc).by.set(r.user, r.credible); }
  const sure = (x) => x === "yes" || x === "no";
  const pairs = [];
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    const a = people[i], b = people[j], ps = [];
    for (const d of byDoc.values()) { const x = d.by.get(a.id), y = d.by.get(b.id); if (sure(x) && sure(y)) ps.push([x, y]); }
    const k = kappa(ps); pairs.push({ a: a.name, b: b.name, ...k, reading: reading(k.kappa) });
  }
  const judge = people.map((p) => {
    const ps = []; for (const d of byDoc.values()) { const x = d.by.get(p.id); if (sure(x)) ps.push([x, judgeLabel(d.verdict)]); }
    const k = kappa(ps); return { person: p.name, ...k, reading: reading(k.kappa) };
  });
  // The majority of people who answered yes or no on a piece (ties left out), against the judge.
  const maj = [];
  for (const d of byDoc.values()) {
    const v = [...d.by.values()].filter(sure); if (!v.length) continue;
    const yes = v.filter((x) => x === "yes").length, no = v.length - yes;
    if (yes !== no) maj.push([yes > no ? "yes" : "no", judgeLabel(d.verdict)]);
  }
  const km = kappa(maj);
  const shared = [...byDoc.values()].filter((d) => [...d.by.values()].filter(sure).length >= 2).length;
  const notes = [];
  if (shared < 30) notes.push(`${shared} piece${shared === 1 ? "" : "s"} labelled by two or more people; aim for at least 30 before reading much into kappa (the interval says how unsure it still is).`);
  return { pieces: byDoc.size, shared, people, pairs, judge, majority: { ...km, reading: reading(km.kappa) }, notes };
}

module.exports = { kappa, stats, judgeLabel, reading };
