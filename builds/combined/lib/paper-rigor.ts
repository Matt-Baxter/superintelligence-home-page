import type { ClaimCheck, FormalProofSignal, PaperRigorSummary, SourceKind } from "./schemas";

// Deterministic Paper Evidence, Empirical Rigor, Claim-Backing, Hype/Goodhart Guard & Formal Proof Engine.
// Unifies the best of Build B's modules/review/review.js (REQ-032..037) and modules/verification/verification.js
// with Build A's anti-hype SCORING_GUIDE discipline — zero model calls, 100% reproducible, every point explained.

const LATEX_REWRITES: [RegExp, string][] = [
  [/\\%/g, "%"],
  [/\\times(?![A-Za-z])\s*/g, "× "],
  [/\\pm(?![A-Za-z])\s*/g, "± "],
  [/\\approx(?![A-Za-z])\s*/g, "≈ "],
  [/\\sim(?![A-Za-z])\s*/g, "~"],
  [/\$([\d.,\s%×±≈~<>=+\-−–]*\d[\d.,\s%×±≈~<>=+\-−–]*)\$/g, "$1"],
];

// Confusable Cyrillic/Greek homoglyphs folded 1-to-1 for anti-evasion matching (never mutates displayed text).
const CONFUSABLE_SRC = "аеорсухіјѕԁһԛԝАВЕКМНОРСТХУІЈЅαορνικτυχΑΒΕΖΗΙΚΜΝΟΡΤΥΧ";
const CONFUSABLE_DST = "aeopcyxijsdhqwABEKMHOPCTXYIJSaopvikTuxABEZHIKMNOPTYX";
const CONFUSABLE_MAP = Object.fromEntries([...CONFUSABLE_SRC].map((c, i) => [c, CONFUSABLE_DST[i]]));

export function canonicalizePaperText(raw: string): string {
  let prev = String(raw ?? "");
  let curr = applyCanonOnce(prev);
  for (let i = 0; i < 8 && curr !== prev; i++) {
    prev = curr;
    curr = applyCanonOnce(prev);
  }
  return curr;
}

function applyCanonOnce(x: string): string {
  let t = x.normalize("NFKC").replace(/\p{Cf}/gu, "");
  for (const [re, to] of LATEX_REWRITES) t = t.replace(re, to);
  return t.replace(/\s+/g, " ").trim();
}

function foldConfusables(x: string): string {
  return x.replace(/[\u0370-\u03ff\u0400-\u052f]/g, (c) => CONFUSABLE_MAP[c] || c);
}

const WORDS_RE = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
function tokenizeWords(s: string): string[] {
  return s.toLowerCase().match(WORDS_RE) ?? [];
}

const ABBREV_GUARD = /(?<!\b(?:et al|[Ee]\.g|[Ii]\.e|[Ff]igs?|[Aa]pprox|[Cc]f|[Vv]s|[Ee]qs?|[Ss]ecs?|[Tt]ab|[Rr]esp|[Cc]a)\.)/;
const SENTENCE_SPLIT_RE = new RegExp(`${ABBREV_GUARD.source}(?<=[.!?])\\s+(?=["'(\\[]?[A-Z0-9])`);

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Negation detector within the 5 preceding words in the same clause; double negation cancels.
const NEGATOR_WORD_RE = /^(?:not|no|without|never|neither|nor|cannot|none)$|n't$/;
const CLAUSE_BOUNDARY_RE = /[,;:()[\]]|\b(?:and|but|while|whereas|although|though|yet|however)\b/gi;

function isNegatedAt(text: string, index: number, phrase = "", from = 0): boolean {
  let pre = text.slice(from, index);
  const cuts = [...pre.matchAll(CLAUSE_BOUNDARY_RE)];
  if (cuts.length > 0) {
    const last = cuts[cuts.length - 1];
    pre = pre.slice((last.index ?? 0) + last[0].length);
  }
  const w = tokenizeWords(pre).slice(-5);
  const first = tokenizeWords(phrase)[0] ?? "";
  let negCount = 0;
  w.forEach((tok, idx) => {
    const next = idx + 1 < w.length ? w[idx + 1] : first;
    if (tok === "no" && /^(?:more|less|fewer|worse|better|longer|later|sooner|doubt)$/.test(next)) return;
    if (tok === "not" && /^(?:only|just|merely)$/.test(next) && !(idx === w.length - 1 && next === "only")) return;
    if (NEGATOR_WORD_RE.test(tok) || (/^fail(?:s|ed)?$/.test(tok) && next === "to")) negCount++;
  });
  return negCount % 2 === 1;
}

