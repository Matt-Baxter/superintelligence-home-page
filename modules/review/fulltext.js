// Two readings of one piece (REQ-027, REQ-028): the Review desk's judgement of the abstract or summary, and a reading of
// the whole text. A paper's full text is read by modules/responses (contributions traced to body results, abstract numbers
// found again in the body, the full-text rigor checklist); an article's full text goes through the Review desk itself,
// so its claims and hype are judged on what the outlet wrote, not on our paraphrase. The superintelligence rubric
// (lib/si-rubric.js) runs on the full text, where measurements are visible. Deterministic: same texts, same result.
//
// Rules (published in CRITERIA.fulltext):
//   full-text credibility = half full-text rigor + half (100 - hype)        (papers; the same formula as the abstract's)
//                         = the article's own review credibility              (articles)
//   the readings disagree when the two credibilities differ by 20 or more, or a number the abstract reports is found
//   nowhere in the body while the abstract judgement called the piece credible; disagreement sends it to a person.
//   A cut-off text (truncated) is reported and never moves the verdict down.
const rubric = require("../../lib/si-rubric");
const { tag } = require("../../lib/tagger");

const GAP = 20;
const CREDIBLE = new Set(["major and credible", "solid, modest step", "plausible, worth checking"]);
// The Review desk's own verdict rules, applied to the full-text credibility (significance stays the abstract's).
const verdictFor = (score, credibility) => require("./review").VERDICTS.find((v) => v.id !== "withdrawn" && v.when(score, credibility, {})).id;
const LEVEL_WEIGHT = { backed: 1, "partly backed": 0.5, described: 0.5, "not found in the body": 0 };
const RULES = {
  about: "A second reading of the whole text, next to the judgement of the abstract or summary. For a paper: the full-text rigor checklist (baselines, ablations, spread over seeds or runs, statistical tests, held-out data, contamination checks, released code, stated limits, compute, proofs, independent benchmarks), each contribution the abstract claims traced to a result, table or theorem in the body, and the abstract's numbers looked for again in the body. For an article: the Review desk's judgement run on the outlet's own text instead of our summary.",
  credibility: "Full-text credibility is half the full-text rigor plus half of (100 minus hype) for a paper, and the article's own review credibility for an article.",
  disagree: `The readings disagree when the two credibilities differ by ${GAP} or more, or when the abstract judgement called a piece credible and a number its abstract reports is found nowhere in the body (contributions traced to body results are shown, not scored: a stated aim or hypothesis has no result to find). A disagreement goes to a person; the verdict shown is the full-text one, with the abstract's beside it.`,
  truncated: "When only part of the text could be read, that is said, and a missing section never lowers the result.",
};

function profile(title, text) {
  const t = String(text || "").slice(0, 40000);
  return rubric.profile({ title, text: t, topics: tag(title, t.slice(0, 6000)).topics });
}

/** A paper: `abstractReview` from review.review(), `analysis` from responses/analysis.analyse(doc), `doc` from the reader. */
function paper({ abstractReview, analysis, doc, truncated = false }) {
  const contribs = analysis.contributions || [];
  const backedShare = contribs.length ? contribs.reduce((a, c) => a + (LEVEL_WEIGHT[c.level] ?? 0), 0) / contribs.length : null;
  const nums = analysis.abstractNumbers || [], traced = nums.length ? nums.filter((n) => n.inBody).length / nums.length : null;
  const rigor = Math.round((100 * analysis.rigor) / (analysis.rigorMax || 100));
  const hype = abstractReview.judges?.find((j) => j.id === "hype")?.score ?? abstractReview.hype?.score ?? 0;
  const credibility = Math.round(rigor / 2 + (100 - hype) / 2);
  const missing = contribs.filter((c) => c.level === "not found in the body");
  const body = (doc.sections || []).filter((s) => !["references", "appendix"].includes(s.kind)).map((s) => s.text).join("\n");
  const reasons = [];
  if (Math.abs(credibility - abstractReview.credibility) >= GAP) reasons.push(`credibility ${abstractReview.credibility} from the abstract, ${credibility} from the full text`);
  const untraced = nums.filter((n) => !n.inBody).map((n) => n.number);
  if (CREDIBLE.has(abstractReview.verdict) && untraced.length) reasons.push(`the abstract's number${untraced.length > 1 ? "s" : ""} ${untraced.join(", ")} found nowhere in the body`);
  // A cut-off text can't show a missing section or a missing number; only credibility rising counts then.
  const counted = truncated ? reasons.filter((r) => r.startsWith("credibility") && credibility > abstractReview.credibility) : reasons;
  return {
    kind: "paper", truncated, rigor, credibility, hype, verdict: verdictFor(abstractReview.score, credibility),
    abstract: { credibility: abstractReview.credibility, verdict: abstractReview.verdict },
    contributions: { total: contribs.length, backedShare: backedShare === null ? null : Math.round(backedShare * 100) / 100, notFound: missing.map((c) => c.text.slice(0, 160)) },
    abstractNumbers: { total: nums.length, traced: traced === null ? null : Math.round(traced * 100) / 100 },
    checks: (analysis.checklist || []).filter((c) => c.met).map((c) => c.id),
    strength: analysis.strength,
    si: summarise(profile(doc.title, body)),
    agree: counted.length === 0, reasons: counted,
  };
}

/** An article: `summaryReview` judged our paraphrase, `fullReview` judged the outlet's own text. */
function article({ summaryReview, fullReview, title, text, truncated = false }) {
  const reasons = [];
  if (Math.abs(fullReview.credibility - summaryReview.credibility) >= GAP) reasons.push(`credibility ${summaryReview.credibility} from our summary, ${fullReview.credibility} from the article's own text`);
  return {
    kind: "article", truncated, credibility: fullReview.credibility, verdict: fullReview.verdict,
    hype: fullReview.judges?.find((j) => j.id === "hype")?.score ?? null, grade: fullReview.source?.grade,
    abstract: { credibility: summaryReview.credibility, verdict: summaryReview.verdict, grade: summaryReview.source?.grade },
    forecasts: (fullReview.forecasts || []).map((f) => ({ sentence: f.sentence, due: f.due })),
    si: summarise(profile(title, text)),
    agree: reasons.length === 0, reasons,
  };
}

const summarise = (p) => ({ stance: p.stance, relevance: p.relevance, summary: p.summary, measured: p.measured, engaged: p.engaged });

module.exports = { paper, article, RULES, GAP };
