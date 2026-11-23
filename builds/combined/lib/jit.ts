import { z } from "zod";
import { WhyFactorSchema } from "./schemas";
import type { StoryView } from "./stories";

// Just-In-Time (JIT) Single-Flight Scoped Evaluation Cache & On-Demand Story Audit Schema.
// Pure isomorphic module (zero Node/DB imports) so Zod schemas can be safely shared across
// Server Components, Route Handlers, and Client Components.

function currentSchemaScope(): string {
  const raw = (typeof process !== "undefined" ? process.env?.DB_SCHEMA : undefined) || "si_combined";
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || "si_combined";
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const MAX_JIT_ENTRIES = 256;

declare global {
  var __siJitStore: Map<string, CacheEntry<unknown>> | undefined;
  var __siJitInflight: Map<string, Promise<unknown>> | undefined;
}

export function scopedJitKey(namespace: string, suffix?: string): string {
  const base = `${currentSchemaScope()}::${namespace}`;
  return suffix ? `${base}::${suffix}` : base;
}

export function clearAllJitCaches(): void {
  globalThis.__siJitStore?.clear();
  globalThis.__siJitInflight?.clear();
}

export function invalidateJitSchema(schemaName?: string): void {
  const prefix = `${schemaName ?? currentSchemaScope()}::`;
  if (globalThis.__siJitStore) {
    for (const key of globalThis.__siJitStore.keys()) {
      if (key.startsWith(prefix)) globalThis.__siJitStore.delete(key);
    }
  }
  if (globalThis.__siJitInflight) {
    for (const key of globalThis.__siJitInflight.keys()) {
      if (key.startsWith(prefix)) globalThis.__siJitInflight.delete(key);
    }
  }
}

export async function getOrComputeJit<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  globalThis.__siJitStore ??= new Map();
  globalThis.__siJitInflight ??= new Map();

  const now = Date.now();
  const cached = globalThis.__siJitStore.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = globalThis.__siJitInflight.get(key) as Promise<T> | undefined;
  if (inflight) return inflight;

  const task = compute()
    .then((value) => {
      if (globalThis.__siJitStore && globalThis.__siJitStore.size >= MAX_JIT_ENTRIES) {
        const oldest = globalThis.__siJitStore.keys().next().value;
        if (oldest) globalThis.__siJitStore.delete(oldest);
      }
      globalThis.__siJitStore!.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
      });
      return value;
    })
    .finally(() => {
      globalThis.__siJitInflight?.delete(key);
    });

  globalThis.__siJitInflight.set(key, task);
  return task;
}

export const StoryAuditPayloadSchema = z.object({
  storyId: z.string(),
  title: z.string(),
  url: z.string(),
  summary: z.string(),
  significanceScore: z.number().int().min(0).max(100),
  rigorScore: z.number().int().min(0).max(100),
  hypeScore: z.number().int().min(0).max(100),
  bestScore: z.number(),
  credibilityBand: z.enum(["high", "moderate", "preliminary", "hype-flagged"]),
  formalRung: z.enum(["none", "claimed", "statement-checked", "outside-checked"]),
  levels: z.object({
    intuitive: z.string(),
    technical: z.string(),
    institutional: z.string(),
  }),
  why: z.array(WhyFactorSchema),
  presentMarkers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      points: z.number(),
      snippet: z.string().nullable(),
    }),
  ),
  topics: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      isRoot: z.boolean(),
      matched: z.array(z.string()),
      via: z.string().nullable(),
    }),
  ),
});

export type StoryAuditPayload = z.infer<typeof StoryAuditPayloadSchema>;