const NUM_WORDS =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine|hundred|thousand|million|billion))*";
const COUNT_EXPR = `(?:\\d[\\d,]*|${NUM_WORDS})(?: (?!(?:of|the|a|an|in|on|for|to|and|or|from|with)\\b)[a-z][a-z-]*){0,2}`;

type EvidenceMarkerDef = {
  id: string;
  label: string;
  points: number;
  re: RegExp;
  keepWhenNegated?: RegExp;
};

// 8-family empirical rigor rubric (sums to 100 pts; each family counted at most once to defeat repetition gaming).
const EMPIRICAL_MARKERS: EvidenceMarkerDef[] = [
  {
    id: "numbers",
    label: "Quantitative metrics reported",
    points: 10,
    re: new RegExp(
      `\\b(?:\\d+(?:\\.\\d+)?\\s?(?:%|x\\b|×|points?\\b|pp\\b|percent(?:age points?)?\\b|per cent\\b|hours?\\b)|pass@\\d+|${NUM_WORDS} (?:percent(?:age points?)?|per cent)\\b)`,
      "gi",
    ),
  },
  {
    id: "baseline",
    label: "Baseline or control comparison",
    points: 14,
    re: /\b(compared (?:to|with)|baselines?|versus|vs\.?|relative to|than (?:the |a )?(?:previous|prior|best|existing|strong|human|untrusted)|over the prior|match(?:es)? or exceed\w*|outperform\w* (?:the |a |an )?(?:previous|prior|best|existing|strong|earlier|original|output-only|unmonitored|baseline)|(?:beat(?:s|ing)?|improv(?:es|ed|ing)? (?:on|over|upon)) (?:the |a |an )?(?:previous|prior|best|existing|strong|earlier|original))\b/gi,
    keepWhenNegated: /^(?:beat|surpass|match|improv|than|over the prior)/i,
  },
  {
    id: "method",
    label: "Explicit methodology or ablations",
    points: 12,
    re: /\b((?:we|the authors) (?:train|trained|fine-tune|fine-tuned|evaluate|evaluated|measure|measured|test|tested|ablate|ablated|sample|sampled|collect|collected|present|propose|introduce|build|built|design|benchmark|decompose|extract)|(?:is|are|was|were) (?:then |first )?(?:trained|fine-tuned|evaluated|tested|measured|benchmarked|ablated)|(?:trained|fine-tuned|evaluated|tested|benchmarked) (?:on|against|across)|ablations?|experimental setup|dictionary learning|sparse autoencoder\w*)\b/gi,
  },
  {
    id: "sample",
    label: "Evaluation scale or sample size",
    points: 12,
    re: new RegExp(
      `\\b(n\\s?=\\s?\\d+|${COUNT_EXPR} (?:tasks|problems|samples|runs|seeds|participants|models|prompts|episodes|questions|papers|studies|benchmarks|environments|features|frontier models|language models))\\b`,
      "gi",
    ),
  },
  {
    id: "uncertainty",
    label: "Uncertainty, CIs or multi-seed stability",
    points: 14,
    re: new RegExp(
      `(confidence intervals?|\\bCIs?\\b|±|\\+\\/-|standard (?:error|deviation)|error bars?|\\bp\\s?[<=≤]\\s?0?\\.\\d+|\\b(?:across|over) (?:\\d+(?:\\s?[–-]\\s?\\d+)?|${NUM_WORDS}) (?:random |different |independent )?seeds)`,
      "gi",
    ),
  },
  {
    id: "held-out",
    label: "Held-out, OOD or contamination checks",
    points: 14,
    re: /\b(held[- ]out|out[- ]of[- ]distribution|\bOOD\b|unseen (?:OOD )?(?:tasks?|test|data|domains?)|private test|test split|contaminat\w*|leakage|zero-shot transfer|generaliz\w+ to unseen)\b/gi,
    keepWhenNegated: /^(?:contaminat|leakage)/i,
  },
  {
    id: "limitations",
    label: "Explicit limitations or failure modes",
    points: 14,
    re: /\b(limitations?|caveats?|fragile|we do not (?:claim|show)|does not (?:show|imply|eliminate|prevent)|fails? (?:on|to|when)|only (?:on|in|for|under)|may not generali[sz]e|remains? (?:open|unsolved|challenging)|persist\w* through safety training|struggle to control)\b/gi,
  },
  {
    id: "artifacts",
    label: "Open code, weights, dataset or eval suite",
    points: 10,
    re: /(github\.com|huggingface\.co|\b(?:code|weights|data(?:set)?|benchmark|eval(?:uation)? suite) (?:is|are) (?:available|released|open|public)|\bopen[- ](?:sourced?|weights?)\b|\b(?:release|publish|share)(?:s|d)? (?:our |the |all )?(?:source )?(?:code|weights|data(?:sets?)?|checkpoints|benchmark|tasks)\b)/gi,
  },
];

