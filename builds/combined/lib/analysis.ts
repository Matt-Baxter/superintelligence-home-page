import { ONTOLOGY_BENCHMARKS, ONTOLOGY_PEOPLE } from "./ontology-data";
import { compileTermRegex, tagText, type MatchedTopic } from "./ontology";
import { evaluatePaperRigor } from "./paper-rigor";
import type { BenchmarkHit, EntityHit, PaperRigorSummary, SourceKind, WhyFactor } from "./schemas";

// Deterministic 0–100 Significance & Evidence Engine (REQ-C02).
// Unifies Build B's evidence ladder, benchmark score extractor, 8-family empirical rigor markers,
// 4-rung formal verification ladder, and Goodhart hype/injection defenses with Build A's anti-hype discipline.
// Pruned: researcher name-dropping no longer adds significance points (catalogued as entity metadata only).

export type AnalysisResult = {
  significanceScore: number;
  rigorScore: number;
  hypeScore: number;
  paperRigor: PaperRigorSummary;
  updateType: { id: string; label: string };
  evidenceLevel: { id: string; label: string };
  why: WhyFactor[];
  benchmarks: BenchmarkHit[];
  people: EntityHit[];
};

const EVIDENCE_LADDER: { id: string; label: string; points: number; kinds: SourceKind[] }[] = [
  { id: "independent-eval", label: "Independent safety or forecasting group", points: 14, kinds: ["safety-group", "research-org"] },
  { id: "frontier-lab", label: "Frontier AI lab primary research", points: 13, kinds: ["frontier-lab"] },
  { id: "preprint", label: "Research paper / preprint", points: 11, kinds: ["papers"] },
  { id: "forum", label: "Research forum analysis", points: 8, kinds: ["forum"] },
  { id: "newsletter", label: "Curated research synthesis", points: 8, kinds: ["newsletter"] },
  { id: "news", label: "External reporting", points: 6, kinds: ["news"] },
];

const PEER_REVIEWED_VENUE_RE =
  /\b(?:accepted (?:at|to)|published in|proceedings of)\s+(?:(?:the|a)\s+)?(?:neurips|icml|iclr|aaai|ijcai|acl|emnlp|cvpr|nature|science|facc?t)\b/i;
const UNACCEPTED_RE = /\b(?:not\s+accepted|rejected|under\s+review|submitted\s+to)\b/i;

const UPDATE_TYPES: { id: string; label: string; points: number; re?: RegExp; rootTopic?: string; titleOnly?: boolean }[] = [
  {
    id: "safety-finding",
    label: "Empirical safety / alignment finding",
    points: 14,
    re: /\b(scheming|deceptive\s+alignment|sandbagg\w*|reward\s+hacking|alignment\s+faking|power[- ]seeking|sabotage|scalable\s+oversight|loss\s+of\s+control|situational\s+awareness|deliberative\s+alignment|sleeper\s+agents?|mesa-optimiz\w*|weak-to-strong|ai\s+control|corrigib\w*)\b/i,
  },
  {
    id: "frontier-release",
    label: "Frontier model or system release",
    points: 13,
    re: /\b(introducing|announcing|releasing|system\s+card|model\s+card|frontier\s+model|open[- ]weights?)\b/i,
    titleOnly: true,
  },
  {
    id: "breakthrough-result",
    label: "State-of-the-art / frontier result",
    points: 12,
    re: /\b(state[- ]of[- ]the[- ]art|sota|outperform\w*|surpass\w*|superhuman|human[- ]level|imo\s+gold|monosemantic\w*|compute-optimal)\b/i,
  },
  {
    id: "evaluation",
    label: "Capability or safety evaluation",
    points: 11,
    re: /\b(evaluat\w+|benchmark\w*|red[- ]team\w*|safety\s+case|uplift\s+study|control\s+evaluation|monitorability)\b/i,
  },
  {
    id: "governance",
    label: "Frontier AI governance action",
    points: 10,
    rootTopic: "governance-policy",
  },
  {
    id: "forecast",
    label: "Timeline or compute forecast",
    points: 10,
    re: /\b(forecast\w*|agi\s+timelines?|transformative\s+ai|scaling\s+laws?|ai\s+2027|takeoff)\b/i,
  },
];

