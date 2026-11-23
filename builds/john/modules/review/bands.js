// Score bands around the Review desk's cutoffs (REQ-037, spec 003 T041). A score near a cutoff is reported as
// borderline instead of with a confident label a few points could flip.
//
// For cutoff T and margin m the bands are half-open, so every finite score is in exactly one:
//   Low     S < T - m
//   Border  T - m <= S < T + m
//   High    S >= T + m
// The margin: one evidence marker moves rigor by at most its weight (largest 14, review.js MARKERS) and so credibility
// (0.5 x rigor + 0.5 x (100 - hype)) by at most ceil(14 / 2) = 7 with hype held fixed (proofs/Judge.lean,
// credibility_flip_7). Border is 2m wide, so with 2m >= 7 one marker can never jump from Low to High
// (flip_low_not_high; m = 3 can, margin_3_can_jump). m = 5 gives 2m = 10, three points to spare.
// Hype can move too when a marker sentence also backs a claim (proofs/README.md gap 1), so this is a floor, not a
// guarantee about review() as a whole.
const MARGIN = 5;
const MAX_ONE_MARKER = 7; // largest change one marker family makes to credibility, hype fixed: ceil(max weight / 2)
if (2 * MARGIN < MAX_ONE_MARKER) throw new Error("bands: 2m must be at least the largest one-marker change");

// The cutoffs review.js's verdict and dossier.js's credible test use (the same list as scripts/judge-report.js).
const CUTOFFS = [
  { field: "credibility", at: 35, why: "below it the verdict is \"doubtful\"" },
  { field: "credibility", at: 55, why: "\"plausible, worth checking\" needs it" },
  { field: "credibility", at: 60, why: "\"major and credible\" needs it, and the dossier counts a paper as credible only in its High band" },
  { field: "credibility", at: 70, why: "\"solid, modest step\" needs it" },
  { field: "score", at: 40, why: "\"big if true\" needs it" },
  { field: "score", at: 55, why: "\"major and credible\" needs it" },
];
const CREDIBLE_AT = 60; // dossier.js: a primary paper is credible when its credibility is High for this cutoff

// "low" | "border" | "high"; null for anything that isn't a finite number (nothing to band).
function band(score, T, m = MARGIN) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  return score < T - m ? "low" : score < T + m ? "border" : "high";
}
const NAMES = { low: "Low", border: "Border", high: "High" };
const label = (b, T) => (b ? `${NAMES[b]} (${T})` : "");

// One line of text for a score against one cutoff.
function describe(field, score, T, m = MARGIN) {
  const b = band(score, T, m);
  if (b === "border") return `${field} ${score} is within ${m} of ${T} (borderline from ${T - m} up to ${T + m})`;
  if (b === "high") return `${field} ${score} is clearly above ${T} (${T + m} or more)`;
  if (b === "low") return `${field} ${score} is clearly below ${T} (under ${T - m})`;
  return `no ${field} to compare with ${T}`;
}

// The verdict rule, written once more so a borderline note can say whether crossing a cutoff would change it.
// Use the published verdict table so research-specific verdicts cannot drift.
const verdictOf = (score, credibility, flags) => require("./review").VERDICTS.find((v) => v.when(score, credibility, flags)).id;

// Bands for one review, and which Border cutoffs matter: those where landing on the other side of the cutoff would
// change the verdict, and credibility 60 for papers (the dossier's credible test). verdictNote is a qualifier shown
// next to the verdict; the verdict string itself is unchanged.
// A cutoff "could flip the verdict" when putting the value on the other side of it changes the verdict, with the other
// field either where it is or on either side of its Border cutoffs (both can move at once: credibility 58 and score
// 50 are "big if true", 60 and 55 together are "major and credible"). With m = 5 a field is Border for at most one
// cutoff (30-39, 55-64, 65-74; 35-44, 50-59 don't overlap), so this is at most 2 x 3 cases.
function judge(score, credibility, { m = MARGIN, kind } = {}) {
  const bands = { credibility: {}, score: {} }, items = [], border = { credibility: [], score: [] };
  for (const c of CUTOFFS) { const v = c.field === "score" ? score : credibility; bands[c.field][String(c.at)] = band(v, c.at, m); if (bands[c.field][String(c.at)] === "border") border[c.field].push(c.at); }
  const sides = (field, v) => [v, ...border[field].flatMap((T) => [T - 1, T])];
  for (const c of CUTOFFS) {
    const v = c.field === "score" ? score : credibility;
    if (bands[c.field][String(c.at)] !== "border") continue;
    const other = c.field === "score" ? "credibility" : "score", ov = other === "score" ? score : credibility;
    const at = (x, o) => (c.field === "score" ? verdictOf(x, o) : verdictOf(o, x));
    const flips = sides(other, ov).some((o) => at(c.at - 1, o) !== at(c.at, o));
    const affects = [...(flips ? ["verdict"] : []), ...(c.field === "credibility" && c.at === CREDIBLE_AT && kind !== "comment" ? ["dossier"] : [])];
    if (affects.length) items.push({ field: c.field, cutoff: c.at, value: v, margin: m, side: v >= c.at ? "at or above" : "below", affects, reason: describe(c.field, v, c.at, m) });
  }
  const forVerdict = items.filter((x) => x.affects.includes("verdict"));
  return { bands, margin: m, borderline: items.length > 0, borderlineReasons: items,
    verdictNote: forVerdict.length ? `borderline: ${forVerdict.map((x) => `${x.field} ${x.value} is within ${m} of ${x.cutoff}`).join("; ")}` : null };
}

// The watcher digest's Band column: the Border cutoffs that matter, else the credible test's band, e.g. "Border (60)".
function digest(r, m = MARGIN) {
  const j = judge(r.score, r.credibility, { m, kind: r.kind });
  return j.borderlineReasons.length ? `Border (${j.borderlineReasons.map((x) => (x.field === "score" ? `score ${x.cutoff}` : x.cutoff)).join(", ")})` : label(band(r.credibility, CREDIBLE_AT, m), CREDIBLE_AT);
}

module.exports = { MARGIN, MAX_ONE_MARKER, CUTOFFS, CREDIBLE_AT, band, label, describe, verdictOf, judge, digest };