const SURVEY_COVERAGE_RUBRIC = [
  { id: "cov-count", label: "States corpus size covered", points: 35, re: /\b\d[\d,]* (?:papers|studies|works|articles|systems|benchmarks)\b/i },
  { id: "cov-taxonomy", label: "Organizes into taxonomy or formal safety classes", points: 25, re: /\b(taxonom\w+|classif\w+|categor\w+|framework|concrete problems|mesa-optimiz\w+|inner alignment|corrigib\w*|threat model\w*)\b/i },
  { id: "cov-compare", label: "Compares findings across works", points: 20, re: /\b(compar\w+|synthesi[sz]\w+|across (?:the )?(?:studies|papers|works|literature))\b/i },
  { id: "cov-gaps", label: "Identifies open problems or gaps", points: 20, re: /\b(open (?:questions|problems)|gaps?|remaining (?:questions|problems|challenges)|limitations?|future directions)\b/i },
];

const REPORTING_RUBRIC = [
  { id: "rep-cite", label: "Cites primary study, arXiv ID or evaluation", points: 30, re: /arxiv[: ]?\d{4}\.\d{4,5}|arxiv\.org\/(?:abs|pdf|html)\/|doi(?:\.org\/|:\s?10\.)|\b(?:study|paper|preprint|evaluation|report|system card|joint safety evaluation)\b/i },
  { id: "rep-nums", label: "Reports concrete figures or evaluation scale", points: 25, re: /\b\d+(?:\.\d+)?\s?(?:%|percent\b|points?\b|hours?\b)|\b(?:\d[\d,]*|two|three|four|five|six|seven|eight|nine|ten) (?:models|tasks|benchmarks|labs|evaluations|studies)\b/i },
  { id: "rep-caveats", label: "States caveats or what remains untested", points: 25, re: /\b(limitations?|caveats?|not yet|does not (?:show|prove|guarantee)|remains? (?:unclear|untested|open|fragile)|unlikely to)\b/i },
  { id: "rep-hedges", label: "Separates forecasts from established findings", points: 20, re: /\b(whether|may|might|could|uncertain|unclear|open question|plausible|forecast\w*|estimate\w*)\b/i },
];

// Rubric for theoretical alignment protocols (Debate, PSPACE, Corrigibility) and frontier compute/governance frameworks
const THEORY_GOVERNANCE_RUBRIC = [
  { id: "tg-formal", label: "Defines formal model, game/complexity class or compute threshold", points: 30, re: /\b(pspace|np-hard|polynomial|zero-sum|debate game|equilibrium|theorem|lemma|compute governance|training cluster\w*|flop\w*|threshold\w*)\b/i },
  { id: "tg-mechanism", label: "Specifies oversight, verification or enforcement mechanism", points: 30, re: /\b(scalable oversight|supervis\w+|verif\w+|audit\w*|monitoring|compliance|regulat\w*|executive order|safety framework|export control\w*)\b/i },
  { id: "tg-threat", label: "Addresses superhuman capability, deception or proliferation risk", points: 25, re: /\b(superhuman|decepti\w+|scheming|misalign\w+|loss of control|frontier ai|proliferation|catastrophic)\b/i },
  { id: "tg-limits", label: "Identifies assumptions, failure modes or implementation trade-offs", points: 15, re: /\b(assumption\w*|limitation\w*|trade-off\w*|privacy|fragile|open problem\w*|unless)\b/i },
];

const QUANTITATIVE_MARKER_IDS = new Set(["numbers", "sample", "uncertainty"]);