const FRONTIER_CLAIMS: [RegExp, string][] = [
  [/\b(superintelligen\w*|artificial\s+general\s+intelligence|\bagi\b|\basi\b)\b/i, "Direct AGI / superintelligence focus"],
  [/\b(recursive\s+self[- ]improvement|intelligence\s+explosion|automated\s+ai\s+research|ai\s+scientist\w*|ai\s+r&d)\b/i, "Recursive self-improvement / automated AI R&D"],
  [/\b(deceptive\s+alignment|alignment\s+faking|scheming|sleeper\s+agents?|mesa-optimiz\w*|loss\s+of\s+control|existential\s+risk\w*|x-risk|catastrophic\s+risk\w*)\b/i, "Catastrophic / deceptive-alignment risk signal"],
  [/\b(mechanistic\s+interpretability|sparse\s+autoencoder\w*|monosemantic\w*|dictionary\s+learning|chain[- ]of[- ]thought\s+monitor\w*|monitorability)\b/i, "Mechanistic interpretability / CoT monitorability"],
  [/\b(scalable\s+oversight|ai\s+safety\s+via\s+debate|iterated\s+amplification|weak-to-strong\s+generalization|constitutional\s+ai|ai\s+control|corrigib\w*)\b/i, "Alignment & scalable oversight mechanism"],
  [/\b(compute\s+governance|frontier\s+ai\s+regulation|executive\s+order|eu\s+ai\s+act|responsible\s+scaling\s+polic\w*|governance\s+of\s+superintelligence)\b/i, "Institutional frontier AI governance"],
];

const COMPILED_BENCH = ONTOLOGY_BENCHMARKS.map((b) => ({
  ...b,
  res: b.terms.map((t) => new RegExp(compileTermRegex(t).source, "giu")),
}));

const COMPILED_PEOPLE = ONTOLOGY_PEOPLE.map((p) => ({
  ...p,
  res: p.terms.map((t) => compileTermRegex(t)),
}));

function extractNearbyScore(
  text: string,
  idx: number,
  len: number,
  unit?: "percent" | "time",
): { value: number; unit: "%" | "hours"; raw: string } | null {
  const start = Math.max(0, idx - 70);
  const win = text.slice(start, idx + len + 70);
  const rel = idx - start;

  if (unit === "time") {
    const matches = [...win.matchAll(/(\d+(?:\.\d+)?)\s*-?\s*(hours?|hrs?|minutes?|mins?|days?)\b/gi)];
    if (matches.length === 0) return null;
    const best = matches.sort((a, b) => Math.abs((a.index ?? 0) - rel) - Math.abs((b.index ?? 0) - rel))[0];
    const n = Number(best[1]);
    const u = best[2].toLowerCase();
    const hours = u.startsWith("min") ? n / 60 : u.startsWith("day") ? n * 24 : n;
    return { value: Number(hours.toFixed(2)), unit: "hours", raw: best[0] };
  }

  const matches = [...win.matchAll(/(\d{1,3}(?:\.\d+)?)\s?(%|percent\b)/gi)].filter((m) => Number(m[1]) <= 100);
  if (matches.length === 0) return null;
  const best = matches.sort((a, b) => Math.abs((a.index ?? 0) - rel) - Math.abs((b.index ?? 0) - rel))[0];
  return { value: Number(best[1]), unit: "%", raw: best[0] };
}

export function detectBenchmarks(text: string): BenchmarkHit[] {
  const out: BenchmarkHit[] = [];
  for (const b of COMPILED_BENCH) {
    const hits = b.res.flatMap((r) => [...text.matchAll(r)]).sort((a, c) => (a.index ?? 0) - (c.index ?? 0));
    if (hits.length === 0) continue;
    if (b.generic && out.some((existing) => existing.id.startsWith(b.id))) continue;
    const withScore = hits
      .map((m) => ({ m, score: extractNearbyScore(text, m.index ?? 0, m[0].length, b.unit) }))
      .find((x) => x.score !== null);
    out.push({
      id: b.id,
      label: b.label,
      measures: b.measures,
      matched: (withScore?.m ?? hits[0])[0],
      score: withScore?.score ?? null,
    });
  }
  return out;
}

export function detectPeople(text: string): EntityHit[] {
  return COMPILED_PEOPLE.filter((p) => p.res.some((r) => r.test(text))).map((p) => ({
    id: p.id,
    label: p.label,
  }));
}

