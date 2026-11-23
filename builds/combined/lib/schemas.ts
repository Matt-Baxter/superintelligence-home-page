import { z } from "zod";

// Ontology, Paper Rigor, SIM Outer-Loop & URL-state Zod schemas (REQ-003, REQ-005, REQ-017, REQ-C01..REQ-C10).

export const ROOT_TOPIC_IDS = [
  "capabilities-agi",
  "automating-ai-research",
  "recursive-self-improvement",
  "alignment",
  "interpretability",
  "safety-risk",
  "forecasting-timelines",
  "compute-scaling",
  "governance-policy",
] as const;

export type RootTopicId = (typeof ROOT_TOPIC_IDS)[number];

export const RootTopicIdSchema = z.enum(ROOT_TOPIC_IDS);

export const SOURCE_KINDS = [
  "papers",
  "frontier-lab",
  "safety-group",
  "research-org",
  "forum",
  "newsletter",
  "news",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];
export const SourceKindSchema = z.enum(SOURCE_KINDS);

export const SORT_MODES = ["best", "newest", "significance", "rigor", "sources", "votes"] as const;
export type SortMode = (typeof SORT_MODES)[number];
export const SortModeSchema = z.enum(SORT_MODES);

export const TIME_WINDOWS = [
  "all",
  "7d",
  "30d",
  "365d",
  "2026",
  "2024-2025",
  "2022-2023",
  "pre-2022",
] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];
export const TimeWindowSchema = z.enum(TIME_WINDOWS);

export const CURATION_MODES = ["all", "high-signal", "daily-top"] as const;
export type CurationMode = (typeof CURATION_MODES)[number];
export const CurationModeSchema = z.enum(CURATION_MODES);

export const EVIDENCE_FILTERS = [
  "all",
  "empirical",
  "safety-eval",
  "multi-source",
  "formal",
] as const;
export type EvidenceFilter = (typeof EVIDENCE_FILTERS)[number];
export const EvidenceFilterSchema = z.enum(EVIDENCE_FILTERS);