function evaluateSentenceMarkers(sentence: string): {
  found: EvidenceMarkerDef[];
  negated: { label: string; snippet: string }[];
} {
  const folded = foldConfusables(sentence);
  const found: EvidenceMarkerDef[] = [];
  const negated: { label: string; snippet: string }[] = [];

  const allHits = EMPIRICAL_MARKERS.map((m) => {
    const re = new RegExp(m.re.source, m.re.flags.includes("g") ? m.re.flags : `${m.re.flags}g`);
    return [...folded.matchAll(re)].map((h) => ({
      id: m.id,
      index: h.index ?? 0,
      end: (h.index ?? 0) + h[0].length,
      text: h[0],
    }));
  });
  const flatHits = allHits.flat();

  const clauseStartFor = (hit: { id: string; index: number }) => {
    const prev = flatHits
      .filter((o) => o.id !== hit.id && o.end <= hit.index)
      .sort((a, b) => b.end - a.end)[0];
    return prev && !/\b(?:or|nor)\b/i.test(folded.slice(prev.end, hit.index)) ? prev.end : 0;
  };

  EMPIRICAL_MARKERS.forEach((marker, idx) => {
    const hits = allHits[idx];
    if (hits.length === 0) return;
    const live = hits.filter(
      (h) => !isNegatedAt(folded, h.index, h.text, clauseStartFor(h)) || marker.keepWhenNegated?.test(h.text),
    );
    if (live.length > 0) {
      found.push(marker);
    } else {
      const first = hits[0];
      negated.push({
        label: marker.label,
        snippet: sentence.slice(Math.max(0, first.index - 24), Math.min(sentence.length, first.end + 16)).trim(),
      });
    }
  });

  return { found, negated };
}

// Goodhart defense: drop duplicate sentences and bare rigor-checklist sentences with no numbers
function cleanSentencesForRigor(sentences: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const s of sentences) {
    const norm = tokenizeWords(s).join(" ");
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    const { found } = evaluateSentenceMarkers(s);
    const wordCount = tokenizeWords(s).length;
    // Checklist sentence: >= 3 rigor buzzwords crammed into a tiny numberless list without concrete repo links
    if (found.length >= 3 && wordCount < Math.ceil(2.6 * found.length) && !/\d|github|huggingface/i.test(s)) {
      continue;
    }
    kept.push(s);
  }
  return kept;
}

// ---------- Claim Backing & Hype / Prompt-Injection Defense ----------
const CLAIM_RE =
  /\b(we (?:show|find|found|demonstrate|prove)|and (?:find|found|show|demonstrate|observe)\b|demonstrat\w+|achiev\w+|outperform\w*|surpass\w*|state[- ]of[- ]the[- ]art|\bsota\b|first (?:ai|model|system|time)|breakthrough|solv(?:es|ed)|superhuman|human[- ]level|will (?:soon|replace|surpass)|(?:superintelligen\w*|agi|recursive(?:ly)? self[- ]improv\w*) (?:is|are|has|have|will)\b|(?:reach|achiev|buil|creat)\w* (?:agi|superintelligen\w*))\b/gi;

const HEDGE_TOKEN_RE =
  /^(?:may|might|could|would|suggests?|suggested|suggesting|appears?|seems?|possibly|perhaps|potentially|likely|unlikely|plausibly|conceivably|if|whether|hypothesi[sz]e[sd]?|aims?|hopes?|towards?)$/;

const HYPE_WORDS_RE =
  /\b(revolutionary|unprecedented|game[- ]chang\w+|incredible|mind[- ]blowing|world[- ]changing|guaranteed|inevitabl\w+|imminent|everything chang(?:es|ing)|no one is talking about|holy grail|doomsday|utterly transformative|no longer sci-fi|kill us all|no longer (?:theoretical|hypothetical|speculation|science fiction))\b/gi;

const PROMPT_OVERRIDE_RE =
  /\b(?:(?:ignore|disregard|forget|override|bypass) (?:all |any |the |your )?(?:of )?(?:the |your )?(?:previous|prior|above|earlier|preceding|original) (?:instructions?|prompts?|rules|directions|guidelines)|you are (?:now )?(?:an? |the )?(?:ai |llm |language model )?(?:judge|grader|reviewer|evaluator|scorer)|(?:reveal|print|output|repeat) (?:your|the) system prompt)\b/i;

const SCORE_DEMAND_RE =
  /\b(?:(?:rate|score|grade) this (?:paper |article |post |story |work |submission )?(?:as |a |an )?\d+|give (?:this|it)(?: paper| article| post| story| work)? (?:a |an |the )?(?:perfect|high|top|maximum|max|highest|full|best) (?:score|rating|grade)|(?:give|assign|award) (?:this|it) (?:a |the )?(?:score|rating) of \d+)\b/i;

const DESCRIBES_ATTACK_RE =
  /\b(?:attacks?|injections?|jailbreaks?|prompts?|inputs?|payloads?|adversaries)\s+(?:that|which|telling|asking|instructing)\b|\b(?:we|this (?:paper|study|work)) (?:study|analyze|evaluate|detect|test|benchmark|defend)\b.*\b(?:prompt[- ]injections?|jailbreak\w*|adversarial (?:prompts?|instructions?))\b/i;