export function analyzeStory(opts: {
  title: string;
  summary?: string;
  authors?: string;
  url?: string;
  topics?: MatchedTopic[];
  sourceKinds?: SourceKind[];
  sourceCount?: number;
}): AnalysisResult {
  const title = opts.title || "";
  const summary = opts.summary || "";
  const text = `${title}\n${summary}`.slice(0, 6000);
  const fullWithAuthors = `${text}\n${opts.authors || ""}`;
  const kinds: SourceKind[] = opts.sourceKinds?.length ? opts.sourceKinds : ["papers"];
  const topics = opts.topics ?? tagText(title, summary).topics;
  const rootIds = new Set(topics.filter((t) => t.isRoot).map((t) => t.id));

  const why: WhyFactor[] = [];
  const add = (points: number, factor: string, detail: string) => {
    const rounded = Math.round(points);
    if (rounded !== 0) why.push({ factor, points: rounded, detail });
  };

  // 1. Evidence quality (up to 16 pts)
  let evidence =
    EVIDENCE_LADDER.find((e) => kinds.some((k) => e.kinds.includes(k))) ??
    { id: "news", label: "Public source", points: 6, kinds: ["news" as SourceKind] };
  if (evidence.id === "preprint" && PEER_REVIEWED_VENUE_RE.test(text) && !UNACCEPTED_RE.test(text)) {
    evidence = { id: "peer-reviewed", label: "Peer-reviewed conference/journal paper", points: 16, kinds: ["papers"] };
  }
  add(evidence.points, "Evidence tier", evidence.label);

  // 2. Cross-source independent corroboration (up to 21 pts)
  const nSources = Math.max(1, Math.trunc(opts.sourceCount ?? 1));
  if (nSources > 1) {
    add(Math.min(21, (nSources - 1) * 7), "Cross-source coverage", `Corroborated across ${nSources} independent sources`);
  }

  // 3. Kind of update (up to 14 pts)
  const matchedType =
    UPDATE_TYPES.find((u) => (u.rootTopic ? rootIds.has(u.rootTopic) : u.re ? u.re.test(u.titleOnly ? title : text) : false)) ??
    {
      id: kinds.includes("papers") ? "research-paper" : "research-post",
      label: kinds.includes("papers") ? "Technical research paper" : "Research analysis",
      points: 7,
    };
  add(matchedType.points, "Update type", matchedType.label);

  // 4. Frontier claims & alignment/risk mechanisms (up to 24 pts)
  const claims = FRONTIER_CLAIMS.filter(([re]) => re.test(text)).map(([, label]) => label);
  if (claims.length > 0) {
    add(Math.min(24, claims.length * 8), "Frontier signals", claims.join("; "));
  }

  // 5. Empirical rigor & claim backing (up to 14 pts; from 8-marker negation-aware paper rigor engine)
  const paperRigor = evaluatePaperRigor({
    title,
    summary,
    url: opts.url,
    sourceKinds: kinds,
  });

  if (paperRigor.rigorScore > 0) {
    const rigorPts = Math.min(
      14,
      Math.round((paperRigor.rigorScore / 100) * 12) + (paperRigor.claims.backed > 0 ? 2 : 0),
    );
    if (rigorPts > 0) {
      const markerLabels = paperRigor.presentMarkers.slice(0, 3).map((m) => m.label).join("; ");
      add(
        rigorPts,
        "Empirical rigor",
        `${paperRigor.rigorScore}/100 (${paperRigor.paperKind.label}): ${markerLabels}`,
      );
    }
  }

  // 6. Formal / machine-checked proof signal (up to 7 pts; from 4-rung verification ladder)
  if (paperRigor.formalProof.points > 0) {
    add(
      paperRigor.formalProof.points,
      "Machine-checked proof",
      `${paperRigor.formalProof.label} (matched: ${paperRigor.formalProof.matched.join(", ")})`,
    );
  }

  // 7. Benchmarks & empirical numbers (up to 12 pts)
  const benchmarks = detectBenchmarks(text);
  if (benchmarks.length > 0) {
    const scoredCount = benchmarks.filter((b) => b.score !== null).length;
    const pts = Math.min(12, 5 + scoredCount * 4 + (benchmarks.length - 1) * 2);
    add(
      pts,
      "Benchmarks",
      benchmarks.map((b) => (b.score ? `${b.label} (${b.score.raw})` : b.label)).join(", "),
    );
  }

  // 8. Multi-domain breadth across canonical SI topics (up to 12 pts)
  if (rootIds.size > 0) {
    const rootLabels = topics.filter((t) => t.isRoot).map((t) => t.label);
    add(Math.min(12, rootIds.size * 4), "Superintelligence domains", rootLabels.join(", "));
  }

  // 9. Hype / unbacked-claim & prompt-injection Goodhart discount (-2 to -35 pts)
  if (paperRigor.promptInjection.fired) {
    add(
      -35,
      "Prompt-injection guard",
      `Adversarial score/instruction override detected (${paperRigor.promptInjection.hits[0]}); score capped.`,
    );
  } else if (paperRigor.hypeScore >= 30) {
    const penalty = -Math.min(12, Math.max(2, Math.round((paperRigor.hypeScore - 20) / 6)));
    const detailParts: string[] = [];
    if (paperRigor.claims.unbacked > 0) {
      detailParts.push(`${paperRigor.claims.unbacked} unbacked claim${paperRigor.claims.unbacked === 1 ? "" : "s"}`);
    }
    if (paperRigor.hypeWords.length > 0) {
      detailParts.push(`hype wording (${paperRigor.hypeWords.slice(0, 3).join(", ")})`);
    }
    add(penalty, "Hype / unbacked-claim discount", detailParts.join(" + ") || "Sweeping assertions without quantitative support");
  }

  // Catalogued for entity provenance only (0 pts — prevents name-dropping inflation per Build A SCORING_GUIDE & Build B review.js)
  const people = detectPeople(fullWithAuthors);

  const rawTotal = why.reduce((acc, w) => acc + w.points, 0);
  const cappedMax = paperRigor.promptInjection.fired ? 25 : 100;
  const significanceScore = Math.max(0, Math.min(cappedMax, rawTotal));

  return {
    significanceScore,
    rigorScore: paperRigor.rigorScore,
    hypeScore: paperRigor.hypeScore,
    paperRigor,
    updateType: { id: matchedType.id, label: matchedType.label },
    evidenceLevel: { id: evidence.id, label: evidence.label },
    why,
    benchmarks,
    people,
  };
}

