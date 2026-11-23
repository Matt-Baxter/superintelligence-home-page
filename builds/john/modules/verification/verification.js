// Machine-checked claims: how far a story's formal-proof claim has actually been checked, and by whom.
// Deterministic and headless (no model calls, no database). Used as an "analysis.signals" contribution, so every point
// shows up as a `why` line on the story page. Patterns live in rules.json (tuned by scripts/verification-ratchet.js).
//
// The lesson behind the ladder (autumn 2026): "it compiles in Lean" proves the formal statement, not the prose claim.
// A formalization can be fully checked and still prove something weaker than the paper says. So the rungs separate
//   1. a formal proof is claimed (Lean, Coq, Isabelle, a proof assistant, "machine-checked"),
//   2. the formal statement was checked against a reference statement (a comparator, a library's own statement,
//      a second independent kernel),
//   3. someone outside the authors checked it (an independent team, an audit, a rebuild),
// and flag a fidelity gap when a check found the formal statement weaker than, or different from, the claim.
// A gap never adds credit to the original claim; the points go to the check, which is the news.
// Same principle as the judge-fidelity work (specs/003, proposed): check the translation separately from the source.
const RULES = require("./rules.json");

const RUNGS = [
  { id: "none", label: "No formal proof claimed", points: 0 },
  { id: "claimed", label: "Formal proof claimed", points: 3 },
  { id: "statement-checked", label: "Formal statement checked against a reference", points: 5 },
  { id: "outside-checked", label: "Checked outside the authors", points: 7 },
];

const any = (list) => (list && list.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${list.join("|")})(?![\\p{L}\\p{N}])`, "iu") : null);
function compile(rules = RULES) {
  return { formal: any(rules.formal), contextual: any(rules.contextual), context: any(rules.context), window: rules.context_window ?? 80,
    reference: any(rules.reference), outside: any(rules.outside), gap: any(rules.gap), options: { gap_counts_as_reference: true, ...(rules.options || {}) } };
}
const DEFAULT = compile();

// A contextual term ("formalized") counts only with a maths word, or a proof-checking phrase, nearby.
function contextualHit(t, R) {
  if (!R.contextual) return null;
  const g = new RegExp(R.contextual.source, "giu");
  for (const m of t.matchAll(g)) {
    const near = t.slice(Math.max(0, m.index - R.window), m.index + m[0].length + R.window);
    if ((R.context && R.context.test(near)) || (R.reference && R.reference.test(near))) return m[0];
  }
  return null;
}

function check(text = "", R = DEFAULT) {
  const t = String(text).replace(/\s+/g, " ");
  const f = (R.formal && (t.match(R.formal) || [])[0]) || contextualHit(t, R);
  if (!f) return { rung: RUNGS[0], gap: false, found: [] };
  const found = [f], hit = (re) => { const m = re && t.match(re); if (m) found.push(m[0]); return !!m; };
  const ref = hit(R.reference), out = hit(R.outside), gap = hit(R.gap);
  // An outside check (an audit) is the highest rung. A reported gap means someone compared the formal statement with
  // the claim, so by default it counts as at least a statement check.
  const rung = out ? RUNGS[3] : ref || (gap && R.options.gap_counts_as_reference) ? RUNGS[2] : RUNGS[1];
  return { rung, gap, found };
}

// The analysis.signals contribution. max 7 keeps it below the evidence ladder's spread (2 to 15), so it refines a
// story's rank without overruling where it came from.
const signal = {
  factor: "Machine-checked",
  max: 7,
  score({ text }) {
    const r = check(text);
    if (!r.rung.points) return null;
    const words = `(matched: ${r.found.map((w) => `"${w}"`).join(", ")})`;
    if (r.gap) return { points: r.rung.points, detail: `${r.rung.label}; it reports the formal statement is weaker than or different from the claim, so the claim itself is not established ${words}` };
    return { points: r.rung.points, detail: `${r.rung.label} ${words}` };
  },
};

module.exports = { check, compile, signal, RUNGS, RULES };