const TOPIC_PLAIN_GLOSSARY: Record<string, string> = {
  "capabilities-agi":
    "tracks how close AI systems are getting to matching or exceeding versatile human problem-solving across domains.",
  "automating-ai-research":
    "examines whether AI agents can write ML code, run experiments, and accelerate scientific discovery on their own.",
  "recursive-self-improvement":
    "studies feedback loops where AI systems improve their own tools, prompts, harnesses, or training pipelines.",
  alignment:
    "focuses on keeping increasingly capable AI systems honest, steerable, and faithful to human intent even on hard tasks.",
  interpretability:
    "opens the neural network 'black box' to inspect internal concepts and reasoning circuits directly.",
  "safety-risk":
    "evaluates concrete failure modes—such as deception, loss of control, bio/cyber misuse, or systemic risk—before deployment.",
  "forecasting-timelines":
    "uses empirical trends, compute curves, and calibrated prediction markets to estimate when frontier milestones may arrive.",
  "compute-scaling":
    "analyzes the hardware, energy, data, and mathematical scaling laws powering frontier training and inference.",
  "governance-policy":
    "covers safety standards, compute verification, public auditability, and policy frameworks governing frontier labs.",
};

export function synthesizeStoryAuditPayload(story: StoryView): StoryAuditPayload {
  const leadTopic = story.rootTopics[0];
  const topicGloss = leadTopic
    ? TOPIC_PLAIN_GLOSSARY[leadTopic.id] ?? `relates to ${leadTopic.label.toLowerCase()}.`
    : "examines developments along the trajectory toward advanced AI.";

  const corrText =
    story.sources.length > 1
      ? `Corroborated across ${story.sources.length} independent public feeds.`
      : `Surfaced via ${story.sources[0]?.name ?? "an open research feed"} (${story.evidenceLevel.toLowerCase()}).`;

  const intuitive = `This ${story.updateType.toLowerCase()} ${topicGloss} ${
    story.significanceScore >= 65
      ? "It scores in our Landmark tier because primary evidence, domain centrality, and empirical signals converge."
      : "It passed our scope filter as a substantive signal rather than consumer product noise."
  } ${corrText}`;

  const markerSummary =
    story.paperRigor.presentMarkers.length > 0
      ? `Detected ${story.paperRigor.presentMarkers.length}/8 empirical rigor markers (${story.paperRigor.presentMarkers
          .slice(0, 3)
          .map((m) => m.label.toLowerCase())
          .join(", ")}).`
      : `Classified under ${story.paperRigor.paperKind.label} (${story.paperRigor.rubric} rubric); abstract snippet contains qualitative synthesis rather than dense tabular metrics.`;

  const benchSummary =
    story.benchmarks.length > 0
      ? ` Tracked benchmarks: ${story.benchmarks
          .map((b) => (b.score ? `${b.label} (${b.score.raw})` : b.label))
          .join(", ")}.`
      : "";

  const technical = `${markerSummary}${benchSummary} ${
    story.aiReason ? `Judge synthesis: ${story.aiReason}` : ""
  }`.trim();

  const hypeAudit =
    story.hypeScore >= 35
      ? `Goodhart guard flagged elevated hype/unbacked assertion risk (${story.hypeScore}/100), applying an automatic ranking discount.`
      : `Low hype risk (${story.hypeScore}/100); ${story.paperRigor.claims.backed} backed vs. ${story.paperRigor.claims.unbacked} unbacked sweeping claims in abstract.`;

  const formalAudit =
    story.formalRung !== "none"
      ? ` Formal verification rung: ${story.paperRigor.formalProof.label}.`
      : "";

  const institutional = `Credibility band: ${story.credibilityBand.toUpperCase()} (Significance ${story.significanceScore}/100 · Rigor ${story.rigorScore}/100 · Composite ${story.bestScore}/100). ${hypeAudit}${formalAudit}`;

  return StoryAuditPayloadSchema.parse({
    storyId: story.id,
    title: story.title,
    url: story.url,
    summary: story.summary,
    significanceScore: story.significanceScore,
    rigorScore: story.rigorScore,
    hypeScore: story.hypeScore,
    bestScore: story.bestScore,
    credibilityBand: story.credibilityBand,
    formalRung: story.formalRung,
    levels: { intuitive, technical, institutional },
    why: story.why,
    presentMarkers: story.paperRigor.presentMarkers.map((m) => ({
      id: m.id,
      label: m.label,
      points: m.points,
      snippet: m.snippet ?? null,
    })),
    topics: story.topics.map((t) => ({
      id: t.id,
      label: t.label,
      isRoot: t.isRoot,
      matched: t.matched,
      via: t.via,
    })),
  });
}

export const buildStoryAuditPayload = synthesizeStoryAuditPayload;
