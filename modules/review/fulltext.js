// Two readings of one piece (REQ-027, REQ-028): the Review desk's judgement of the abstract or summary, and a reading of
// the whole text. A paper's full text is read by modules/responses (contributions traced to body results, abstract numbers
// found again in the body, the full-text rigor checklist); an article's full text goes through the Review desk itself,
// so its claims and hype are judged on what the outlet wrote, not on our paraphrase. The superintelligence rubric
// (lib/si-rubric.js) runs on the full text, where measurements are visible. Deterministic: same texts, same result.
//
// Rules (published in CRITERIA.fulltext):
//   full-text credibility = half full-text rigor + half (100 - body hype)   (papers; the same formula as the abstract's)
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
  credibility: "Full-text credibility is half the full-text rigor plus half of (100 minus the hype measured on the body) for a paper, and the article's own review credibility for an article. Credits, acknowledgements and funding sections never count as evidence.",
  disagree: `The readings disagree when the full text is ${GAP} or more below the abstract on credibility (the abstract oversells its body), or when the abstract judgement called a piece credible and a number its abstract reports is found nowhere in the body (contributions traced to body results are shown, not scored: a stated aim or hypothesis has no result to find). A disagreement goes to a person. A full text ${GAP} or more above its abstract is noted ("the abstract undersells it") and its verdict stands, since abstracts leave out seeds, ablations and limits. The verdict shown is the full-text one, with the abstract's beside it.`,
  truncated: "When only part of the text could be read, that is said; a missing section never lowers the result, and a partial reading sends nothing to a person.",
};

function profile(title, text) {
  const t = String(text || "").slice(0, 40000);
  return rubric.profile({ title, text: t, topics: tag(title, t.slice(0, 6000)).topics });
}

/** A paper: `abstractReview` from review.review(), `analysis` from responses/analysis.analyse(doc), `doc` from the reader. */
function paper({ abstractReview, analysis, doc, truncated = false, at }) {
  const contribs = analysis.contributions || [];
  const backedShare = contribs.length ? contribs.reduce((a, c) => a + (LEVEL_WEIGHT[c.level] ?? 0), 0) / contribs.length : null;
  const nums = analysis.abstractNumbers || [], traced = nums.length ? nums.filter((n) => n.inBody).length / nums.length : null;
  const rigor = Math.round((100 * analysis.rigor) / (analysis.rigorMax || 100));
  // Hype on the full text is the Review desk's hype judge run on the body (claims there can carry their evidence);
  // the abstract's hype is shown beside it.
  const bodyText = (doc.sections || []).filter((s) => !["references", "appendix", "related"].includes(s.kind) && !/\b(contribut\w*|acknowledg\w*|funding)\b/i.test(s.heading)).map((s) => s.text).join("\n");
  const absHype = abstractReview.judges?.find((j) => j.id === "hype")?.score ?? 0;
  const bodyHype = doc.fullText ? require("./review").review({ kind: "paper", title: doc.title || "", text: bodyText }).judges.find((j) => j.id === "hype").score : absHype;
  const hype = bodyHype;
  const credibility = Math.round(rigor / 2 + (100 - hype) / 2);
  const missing = contribs.filter((c) => c.level === "not found in the body");
  const body = (doc.sections || []).filter((s) => !["references", "appendix"].includes(s.kind)).map((s) => s.text).join("\n");
  const reasons = [];
  // Only the risky direction goes to a person: a body weaker than its abstract (the abstract oversells). A body
  // stronger than its abstract is normal (abstracts leave out seeds, ablations and limits) and is reported as a note.
  if (abstractReview.credibility - credibility >= GAP) reasons.push(`credibility ${abstractReview.credibility} from the abstract, ${credibility} from the full text: the abstract oversells the body`);
  const notes = credibility - abstractReview.credibility >= GAP ? [`the abstract undersells the body (credibility ${abstractReview.credibility} from the abstract, ${credibility} from the full text); the full-text verdict stands`] : [];
  const untraced = nums.filter((n) => !n.inBody).map((n) => n.number);
  if (CREDIBLE.has(abstractReview.verdict) && untraced.length) reasons.push(`the abstract's number${untraced.length > 1 ? "s" : ""} ${untraced.join(", ")} found nowhere in the body`);
  // A cut-off text can't show a missing section or a missing number, so it sends nothing to a person.
  // Under 100 words of body is not a full text: the checklist then reads the abstract, so the readings aren't independent.
  const abstractOnly = !doc.fullText;
  const counted = truncated || abstractOnly ? [] : reasons;
  return {
    kind: "paper", truncated, abstractOnly, rigor, credibility, hype, abstractHype: absHype, verdict: verdictFor(abstractReview.score, credibility),
    abstract: { credibility: abstractReview.credibility, verdict: abstractReview.verdict },
    contributions: { total: contribs.length, backedShare: backedShare === null ? null : Math.round(backedShare * 100) / 100, notFound: missing.map((c) => c.text.slice(0, 160)) },
    abstractNumbers: { total: nums.length, traced: traced === null ? null : Math.round(traced * 100) / 100 },
    checks: (analysis.checklist || []).filter((c) => c.met).map((c) => c.id),
    strength: analysis.strength,
    si: summarise(profile(doc.title, body)),
    forecasts: require("./sources").predictions(body.split(/(?<=[.!?])\s+/).slice(0, 2000), at || undefined).map((f) => ({ sentence: f.sentence, due: f.due })),
    agree: counted.length === 0, reasons: counted, notes,
    logic: [
      ...judgeSteps(abstractReview, "Abstract"),
      { step: "Full text: rigor checklist", result: `${rigor} of 100`, because: [...(analysis.checklist || []).map((c) => c.met ? `+${c.earned} ${c.label}: "${clip(c.evidence, 140)}"` : `missing: ${c.label}`), ...(analysis.penalties || []).map((p) => `${p.points} ${p.label}`)] },
      { step: "Full text: abstract numbers in the body", result: traced === null ? "none to trace" : `${nums.filter((n) => n.inBody).length} of ${nums.length}`, because: nums.map((n) => `${n.number}: ${n.inBody ? "found" : "not found"}`) },
      { step: "Full text: contributions traced to results", result: backedShare === null ? "none stated" : `${Math.round(backedShare * 100)}% backed`, because: contribs.map((c) => `${c.level}: "${clip(c.text, 120)}"`) },
      { step: "Full text: credibility and verdict", result: `${credibility}, ${verdictFor(abstractReview.score, credibility)}`, because: [`credibility = full-text rigor / 2 + (100 - full-text hype) / 2 = ${rigor} / 2 + (100 - ${hype}) / 2`, `hype: ${absHype} on the abstract, ${hype} on the body`, `significance stays the abstract's guarded score (${abstractReview.score})`] },
      { step: "Readings", result: counted.length ? "disagree: a person looks" : "agree", because: counted.length ? counted : [...notes, `no oversell of ${GAP} or more and no abstract number missing from the body${truncated ? " (text cut off: nothing is sent to a person on a partial reading)" : ""}`] },
    ],
  };
}