// Calibrated conversion from deterministic significance (0–100), empirical rigor (0–100), and hype (0–100)
// into a 1.0–10.0 score so deterministic mode, Tier-0 settlement, and client-side interactive figures share one pure formula.
export function deterministicScoreFromSignals(opts: {
  significanceScore: number;
  rigorScore: number;
  hypeScore: number;
  inScope: boolean;
  promptInjection?: boolean;
}): number {
  if (opts.promptInjection) return 1.0;
  if (!opts.inScope) return 2.4;

  const sigPart = 6.5 + (opts.significanceScore / 100) * 3.2;
  const rigorBonus = (opts.rigorScore / 100) * 0.55;
  const hypeDiscount = opts.hypeScore >= 30 ? ((opts.hypeScore - 20) / 100) * 1.1 : 0;
  const raw = sigPart + rigorBonus - hypeDiscount;
  return Math.min(9.9, Math.max(4.5, Math.round(raw * 10) / 10));
}

// Calibrated 0–100 composite Best-Story score combining judge rating, significance, empirical rigor,
// multi-source corroboration, and hype discount without penalizing historical era.
export function computeBestStoryScore(opts: {
  aiScore: number | null;
  significanceScore: number;
  rigorScore: number;
  hypeScore: number;
  sourceCount: number;
}): number {
  const judge = opts.aiScore ?? 7.8;
  const judgePts = Math.max(0, Math.min(44, ((judge - 4.0) / 6.0) * 44));
  const sigPts = (opts.significanceScore / 100) * 32;
  const rigorPts = (opts.rigorScore / 100) * 14;
  const corrPts = Math.min(10, Math.max(0, opts.sourceCount - 1) * 4);
  const hypePen = opts.hypeScore >= 30 ? ((opts.hypeScore - 25) / 75) * 18 : 0;
  return Math.max(0, Math.min(100, Math.round(judgePts + sigPts + rigorPts + corrPts - hypePen)));
}
