// The superintelligence rubric: how a piece of text bears on the path to superintelligence, along the eight dimensions
// in lib/ontology.json "si_rubric" (capability: generality, autonomy, AI improving AI, beyond human level, scale;
// control: understanding internals, oversight and alignment; risk: failure modes). Deterministic: the same title, text
// and topics always give the same profile, every point names the topic, term or sentence that earned it, and no model
// is asked. Used by lib/analysis.js (stories and the Review desk) and by the research map of Anthropic and Goodfire work
// (modules/knowledge/research.js).
const { ontology } = require("./tagger");
const { negatedBefore } = require("./negation");

const R = ontology.si_rubric || { dimensions: [] };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole-word match; a trailing * matches any word ending ("monitor*" matches monitors, monitoring).
const termRe = (term) => { const t = term.toLowerCase(), pre = t.endsWith("*"); return new RegExp(`(?<![\\p{L}\\p{N}])${esc(pre ? t.slice(0, -1) : t)}${pre ? "[\\p{L}\\p{N}-]*" : "(?![\\p{L}\\p{N}])"}`, "giu"); };
const DIMS = (R.dimensions || []).map((d) => ({ ...d, res: d.terms.map((t) => [t, termRe(t)]) }));
const AXES = ["capability", "control", "risk"];
// A measurement in a sentence: a number with a unit or a percentage, a ratio, a sample size or an uncertainty. Years
// and section numbers alone are not measurements.
const MEASURE = /(?<![\p{L}\d.])(?:\d+(?:\.\d+)?\s?(?:[\p{L}-]+\s){0,2}?(?:%|percent|x\b|×|points?\b|pp\b|hours?\b|days?\b|tasks?\b|models?\b|runs?\b|seeds?\b|samples?\b|prompts?\b|problems?\b|participants?\b)|n\s?=\s?\d+|±\s?\d|p\s?[<=]\s?0?\.\d|\d+(?:\.\d+)?\s?(?:of|out of)\s\d+)/iu;
const sentences = (text) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

// The first un-negated mention of any of a dimension's terms, with the sentence it sits in.
function firstTerm(dim, text, sents) {
  let negated = false;
  for (const [term, re] of dim.res) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (negatedBefore(text, m.index)) { negated = true; continue; }
      const measured = sents.find((s) => { const r2 = new RegExp(re.source, re.flags); return r2.test(s) && MEASURE.test(s); });
      return { term, match: m[0], measured: measured || null };
    }
  }
  return negated ? { negatedOnly: true } : null;
}

/**
 * @param input {title, text, topics: [{id, via?}]}  topics from the tagger; inherited (via) topics don't count
 * @returns {dimensions: [{id, label, axis, level 0-3, why: [..]}], axes: {capability, control, risk}, stance, relevance 0-100, engaged, measured, summary}
 */
function profile({ title = "", text = "", topics = [] } = {}) {
  const body = `${title}\n${text}`.slice(0, 8000), sents = sentences(body);
  // A topic counts only when at least one of the terms that tagged it is mentioned without a negation: the tagger
  // itself doesn't read negation, so "no evidence of recursive self-improvement" is tagged but earns nothing here.
  const live = (t) => !(t.matched || []).length || t.matched.some((term) => { const re = termRe(term); return [...body.matchAll(re)].some((m) => !negatedBefore(body, m.index)); });
  const tagged = new Set(topics.filter((t) => !t.via && live(t)).map((t) => t.id));
  const dest = R.destination || { topics: [], terms: [] };
  const destTerm = dest.terms.map((t) => [t, termRe(t)]).find(([, re]) => [...body.matchAll(re)].some((m) => !negatedBefore(body, m.index)));
  const destination = dest.topics.some((t) => tagged.has(t)) || !!destTerm;
  const dimensions = DIMS.map((d) => {
    const why = [];
    const topic = d.topics.find((t) => tagged.has(t));
    const found = firstTerm(d, body, sents), hit = found && !found.negatedOnly ? found : null;
    // A topic the tagger found only in negated mentions ("no evidence of recursive self-improvement") earns nothing.
    if (topic && !(found && found.negatedOnly)) why.push({ points: 1, kind: "topic", detail: `tagged ${topic}` });
    if (hit) why.push({ points: 1, kind: "term", detail: `"${hit.match}"` });
    if (hit && hit.measured) why.push({ points: 1, kind: "measured", detail: hit.measured.length > 140 ? hit.measured.slice(0, 137) + "…" : hit.measured });
    const level = why.reduce((a, w) => a + w.points, 0);
    return { id: d.id, label: d.label, axis: d.axis, means: d.means, level, why };
  });
  const axes = Object.fromEntries(AXES.map((a) => [a, dimensions.filter((d) => d.axis === a).reduce((s, d) => s + d.level, 0)]));
  const engaged = dimensions.filter((d) => d.level > 0).length, measured = dimensions.filter((d) => d.why.some((w) => w.kind === "measured")).length;
  // Relevance: 12 for each dimension a piece engages, 6 more for each it backs with a measurement, at most 100.
  const relevance = Math.min(100, 12 * engaged + 6 * measured);
  const cap = axes.capability >= 2, ctl = axes.control + axes.risk >= 2;
  const stance = cap && ctl ? "both" : cap ? "capability" : ctl ? "control" : engaged || destination ? "adjacent" : "none";
  const top = dimensions.filter((d) => d.level > 0).sort((a, b) => b.level - a.level || DIMS.findIndex((x) => x.id === a.id) - DIMS.findIndex((x) => x.id === b.id)).slice(0, 3);
  const STANCE = { both: "moves capability and how we could control it", capability: "mostly about capability", control: "mostly about understanding or controlling systems", adjacent: "touches the path to superintelligence lightly", none: "not about the path to superintelligence" };
  const summary = `${STANCE[stance]}${top.length ? `: ${top.map((d) => `${d.label.toLowerCase()} ${d.level}/3`).join(", ")}` : ""}`;
  return { dimensions, axes, stance, relevance, engaged, measured, destination, summary };
}

// The rubric as published criteria (the Review desk's criteria page and the research site show it).
const criteria = () => ({ about: R.about, destination: R.destination, dimensions: DIMS.map(({ id, label, axis, means, topics, terms }) => ({ id, label, axis, means, topics, terms })),
  relevance: "12 points for each dimension a piece engages and 6 more for each it backs with a measurement, at most 100.",
  stance: "Capability when the capability dimensions reach 2 or more in total (a topic and a term, or a measured term), control when control and failure modes together reach 2 or more, both when both do; adjacent when a piece engages less or only names the destination." });

module.exports = { profile, criteria, DIMENSIONS: DIMS.map(({ id, label, axis }) => ({ id, label, axis })) };