/** An article: `summaryReview` judged our paraphrase, `fullReview` judged the outlet's own text. */
function article({ summaryReview, fullReview, title, text, truncated = false }) {
  const reasons = [];
  // For articles both directions matter: our summary can flatter or underrate the outlet's own text.
  if (Math.abs(fullReview.credibility - summaryReview.credibility) >= GAP) reasons.push(`credibility ${summaryReview.credibility} from our summary, ${fullReview.credibility} from the article's own text: our summary ${fullReview.credibility > summaryReview.credibility ? "underrated" : "flattered"} it`);
  return {
    kind: "article", truncated, credibility: fullReview.credibility, verdict: fullReview.verdict,
    hype: fullReview.judges?.find((j) => j.id === "hype")?.score ?? null, grade: fullReview.source?.grade,
    abstract: { credibility: summaryReview.credibility, verdict: summaryReview.verdict, grade: summaryReview.source?.grade },
    forecasts: (fullReview.forecasts || []).map((f) => ({ sentence: f.sentence, due: f.due })),
    si: summarise(profile(title, text)),
    agree: reasons.length === 0, reasons,
    logic: [...judgeSteps(summaryReview, "Our summary"), ...judgeSteps(fullReview, "Article text"),
      { step: "Readings", result: reasons.length ? "disagree: a person looks" : "agree", because: reasons.length ? reasons : [`credibilities within ${GAP}`] }],
  };
}

const summarise = (p) => ({ stance: p.stance, relevance: p.relevance, summary: p.summary, measured: p.measured, engaged: p.engaged,
  dimensions: p.dimensions.filter((d) => d.level > 0).map((d) => ({ label: d.label, axis: d.axis, level: d.level, why: d.why.map((w) => `${w.kind}: ${w.detail}`) })) });
const clip = (s, n = 160) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
// The judgement as the steps that produced it, each with its result and the reasons behind it (what read.js prints).
function judgeSteps(r, who) {
  const j = (id) => r.judges.find((x) => x.id === id) || { score: null, why: [] };
  return [
    { step: `${who}: significance`, result: `${j("significance").score} before the guards, ${r.score} after`, because: j("significance").why.map((w) => `+${w.points} ${w.factor}${w.detail ? `: ${clip(w.detail, 120)}` : ""}`) },
    { step: `${who}: rigor (${r.rubric} rubric)`, result: j("rigor").score, because: [...j("rigor").why.map((w) => `+${w.points} ${w.factor}${w.detail ? `: "${clip(w.detail, 120)}"` : ""}`), ...(j("rigor").missing || []).map((m) => `missing: ${m}`)] },
    { step: `${who}: hype`, result: j("hype").score, because: j("hype").why.filter((w) => w.points || w.detail).map((w) => `${w.factor}: ${w.detail || w.points}`) },
    { step: `${who}: credibility and verdict`, result: `${r.credibility}, ${r.verdict}`, because: [`credibility = rigor / 2 + (100 - hype) / 2 = ${j("rigor").score} / 2 + (100 - ${j("hype").score}) / 2`, `verdict rule: ${r.verdictRule}`] },
  ];
}

module.exports = { paper, article, RULES, GAP };