export const FeedQuerySchema = z.object({
  topic: z.string().trim().max(64).catch(""),
  q: z.string().trim().max(120).catch(""),
  sort: SortModeSchema.catch("newest"),
  window: TimeWindowSchema.catch("all"),
  curation: CurationModeSchema.catch("all"),
  evidence: EvidenceFilterSchema.catch("all"),
  preset: z.string().trim().max(40).catch(""),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type FeedQuery = z.infer<typeof FeedQuerySchema>;

export type FeedPreset = {
  id: string;
  label: string;
  description: string;
  query: Partial<FeedQuery>;
};

export const FEED_PRESETS: FeedPreset[] = [
  {
    id: "all-si",
    label: "All Superintelligence",
    description: "Newest verified superintelligence developments across all 9 canonical topics (2015–present)",
    query: { topic: "", q: "", sort: "newest", window: "all", curation: "all", evidence: "all" },
  },
  {
    id: "best-stories",
    label: "Best Stories",
    description: "Highest calibrated composite of judge rating, deterministic significance, empirical rigor & corroboration",
    query: { topic: "", q: "", sort: "best", window: "all", curation: "high-signal", evidence: "all" },
  },
  {
    id: "alignment-safety",
    label: "Alignment & Control",
    description: "Disambiguated AI alignment, scalable oversight, scheming, corrigibility & AI control",
    query: { topic: "alignment", q: "", sort: "best", window: "all", curation: "all", evidence: "all" },
  },
  {
    id: "empirical-papers",
    label: "High-Rigor Papers",
    description: "Papers with backed quantitative claims, baselines, sample sizes, uncertainty or open artifacts",
    query: { topic: "", q: "", sort: "rigor", window: "all", curation: "all", evidence: "empirical" },
  },
  {
    id: "foundational-canon",
    label: "Foundational Canon (pre-2022)",
    description: "Landmark early papers on concrete safety, debate, mesa-optimization, scaling laws & RLHF (2015–2021)",
    query: { topic: "", q: "", sort: "best", window: "pre-2022", curation: "all", evidence: "all" },
  },
  {
    id: "frontier-landmarks",
    label: "Daily Top 5 (8.0+)",
    description: "Calibrated 8.0+/10 significance threshold capped at top 5 developments per day",
    query: { topic: "", q: "", sort: "significance", window: "all", curation: "daily-top", evidence: "all" },
  },
];

export function parseFeedQuery(raw: Record<string, string | string[] | undefined>): FeedQuery {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const parsed = FeedQuerySchema.parse(flat);
  if (parsed.preset) {
    const preset = FEED_PRESETS.find((p) => p.id === parsed.preset);
    if (preset) {
      return {
        ...parsed,
        ...preset.query,
        ...(flat.topic !== undefined ? { topic: parsed.topic } : {}),
        ...(flat.q !== undefined ? { q: parsed.q } : {}),
        ...(flat.sort !== undefined ? { sort: parsed.sort } : {}),
        ...(flat.window !== undefined ? { window: parsed.window } : {}),
        ...(flat.curation !== undefined ? { curation: parsed.curation } : {}),
        ...(flat.evidence !== undefined ? { evidence: parsed.evidence } : {}),
        preset: preset.id,
      };
    }
  }
  return parsed;
}

export function serializeFeedQuery(query: Partial<FeedQuery>): string {
  const sp = new URLSearchParams();
  if (query.topic) sp.set("topic", query.topic);
  if (query.q) sp.set("q", query.q);
  if (query.sort && query.sort !== "newest") sp.set("sort", query.sort);
  if (query.window && query.window !== "all") sp.set("window", query.window);
  if (query.curation && query.curation !== "all") sp.set("curation", query.curation);
  if (query.evidence && query.evidence !== "all") sp.set("evidence", query.evidence);
  if (query.preset) sp.set("preset", query.preset);
  if (query.page && query.page > 1) sp.set("page", String(query.page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

// URL-state schema for `/analysis` (SIM Outer-Loop Lab + Worked Paper Examples + Live Inspector + Bake-Off Forensics)
export const ANALYSIS_TABS = ["sim-loop", "worked-examples", "live-inspector", "forensics"] as const;
export type AnalysisTab = (typeof ANALYSIS_TABS)[number];

export const SIM_TRACKS = ["si-curation", "gemma-decoder"] as const;
export type SimTrackId = (typeof SIM_TRACKS)[number];

export const AnalysisLabQuerySchema = z.object({
  tab: z.enum(ANALYSIS_TABS).catch("sim-loop"),
  track: z.enum(SIM_TRACKS).catch("si-curation"),
  round: z.coerce.number().int().min(0).max(3).catch(3),
  example: z.string().trim().max(64).catch("alignment-faking"),
  title: z.string().trim().max(300).catch(""),
  summary: z.string().trim().max(1500).catch(""),
  url: z.string().trim().max(300).catch(""),
  kind: SourceKindSchema.catch("papers"),
  sources: z.coerce.number().int().min(1).max(10).catch(1),
});

export type AnalysisLabQuery = z.infer<typeof AnalysisLabQuerySchema>;

export function parseAnalysisLabQuery(raw: Record<string, string | string[] | undefined>): AnalysisLabQuery {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  return AnalysisLabQuerySchema.parse(flat);
}

export function serializeAnalysisLabQuery(q: Partial<AnalysisLabQuery>): string {
  const sp = new URLSearchParams();
  if (q.tab && q.tab !== "sim-loop") sp.set("tab", q.tab);
  if (q.track && q.track !== "si-curation") sp.set("track", q.track);
  if (q.round !== undefined && q.round !== 3) sp.set("round", String(q.round));
  if (q.example && q.example !== "alignment-faking") sp.set("example", q.example);
  if (q.title) sp.set("title", q.title);
  if (q.summary) sp.set("summary", q.summary);
  if (q.url) sp.set("url", q.url);
  if (q.kind && q.kind !== "papers") sp.set("kind", q.kind);
  if (q.sources && q.sources > 1) sp.set("sources", String(q.sources));
  const qs = sp.toString();
  return qs ? `/analysis?${qs}` : "/analysis";
}

// Ontological Zod schemas for Self-Improvement Memory (SIM) Agentic Outer Loop (Figure 2)
export const SimCandidateSchema = z.object({
  id: z.string(),
  label: z.string(),
  proposedEdit: z.string(),
  predictedEffect: z.string(),
  observedOutcome: z.string(),
  evolveScore: z.number().min(0).max(100),
  precisionPct: z.number().min(0).max(100),
  recallPct: z.number().min(0).max(100),
  regressionCheckPassed: z.boolean(),
  selected: z.boolean(),
  selectorRationale: z.string(),
});

export type SimCandidate = z.infer<typeof SimCandidateSchema>;

export const SimMemoryEntrySchema = z.object({
  round: z.number().int().min(0),
  harnessId: z.string(),
  checkpointOrPolicy: z.string(),
  benchmarkSplit: z.literal("evolve-set (sealed holdout excluded)"),
  rootCause: z.string(),
  decisiveSignalTrace: z.string(),
  candidatesEvaluated: z.array(SimCandidateSchema),
  retainedHarnessId: z.string(),
  retainedAction: z.enum(["promoted-candidate", "kept-prior-harness"]),
});

export type SimMemoryEntry = z.infer<typeof SimMemoryEntrySchema>;

export const ResidualTrainingRuleSchema = z.object({
  whenToTrain: z.string(),
  examplesToPrioritize: z.string(),
  whyItWorks: z.string(),
  verificationGate: z.string(),
});

export type ResidualTrainingRule = z.infer<typeof ResidualTrainingRuleSchema>;

export const WhyFactorSchema = z.object({
  factor: z.string(),
  points: z.number(),
  detail: z.string(),
});

export type WhyFactor = z.infer<typeof WhyFactorSchema>;

export const BenchmarkScoreSchema = z.object({
  value: z.number(),
  unit: z.enum(["%", "hours"]),
  raw: z.string(),
});

export const BenchmarkHitSchema = z.object({
  id: z.string(),
  label: z.string(),
  measures: z.string(),
  matched: z.string(),
  score: BenchmarkScoreSchema.nullable(),
});

export type BenchmarkHit = z.infer<typeof BenchmarkHitSchema>;

export const EntityHitSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export type EntityHit = z.infer<typeof EntityHitSchema>;

export const ClaimCheckSchema = z.object({
  sentence: z.string(),
  level: z.enum(["backed", "partly-backed", "unbacked"]),
  markers: z.array(z.string()),
});

export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

export const FormalProofSignalSchema = z.object({
  rungId: z.enum(["none", "claimed", "statement-checked", "outside-checked"]),
  label: z.string(),
  points: z.number().int().min(0).max(7),
  fidelityGap: z.boolean(),
  matched: z.array(z.string()),
});

export type FormalProofSignal = z.infer<typeof FormalProofSignalSchema>;

export const PaperRigorSummarySchema = z.object({
  rigorScore: z.number().int().min(0).max(100),
  hypeScore: z.number().int().min(0).max(100),
  credibilityBand: z.enum(["high", "moderate", "preliminary", "hype-flagged"]),
  paperKind: z.object({
    id: z.string(),
    label: z.string(),
    why: z.string(),
    canShow: z.string(),
  }),
  rubric: z.enum(["empirical", "survey", "reporting", "theory-governance"]),
  presentMarkers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      points: z.number(),
      snippet: z.string(),
    }),
  ),
  missingMarkers: z.array(z.string()),
  negatedMarkers: z.array(
    z.object({
      label: z.string(),
      snippet: z.string(),
    }),
  ),
  claims: z.object({
    backed: z.number().int().nonnegative(),
    partlyBacked: z.number().int().nonnegative(),
    unbacked: z.number().int().nonnegative(),
    items: z.array(ClaimCheckSchema),
  }),
  hypeWords: z.array(z.string()),
  promptInjection: z.object({
    fired: z.boolean(),
    hits: z.array(z.string()),
  }),
  formalProof: FormalProofSignalSchema,
});

export type PaperRigorSummary = z.infer<typeof PaperRigorSummarySchema>;

export const AssessmentTrailStepSchema = z.object({
  // 0 = rules, 1–2 = AI models, 3 = human reviewer consensus.
  tier: z.number().int().min(0).max(3),
  model: z.string().nullable(),
  verdict: z.enum(["relevant", "irrelevant", "unsure", "reject"]),
  confidence: z.number().min(0).max(1),
  note: z.string().optional(),
});

export type AssessmentTrailStep = z.infer<typeof AssessmentTrailStepSchema>;

export const BriefSpecSchema = z.object({
  schemaVersion: z.literal("si-brief-v1"),
  generatedAt: z.string(),
  windowDays: z.number().int().positive(),
  totals: z.object({
    storiesThisWeek: z.number().int().nonnegative(),
    storiesPrevWeek: z.number().int().nonnegative(),
    activeSources: z.number().int().nonnegative(),
    multiSourceCount: z.number().int().nonnegative(),
    avgSignificance: z.number().nonnegative(),
  }),
  topicVelocity: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      thisWeek: z.number().int().nonnegative(),
      prevWeek: z.number().int().nonnegative(),
      delta: z.number().int(),
    }),
  ),
  landmarks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      significanceScore: z.number(),
      aiScore: z.number().nullable(),
      sourceCount: z.number().int(),
      topics: z.array(z.string()),
      publishedAt: z.string(),
    }),
  ),
  singleSourceFinds: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string(),
      sourceName: z.string(),
      significanceScore: z.number(),
      publishedAt: z.string(),
    }),
  ),
  benchmarkMentions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      mentions: z.number().int().nonnegative(),
      bestRawScore: z.string().nullable(),
    }),
  ),
});

export type BriefSpec = z.infer<typeof BriefSpecSchema>;
