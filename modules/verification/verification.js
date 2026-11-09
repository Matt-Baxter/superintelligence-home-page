// Machine-checked claims: how far a story's formal-proof claim has actually been checked, and by whom.
// Deterministic and headless (no model calls, no database). Used as an "analysis.signals" contribution, so every point
// shows up as a `why` line on the story page.
//
// The lesson behind the ladder (autumn 2026): "it compiles in Lean" proves the formal statement, not the prose claim.
// A formalization can be fully checked and still prove something weaker than the paper says. So the rungs separate
//   1. a formal proof is claimed (Lean, Coq, Isabelle, a proof assistant, "machine-checked"),
//   2. the formal statement was checked against a reference statement (a comparator, a library's own statement,
//      a second independent kernel),
//   3. someone outside the authors checked it (an independent team, an audit, a rebuild),
// and flag a fidelity gap when an outside check found the formal statement weaker than, or different from, the claim.
// A gap never adds credit to the original claim; the points go to the outside check, which is the news.

const FORMAL = /\b(lean ?4|lean (code|proofs?|formali[sz]ations?|kernel|library|prover)|(in|into) lean|coq|rocq|isabelle(\/hol)?|agda|hol light|proof assistant|machine[- ]checked|computer[- ]checked|computer[- ]verified|formally verified|formal(ly)? verif\w*|formali[sz](ed|es|ing|ation)|autoformali[sz]\w*|mathlib)\b/i;
const REFERENCE = /\b(comparator|matches? (mathlib|the library)'?s? (own )?statement|statement (was |is )?(checked|confirmed|matched)|independent (lean )?kernel|second (independent )?kernel|nanoda|lean4checker|standard axioms|no (sorry|sorries)|zero sorr(y|ies))\b/i;
const OUTSIDE = /\b(independent(ly)? (team|researchers?|mathematicians?|check\w*|audit\w*|review\w*|verif\w*|rebuil\w*|reproduc\w*)|outside (team|researchers?|check\w*|experts?)|external(ly)? (audit\w*|check\w*|verif\w*|review\w*)|audit(ed|ing)? the (lean|formal)|third[- ]party (check|audit|verification))\b/i;
const GAP = /\b(weaker (than|statement|claim)|does not (correspond|match)|doesn'?t (correspond|match)|mistranslat\w*|mismatch\w*|not semantically faithful|fidelity gap|different (theorem|statement) than claimed)\b/i;

const RUNGS = [
  { id: "none", label: "No formal proof claimed", points: 0 },
  { id: "claimed", label: "Formal proof claimed", points: 3 },
  { id: "statement-checked", label: "Formal statement checked against a reference", points: 5 },
  { id: "outside-checked", label: "Checked outside the authors", points: 7 },
];

function check(text = "") {
  const t = String(text);
  if (!FORMAL.test(t)) return { rung: RUNGS[0], gap: false, found: [] };
  const found = [t.match(FORMAL)[0]];
  const ref = t.match(REFERENCE), out = t.match(OUTSIDE), gap = t.match(GAP);
  if (ref) found.push(ref[0]);
  if (out) found.push(out[0]);
  if (gap) found.push(gap[0]);
  // An outside check (an audit) is the highest rung. A reported gap means someone compared the formal statement with
  // the claim, so it counts as at least a statement check.
  const rung = out ? RUNGS[3] : ref || gap ? RUNGS[2] : RUNGS[1];
  return { rung, gap: !!gap, found };
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

module.exports = { check, signal, RUNGS };