function detectPromptInjection(title: string, body: string): { fired: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const s of [...splitSentences(foldConfusables(title)), ...splitSentences(foldConfusables(body))]) {
    const demand = SCORE_DEMAND_RE.exec(s);
    if (demand) hits.push(demand[0]);
    const override = PROMPT_OVERRIDE_RE.exec(s);
    if (override && !DESCRIBES_ATTACK_RE.test(s)) {
      hits.push(override[0]);
    }
  }
  return { fired: hits.length > 0, hits };
}

function isHedgedAt(text: string, index: number): boolean {
  let pre = text.slice(0, index);
  const cuts = [...pre.matchAll(CLAUSE_BOUNDARY_RE)];
  if (cuts.length > 0) {
    const last = cuts[cuts.length - 1];
    pre = pre.slice((last.index ?? 0) + last[0].length);
  }
  return tokenizeWords(pre).slice(-6).some((t) => HEDGE_TOKEN_RE.test(t));
}

function hasLiveClaim(sentence: string): boolean {
  const f = foldConfusables(sentence);
  if (/\?["')\]]*\s*$/.test(f)) return false;
  const matches = [...f.matchAll(CLAIM_RE)];
  return matches.some((m) => !isNegatedAt(f, m.index ?? 0, m[0]) && !isHedgedAt(f, m.index ?? 0));
}

function extractClaimChecks(sentences: string[]): ClaimCheck[] {
  const out: ClaimCheck[] = [];
  sentences.forEach((s, i) => {
    if (!hasLiveClaim(s)) return;
    const ownMarkers = evaluateSentenceMarkers(s).found;
    const nearMarkers = [
      ...new Set(
        [s, sentences[i - 1], sentences[i + 1]]
          .filter(Boolean)
          .flatMap((x) => evaluateSentenceMarkers(x).found.map((m) => m.label)),
      ),
    ];
    const isBacked =
      ownMarkers.length >= 2 && ownMarkers.some((m) => QUANTITATIVE_MARKER_IDS.has(m.id));
    out.push({
      sentence: s.slice(0, 200),
      level: isBacked ? "backed" : nearMarkers.length > 0 ? "partly-backed" : "unbacked",
      markers: nearMarkers.slice(0, 4),
    });
  });
  return out;
}

// ---------- 4-Rung Formal / Machine-Checked Proof Signal (from verification.js) ----------
const FORMAL_DIRECT_RE =
  /(?<![\p{L}\p{N}])(lean ?4|lean (?:code|proofs?|formali[sz]ations?|kernel|library|prover|statements?|theorems?)|(?:in|into) lean|coq|rocq|isabelle(?:\/hol)?|agda|hol light|proof assistants?|machine[- ]checked|computer[- ]checked|computer[- ]verified|autoformali[sz]\w*|mathlib)(?![\p{L}\p{N}])/iu;

const FORMAL_CONTEXTUAL_RE = /(?<![\p{L}\p{N}])(formali[sz](?:ed|es|ing|ation|ations)|formal(?:ly)? verif\w*)(?![\p{L}\p{N}])/giu;
const FORMAL_MATH_CONTEXT_RE = /\b(theorems?|proofs?|lemmas?|conjectures?|mathematic\w*|maths?|lean|axioms?|olympiad)\b/i;

const FORMAL_REFERENCE_RE =
  /\b(comparator|matches? (?:mathlib|the library)'?s? (?:own )?statement|statement (?:was |is )?(?:checked|confirmed|matched)|independent (?:lean )?kernel|second (?:independent )?kernel|nanoda|lean4checker|standard axioms|no (?:sorry|sorries)|zero sorr(?:y|ies))\b/i;

const FORMAL_OUTSIDE_RE =
  /\b(independent(?:ly)? (?:team|researchers?|mathematicians?|check\w*|audit\w*|review\w*|verif\w*|rebuil\w*|reproduc\w*)|outside (?:team|researchers?|check\w*|experts?)|external(?:ly)? (?:audit\w*|check\w*|verif\w*|review\w*)|audit(?:ed|ing)? the (?:lean|formal)|third[- ]party (?:check|audit|verification))\b/i;

const FORMAL_FIDELITY_GAP_RE =
  /\b(weaker (?:than|statement|claim|result)s?|does not (?:correspond|match)|doesn'?t (?:correspond|match)|mistranslat\w*|not semantically faithful|fidelity gap|different (?:theorem|statement) than claimed|less strong)\b/i;

export function detectFormalProof(text: string): FormalProofSignal {
  const direct = text.match(FORMAL_DIRECT_RE)?.[0] ?? null;
  let contextual: string | null = null;
  if (!direct) {
    for (const m of text.matchAll(FORMAL_CONTEXTUAL_RE)) {
      const idx = m.index ?? 0;
      const win = text.slice(Math.max(0, idx - 80), idx + m[0].length + 80);
      if (FORMAL_MATH_CONTEXT_RE.test(win) || FORMAL_REFERENCE_RE.test(win)) {
        contextual = m[0];
        break;
      }
    }
  }
  const anchor = direct ?? contextual;
  if (!anchor) {
    return {
      rungId: "none",
      label: "No machine-checked proof claimed",
      points: 0,
      fidelityGap: false,
      matched: [],
    };
  }

  const matched = [anchor];
  const refMatch = text.match(FORMAL_REFERENCE_RE);
  if (refMatch) matched.push(refMatch[0]);
  const outMatch = text.match(FORMAL_OUTSIDE_RE);
  if (outMatch) matched.push(outMatch[0]);
  const gapMatch = text.match(FORMAL_FIDELITY_GAP_RE);
  if (gapMatch) matched.push(gapMatch[0]);
  const fidelityGap = Boolean(gapMatch);

  if (outMatch) {
    return {
      rungId: "outside-checked",
      label: fidelityGap
        ? "Externally audited formalization (audit flagged statement fidelity gap)"
        : "Independently audited machine-checked proof",
      points: 7,
      fidelityGap,
      matched,
    };
  }
  if (refMatch || fidelityGap) {
    return {
      rungId: "statement-checked",
      label: fidelityGap
        ? "Statement-checked formalization (reports prose-to-formal fidelity gap)"
        : "Formal statement verified against reference kernel/axioms",
      points: 5,
      fidelityGap,
      matched,
    };
  }
  return {
    rungId: "claimed",
    label: "Machine-checked / formal proof claimed",
    points: 3,
    fidelityGap: false,
    matched,
  };
}

// ---------- Paper / Artifact Kind Classification ----------
function classifyArtifactKind(
  title: string,
  body: string,
  url: string,
  sourceKinds: SourceKind[],
): { id: string; label: string; why: string; canShow: string; isSurvey: boolean; isReporting: boolean } {
  const full = `${title} ${body}`;
  const isPaperLike =
    sourceKinds.includes("papers") ||
    /arxiv\.org|doi\.org|\b(?:preprint|arxiv|we propose|we introduce|we train|we evaluate)\b/i.test(`${full} ${url}`);

  if (/(?::\s*an? (?:survey|review|overview)\b|^\s*an? (?:survey|review|overview) (?:of|on)\b|\bsurvey (?:of|on)\b|\b(?:systematic|literature) review\b|\bconcrete problems in ai safety\b|\brisks from learned optimization\b|\bcorrigibility\b)/i.test(title)) {
    return {
      id: "survey-review",
      label: "Survey / foundational agenda",
      why: "Title frames a field-wide synthesis, formal threat taxonomy or foundational safety agenda",
      canShow: "Scope of works synthesized, formal threat taxonomy, cross-paper comparisons and open research gaps",
      isSurvey: true,
      isReporting: false,
    };
  }
  if (/\b(?:dataset|benchmark|test suite|re-bench|mle-bench|paperbench|swe-bench|frontiermath|cybench)\b/i.test(title)) {
    return {
      id: "dataset-benchmark",
      label: "Evaluation benchmark / dataset",
      why: "Introduces or measures a structured capability or safety benchmark",
      canShow: "Task count, held-out contamination controls, baseline human/model scores and public task release",
      isSurvey: false,
      isReporting: false,
    };
  }
  if (/\b(?:does not|do not|fails? to|struggle to|no evidence|persist\w* through safety training|alignment faking|scheming|sleeper agents|covertly underperforming)\b/i.test(title)) {
    return {
      id: "safety-evaluation",
      label: "Empirical safety / failure-mode study",
      why: "Tests alignment robustness, deception, subversion or safety training limits",
      canShow: "Controlled red-team/subversion setup, persistence rates across models and mitigation limits",
      isSurvey: false,
      isReporting: !isPaperLike && (sourceKinds.includes("news") || sourceKinds.includes("newsletter")),
    };
  }
  if (/\b(?:executive order|eu ai act|regulation|legislation|treaty|governance of (?:superintelligence|artificial intelligence)|compute governance|responsible scaling|safety framework|preparedness framework)\b/i.test(full)) {
    return {
      id: "position-governance",
      label: "Governance framework / policy action",
      why: "Establishes compute thresholds, verification mechanisms, pre-deployment testing mandates or institutional commitments",
      canShow: "Binding scope, compute/capability triggers, enforcement mechanism and institutional authority",
      isSurvey: false,
      isReporting: false,
    };
  }
  if (/\b(?:ai safety via debate|pspace|zero-sum debate|iterated amplification|corrigib\w*)\b/i.test(full)) {
    return {
      id: "theory-protocol",
      label: "Theoretical alignment protocol",
      why: "Formalizes an oversight game, complexity-theoretic bound or mathematical alignment property",
      canShow: "Formal game/equilibrium assumptions, judge supervision mechanism and adversary failure modes",
      isSurvey: false,
      isReporting: false,
    };
  }
  if (/\b(?:introducing|announcing|system card|model card|releasing)\b/i.test(title) && sourceKinds.includes("frontier-lab")) {
    return {
      id: "frontier-release",
      label: "Frontier model / system card",
      why: "Primary frontier lab release or pre-deployment system card",
      canShow: "Evaluated benchmarks, dangerous-capability thresholds, safety mitigations and deployment controls",
      isSurvey: false,
      isReporting: false,
    };
  }
  if (isPaperLike) {
    return {
      id: "empirical-paper",
      label: "Primary research paper",
      why: "Technical research paper or preprint with methodological claims",
      canShow: "Quantitative improvements over baselines, sample scale, uncertainty/seeds, ablations and open artifacts",
      isSurvey: false,
      isReporting: false,
    };
  }
  return {
    id: "research-note",
    label: "Research synthesis / analysis",
    why: "Forum, research organization or curated synthesis post",
    canShow: "Cited primary studies, concrete figures, explicit caveats and clear separation of forecasts from data",
    isSurvey: false,
    isReporting: true,
  };
}

export function evaluatePaperRigor(opts: {
  title: string;
  summary?: string;
  url?: string;
  sourceKinds?: SourceKind[];
}): PaperRigorSummary {
  const canonTitle = canonicalizePaperText(opts.title || "").slice(0, 300);
  const canonBody = canonicalizePaperText(opts.summary || "").slice(0, 6000);
  const url = opts.url || "";
  const kinds: SourceKind[] = opts.sourceKinds?.length ? opts.sourceKinds : ["papers"];

  const rawSentences = [canonTitle, ...splitSentences(canonBody)].filter(Boolean);
  const cleanedSentences = cleanSentencesForRigor(rawSentences);
  const cleanedJoined = cleanedSentences.join(" ");

  const artifactKind = classifyArtifactKind(canonTitle, canonBody, url, kinds);

  // 1. Empirical marker pass across cleaned sentences
  const foundMap = new Map<string, { marker: EvidenceMarkerDef; snippet: string }>();
  const negatedMap = new Map<string, { label: string; snippet: string }>();

  for (const s of cleanedSentences) {
    const { found, negated } = evaluateSentenceMarkers(s);
    for (const m of found) {
      if (!foundMap.has(m.id)) {
        foundMap.set(m.id, { marker: m, snippet: s.slice(0, 140) });
      }
    }
    for (const neg of negated) {
      if (!negatedMap.has(neg.label)) {
        negatedMap.set(neg.label, neg);
      }
    }
  }

  let rubric: "empirical" | "survey" | "reporting" | "theory-governance" = "empirical";
  let presentMarkers = EMPIRICAL_MARKERS.filter((m) => foundMap.has(m.id)).map((m) => ({
    id: m.id,
    label: m.label,
    points: m.points,
    snippet: foundMap.get(m.id)!.snippet,
  }));
  let missingMarkers = EMPIRICAL_MARKERS.filter((m) => !foundMap.has(m.id)).map((m) => m.label);
  let rigorScore = presentMarkers.reduce((acc, m) => acc + m.points, 0);

  // 2. Survey rubric if survey/agenda scores higher on synthesis coverage
  if (artifactKind.isSurvey) {
    const covHits = SURVEY_COVERAGE_RUBRIC.filter((c) => c.re.test(cleanedJoined));
    const covScore = covHits.reduce((acc, c) => acc + c.points, 0);
    if (covScore >= rigorScore) {
      rubric = "survey";
      rigorScore = covScore;
      presentMarkers = covHits.map((c) => ({
        id: c.id,
        label: c.label,
        points: c.points,
        snippet: (cleanedSentences.find((s) => c.re.test(s)) || canonTitle).slice(0, 140),
      }));
      missingMarkers = SURVEY_COVERAGE_RUBRIC.filter((c) => !covHits.includes(c)).map((c) => c.label);
    }
  }

  // 2b. Theoretical alignment protocol & compute governance rubric when higher than lab-experiment markers
  if (artifactKind.id === "position-governance" || artifactKind.id === "theory-protocol") {
    const tgHits = THEORY_GOVERNANCE_RUBRIC.filter((c) => c.re.test(cleanedJoined));
    const tgScore = tgHits.reduce((acc, c) => acc + c.points, 0);
    if (tgScore > rigorScore) {
      rubric = "theory-governance";
      rigorScore = tgScore;
      presentMarkers = tgHits.map((c) => ({
        id: c.id,
        label: c.label,
        points: c.points,
        snippet: (cleanedSentences.find((s) => c.re.test(s)) || canonTitle).slice(0, 140),
      }));
      missingMarkers = THEORY_GOVERNANCE_RUBRIC.filter((c) => !tgHits.includes(c)).map((c) => c.label);
    }
  }

  // 3. Careful reporting rubric for forum/newsletter/news synthesis when higher than raw lab-experiment markers
  if (artifactKind.isReporting) {
    const citesStudy = REPORTING_RUBRIC[0].re.test(`${cleanedJoined} ${url}`);
    const repHits = REPORTING_RUBRIC.filter((c, i) => c.re.test(`${cleanedJoined} ${url}`) && (i !== 1 || citesStudy));
    const repScore = repHits.reduce((acc, c) => acc + c.points, 0);
    if (repScore > rigorScore) {
      rubric = "reporting";
      rigorScore = repScore;
      presentMarkers = repHits.map((c) => ({
        id: c.id,
        label: c.label,
        points: c.points,
        snippet: (cleanedSentences.find((s) => c.re.test(s)) || canonTitle).slice(0, 140),
      }));
      missingMarkers = REPORTING_RUBRIC.filter((c) => !repHits.includes(c)).map((c) => c.label);
    }
  }

  // Filter out negated entries if another sentence positively satisfied that same label
  const presentLabels = new Set(presentMarkers.map((m) => m.label));
  const negatedMarkers = [...negatedMap.values()].filter((n) => !presentLabels.has(n.label));

  // 4. Claim backing & hype / prompt-injection checks
  const claimItems = extractClaimChecks(cleanedSentences);
  const backed = claimItems.filter((c) => c.level === "backed").length;
  const partlyBacked = claimItems.filter((c) => c.level === "partly-backed").length;
  const unbacked = claimItems.filter((c) => c.level === "unbacked").length;

  const hypeWordsSet = new Set<string>();
  for (const s of cleanedSentences) {
    for (const h of s.matchAll(HYPE_WORDS_RE)) {
      if (!isNegatedAt(s, h.index ?? 0, h[0])) {
        hypeWordsSet.add(h[0].toLowerCase());
      }
    }
  }
  const hypeWords = [...hypeWordsSet];
  const promptInjection = detectPromptInjection(canonTitle, canonBody);

  const totalClaims = claimItems.length;
  const unbackedRatio = totalClaims > 0 && !artifactKind.isSurvey ? unbacked / totalClaims : 0;
  const rawHype = Math.round(unbackedRatio * 55 + Math.min(45, hypeWords.length * 15) + (promptInjection.fired ? 50 : 0));
  const hypeScore = Math.max(0, Math.min(100, rawHype));

  // 5. Formal / Machine-Checked Proof Ladder
  const formalProof = detectFormalProof(`${canonTitle}\n${canonBody}`);

  const credibilityBand: PaperRigorSummary["credibilityBand"] =
    promptInjection.fired || hypeScore >= 60
      ? "hype-flagged"
      : rigorScore >= 50 || (rigorScore >= 36 && backed >= 1) || formalProof.points >= 5
        ? "high"
        : rigorScore >= 22
          ? "moderate"
          : "preliminary";

  return {
    rigorScore: Math.max(0, Math.min(100, rigorScore)),
    hypeScore,
    credibilityBand,
    paperKind: {
      id: artifactKind.id,
      label: artifactKind.label,
      why: artifactKind.why,
      canShow: artifactKind.canShow,
    },
    rubric,
    presentMarkers,
    missingMarkers,
    negatedMarkers,
    claims: {
      backed,
      partlyBacked,
      unbacked,
      items: claimItems.slice(0, 6),
    },
    hypeWords,
    promptInjection,
    formalProof,
  };
}
