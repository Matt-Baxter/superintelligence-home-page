// Negation, shared by lib/analysis.js (frontier claims) and lib/si-rubric.js (superintelligence dimensions).
// A frontier claim counts only when some mention of it is not negated in its own clause: "does not achieve
// superhuman performance" and "no evidence of recursive self-improvement" earn nothing (REQ-007: every point must be
// a real claim). A negator (not, no, never, without, cannot, n't, fails to) within the 5 words before the match, with
// no clause break (comma, semicolon, colon, bracket, and, but, while, although, though, yet, however) in between, negates
// it; two negators cancel ("not without superhuman…"); "no more/less/longer…" and "not only/just" are comparisons, not
// negations. The same rule as the Review desk's markers (modules/review/review.js), kept in lib/ because lib/ cannot
// depend on a module.
const NEGATOR = /^(?:not|no|without|never|neither|nor|cannot|none)$|n't$/;
const CLAUSE_BREAK = /[,;:()[\]]|\b(?:and|but|while|whereas|although|though|yet|however)\b/gi;
function negatedBefore(text, index) {
  let pre = text.slice(Math.max(0, index - 200), index);
  const cuts = [...pre.matchAll(CLAUSE_BREAK)]; if (cuts.length) { const c = cuts.at(-1); pre = pre.slice(c.index + c[0].length); }
  const w = pre.toLowerCase().match(/[a-z']+/g) || [], last = w.slice(-5);
  let n = 0;
  last.forEach((t, i) => {
    const next = last[i + 1] || "";
    if (t === "no" && /^(?:more|less|fewer|worse|better|longer|later|sooner|doubt)$/.test(next)) return;
    if (t === "not" && /^(?:only|just|merely)$/.test(next)) return;
    if (NEGATOR.test(t) || (/^fail(?:s|ed)?$/.test(t) && next === "to")) n++;
  });
  return n % 2 === 1;
}
function frontierMatch(re, text) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) if (!negatedBefore(text, m.index)) return true;
  return false;
}

module.exports = { negatedBefore, frontierMatch };
