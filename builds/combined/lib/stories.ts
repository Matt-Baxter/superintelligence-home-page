import { computeBestStoryScore } from "./analysis";
import { dailyCap, FEED_TIME_ZONE, JUDGE_MIN_SCORE } from "./assess";
export { computeBestStoryScore };
import { ensureSchema, S, sql } from "./db";
import { buildHistoryTasks } from "./history";
import { getOrComputeJit, scopedJitKey } from "./jit";
import { expandSearchToTopicIds, ROOT_TOPICS, TOPIC_LABEL_BY_ID } from "./ontology";
import { evaluatePaperRigor } from "./paper-rigor";
import {
  BriefSpecSchema,
  ROOT_TOPIC_IDS,
  type AssessmentTrailStep,
  type BenchmarkHit,
  type BriefSpec,
  type EntityHit,
  type FeedQuery,
  type PaperRigorSummary,
  type SourceKind,
  type WhyFactor,
} from "./schemas";

// Unified Read, Best-Story Ranking, Historical Era Filtering, Provenance, Brief & Audit Layer
// (REQ-002, REQ-004, REQ-005, REQ-014, REQ-017, REQ-C03..REQ-C08).

export const PAGE_SIZE = 30;

export type StorySourceView = {
  sourceId: string;
  name: string;
  kind: SourceKind;
  url: string;
  outlet: string | null;
  roleLabel: string;
  reviewLabel: string;
  independence: string;
  firstSeenAt: Date;
  lagMinutes: number;
};

export type StoryTopicView = {
  id: string;
  label: string;
  isRoot: boolean;
  matched: string[];
  via: string | null;
};

export type StoryView = {
  id: string;
  title: string;
  url: string;
  summary: string;
  authors: string;
  publishedAt: Date;
  firstSeenAt: Date;
  inScope: boolean;
  scopeReason: string;
  significanceScore: number;
  rigorScore: number;
  hypeScore: number;
  credibilityBand: "high" | "moderate" | "preliminary" | "hype-flagged";
  formalRung: "none" | "claimed" | "statement-checked" | "outside-checked";
  paperRigor: PaperRigorSummary;
  bestScore: number;
  updateType: string;
  evidenceLevel: string;
  why: WhyFactor[];
  orgs: EntityHit[];
  benchmarks: BenchmarkHit[];
  people: EntityHit[];
  codeUrls: string[];
  aiScore: number | null;
  aiReason: string | null;
  aiModel: string | null;
  aiTier: number | null;
  aiVerdict: string | null;
  aiConfidence: number | null;
  aiTrail: AssessmentTrailStep[];
  sources: StorySourceView[];
  topics: StoryTopicView[];
  rootTopics: StoryTopicView[];
  votes: number;
  voted: boolean;
  saved: boolean;
};

const ROOT_ORDER = new Map<string, number>(ROOT_TOPIC_IDS.map((id, i) => [id, i]));

type RawStoryRow = {
  id: string;
  title: string;
  url: string;
  summary: string;
  authors: string;
  published_at: Date | string;
  first_seen_at: Date | string;
  in_scope: boolean;
  scope_reason: string;
  significance_score: number;
  rigor_score: number;
  hype_score: number;
  credibility_band: string;
  formal_rung: string;
  paper_rigor: PaperRigorSummary | Record<string, unknown> | string;
  update_type: string;
  evidence_level: string;
  why_breakdown: WhyFactor[] | string;
  orgs: EntityHit[] | string;
  benchmarks: BenchmarkHit[] | string;
  people: EntityHit[] | string;
  code_urls: string[] | string;
  ai_score: string | number | null;
  ai_reason: string | null;
  ai_model: string | null;
  ai_tier: number | null;
  ai_verdict: string | null;
  ai_confidence: string | number | null;
  ai_trail: AssessmentTrailStep[] | string;
  sources: {
    sourceId: string;
    name: string;
    kind: SourceKind;
    url: string;
    outlet: string | null;
    roleLabel: string;
    reviewLabel: string;
    independence: string;
    firstSeenAt: string;
  }[] | string;
  topics: {
    id: string;
    isRoot: boolean;
    matched: string[];
    via: string | null;
  }[] | string;
  votes: string | number;
  voted: boolean;
  saved: boolean;
};

function parseJsonColumn<T>(val: T | string | null | undefined, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

function hydrateStory(r: RawStoryRow): StoryView {
  const rawSources = parseJsonColumn<
    {
      sourceId: string;
      name: string;
      kind: SourceKind;
      url: string;
      outlet: string | null;
      roleLabel: string;
      reviewLabel: string;
      independence: string;
      firstSeenAt: string;
    }[]
  >(r.sources, []);
  const sortedSources = [...rawSources].sort(
    (a, b) => new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime(),
  );
  const earliestSeenMs = sortedSources.length > 0 ? new Date(sortedSources[0].firstSeenAt).getTime() : Date.now();

  const sources: StorySourceView[] = sortedSources.map((s) => {
    const seenMs = new Date(s.firstSeenAt).getTime();
    return {
      sourceId: s.sourceId,
      name: s.name,
      kind: s.kind,
      url: s.url,
      outlet: s.outlet,
      roleLabel: s.roleLabel,
      reviewLabel: s.reviewLabel,
      independence: s.independence,
      firstSeenAt: new Date(s.firstSeenAt),
      lagMinutes: Math.max(0, Math.round((seenMs - earliestSeenMs) / 60_000)),
    };
  });

  const rawTopics = parseJsonColumn<
    {
      id: string;
      isRoot: boolean;
      matched: string[];
      via: string | null;
    }[]
  >(r.topics, []);
  const topics: StoryTopicView[] = rawTopics
    .filter((t) => TOPIC_LABEL_BY_ID.has(t.id))
    .map((t) => ({
      id: t.id,
      label: TOPIC_LABEL_BY_ID.get(t.id)!,
      isRoot: Boolean(t.isRoot),
      matched: Array.isArray(t.matched) ? t.matched : [],
      via: t.via ?? null,
    }))
    .sort((a, b) => {
      if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
      return (ROOT_ORDER.get(a.id) ?? 99) - (ROOT_ORDER.get(b.id) ?? 99);
    });

  const storedRigor = parseJsonColumn<Partial<PaperRigorSummary>>(r.paper_rigor as string, {});
  const paperRigor: PaperRigorSummary =
    storedRigor && typeof storedRigor.rigorScore === "number" && storedRigor.paperKind
      ? (storedRigor as PaperRigorSummary)
      : evaluatePaperRigor({
          title: r.title,
          summary: r.summary,
          url: r.url,
          sourceKinds: sources.map((s) => s.kind),
        });

  const significanceScore = Number(r.significance_score ?? 0);
  const rigorScore = Number(r.rigor_score || paperRigor.rigorScore || 0);
  const hypeScore = Number(r.hype_score || paperRigor.hypeScore || 0);
  const aiScore = r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score);

  return {
    id: String(r.id),
    title: r.title,
    url: r.url,
    summary: r.summary,
    authors: r.authors,
    publishedAt: new Date(r.published_at),
    firstSeenAt: new Date(r.first_seen_at),
    inScope: Boolean(r.in_scope),
    scopeReason: r.scope_reason,
    significanceScore,
    rigorScore,
    hypeScore,
    credibilityBand: paperRigor.credibilityBand,
    formalRung: paperRigor.formalProof.rungId,
    paperRigor,
    bestScore: computeBestStoryScore({
      aiScore,
      significanceScore,
      rigorScore,
      hypeScore,
      sourceCount: Math.max(1, sources.length),
    }),
    updateType: r.update_type || "Research update",
    evidenceLevel: r.evidence_level || "Public source",
    why: parseJsonColumn<WhyFactor[]>(r.why_breakdown, []),
    orgs: parseJsonColumn<EntityHit[]>(r.orgs, []),
    benchmarks: parseJsonColumn<BenchmarkHit[]>(r.benchmarks, []),
    people: parseJsonColumn<EntityHit[]>(r.people, []),
    codeUrls: parseJsonColumn<string[]>(r.code_urls, []),
    aiScore,
    aiReason: r.ai_reason,
    aiModel: r.ai_model,
    aiTier: r.ai_tier === null || r.ai_tier === undefined ? null : Number(r.ai_tier),
    aiVerdict: r.ai_verdict,
    aiConfidence: r.ai_confidence === null || r.ai_confidence === undefined ? null : Number(r.ai_confidence),
    aiTrail: parseJsonColumn<AssessmentTrailStep[]>(r.ai_trail, []),
    sources,
    topics,
    rootTopics: topics.filter((t) => t.isRoot),
    votes: Number(r.votes ?? 0),
    voted: Boolean(r.voted),
    saved: Boolean(r.saved),
  };
}

function selectStoryColumns(viewerUserId: string) {
  return sql`
    s.id, s.title, s.url, s.summary, s.authors, s.published_at, s.first_seen_at,
    s.in_scope, s.scope_reason, s.significance_score, s.rigor_score, s.hype_score,
    s.credibility_band, s.formal_rung, s.paper_rigor, s.update_type, s.evidence_level,
    s.why_breakdown, s.orgs, s.benchmarks, s.people, s.code_urls,
    s.ai_score, s.ai_reason, s.ai_model, s.ai_tier, s.ai_verdict, s.ai_confidence, s.ai_trail,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'sourceId', src.id,
          'name', src.name,
          'kind', src.kind,
          'url', ss.url,
          'outlet', ss.outlet,
          'roleLabel', src.role_label,
          'reviewLabel', src.review_label,
          'independence', src.independence,
          'firstSeenAt', ss.first_seen_at
        )
        ORDER BY ss.first_seen_at ASC, src.name ASC
      )
      FROM ${S()}.story_sources ss
      JOIN ${S()}.sources src ON src.id = ss.source_id
      WHERE ss.story_id = s.id
    ), '[]'::json) AS sources,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', st.topic_id,
          'isRoot', st.is_root,
          'matched', st.matched,
          'via', st.via
        )
      )
      FROM ${S()}.story_topics st
      WHERE st.story_id = s.id
    ), '[]'::json) AS topics,
    (SELECT count(*) FROM ${S()}.votes v WHERE v.story_id = s.id) AS votes,
    EXISTS (SELECT 1 FROM ${S()}.votes v WHERE v.story_id = s.id AND v.user_id = ${viewerUserId}) AS voted,
    EXISTS (SELECT 1 FROM ${S()}.saves sv WHERE sv.story_id = s.id AND sv.user_id = ${viewerUserId}) AS saved
  `;
}

// Allows common topic aliases (e.g. "capabilities" -> "capabilities-agi", "safety" -> "safety-risk")
const TOPIC_ALIASES: Record<string, string> = {
  capabilities: "capabilities-agi",
  safety: "safety-risk",
  forecasting: "forecasting-timelines",
  compute: "compute-scaling",
  policy: "governance-policy",
  governance: "governance-policy",
  rsi: "recursive-self-improvement",
  sim: "self-improvement-memory",
};

export function normalizeTopicFilter(rawTopic: string): string {
  const clean = rawTopic.trim().toLowerCase();
  if (!clean) return "";
  const resolved = TOPIC_ALIASES[clean] ?? clean;
  return TOPIC_LABEL_BY_ID.has(resolved) ? resolved : "";
}

export type TopicCount = {
  id: string;
  label: string;
  count: number;
};

export async function listStories(
  query: FeedQuery,
  userId?: string,
): Promise<{
  stories: StoryView[];
  hasMore: boolean;
  totalMatching: number;
  topicCounts: TopicCount[];
  activeSourceCount: number;
  activeKindCount: number;
}> {
  await ensureSchema();
  const viewerId = userId ?? "0";
  const page = Math.max(1, Math.floor(query.page || 1));
  const offset = (page - 1) * PAGE_SIZE;

  const topicId = normalizeTopicFilter(query.topic);
  const searchTerm = query.q.trim();
  const expandedTopics = searchTerm ? expandSearchToTopicIds(searchTerm) : [];

  const curationClause =
    query.curation === "daily-top"
      ? sql`AND s.id IN (
          SELECT ranked.id FROM (
            SELECT st.id, row_number() OVER (
              PARTITION BY (st.published_at AT TIME ZONE ${FEED_TIME_ZONE})::date
              ORDER BY COALESCE(st.ai_score, 8.0) DESC, st.significance_score DESC, st.rigor_score DESC,
                (SELECT count(*) FROM ${S()}.story_sources c WHERE c.story_id = st.id) DESC,
                st.published_at DESC
            ) AS rk
            FROM ${S()}.stories st
            WHERE st.in_scope = true AND COALESCE(st.ai_score, 8.0) >= ${JUDGE_MIN_SCORE}
          ) ranked
          WHERE ranked.rk <= ${dailyCap()}
        )`
      : query.curation === "high-signal"
        ? sql`AND (s.ai_verdict IS NULL OR s.ai_verdict <> 'reject')
              AND COALESCE(s.ai_score, 8.0) >= 8.2
              AND s.significance_score >= 50
              AND s.hype_score < 45`
        : sql`AND (s.ai_verdict IS NULL OR s.ai_verdict <> 'reject')`;

  const topicClause = topicId
    ? sql`AND EXISTS (
        SELECT 1 FROM ${S()}.story_topics stf
        WHERE stf.story_id = s.id AND stf.topic_id = ${topicId}
      )`
    : sql``;

  const windowClause =
    query.window === "7d"
      ? sql`AND s.published_at >= now() - interval '7 days'`
      : query.window === "30d"
        ? sql`AND s.published_at >= now() - interval '30 days'`
        : query.window === "365d"
          ? sql`AND s.published_at >= now() - interval '365 days'`
          : query.window === "2026"
            ? sql`AND s.published_at >= '2026-01-01T00:00:00Z'::timestamptz`
            : query.window === "2024-2025"
              ? sql`AND s.published_at >= '2024-01-01T00:00:00Z'::timestamptz AND s.published_at < '2026-01-01T00:00:00Z'::timestamptz`
              : query.window === "2022-2023"
                ? sql`AND s.published_at >= '2022-01-01T00:00:00Z'::timestamptz AND s.published_at < '2024-01-01T00:00:00Z'::timestamptz`
                : query.window === "pre-2022"
                  ? sql`AND s.published_at < '2022-01-01T00:00:00Z'::timestamptz`
                  : sql``;

  const evidenceClause =
    query.evidence === "empirical"
      ? sql`AND s.rigor_score >= 35`
      : query.evidence === "safety-eval"
        ? sql`AND (
            EXISTS (
              SELECT 1 FROM ${S()}.story_sources ss
              JOIN ${S()}.sources src ON src.id = ss.source_id
              WHERE ss.story_id = s.id AND src.kind IN ('safety-group', 'research-org')
            )
            OR (
              s.rigor_score >= 25
              AND EXISTS (
                SELECT 1 FROM ${S()}.story_topics st
                WHERE st.story_id = s.id AND st.topic_id IN ('alignment', 'safety-risk', 'interpretability')
              )
            )
          )`
        : query.evidence === "multi-source"
          ? sql`AND (SELECT count(*) FROM ${S()}.story_sources ss WHERE ss.story_id = s.id) >= 2`
          : query.evidence === "formal"
            ? sql`AND s.formal_rung <> 'none'`
            : sql``;

  const likePattern = `%${searchTerm}%`;
  const searchClause = searchTerm
    ? expandedTopics.length > 0
      ? sql`AND (
          s.title ILIKE ${likePattern}
          OR s.summary ILIKE ${likePattern}
          OR s.authors ILIKE ${likePattern}
          OR EXISTS (
            SELECT 1 FROM ${S()}.story_topics sts
            WHERE sts.story_id = s.id AND (
              sts.topic_id IN ${sql(expandedTopics)}
              OR array_to_string(sts.matched, ' ') ILIKE ${likePattern}
            )
          )
        )`
      : sql`AND (
          s.title ILIKE ${likePattern}
          OR s.summary ILIKE ${likePattern}
          OR s.authors ILIKE ${likePattern}
          OR EXISTS (
            SELECT 1 FROM ${S()}.story_topics sts
            WHERE sts.story_id = s.id AND array_to_string(sts.matched, ' ') ILIKE ${likePattern}
          )
        )`
    : sql``;

  const compositeBestExpr = sql`(
    GREATEST(0, LEAST(44, ((COALESCE(s.ai_score, 7.8) - 4.0) / 6.0) * 44.0))
    + (s.significance_score::numeric * 0.32)
    + (s.rigor_score::numeric * 0.14)
    + LEAST(10, GREATEST(0, (SELECT count(*) FROM ${S()}.story_sources sc WHERE sc.story_id = s.id) - 1) * 4)
    - CASE WHEN s.hype_score >= 30 THEN ((s.hype_score - 25)::numeric / 75.0) * 18.0 ELSE 0 END
  )`;

  const orderBy =
    query.sort === "best"
      ? sql`${compositeBestExpr} DESC, s.significance_score DESC, s.published_at DESC, s.id DESC`
      : query.sort === "significance"
        ? sql`s.significance_score DESC, s.rigor_score DESC, s.published_at DESC, s.id DESC`
        : query.sort === "rigor"
          ? sql`s.rigor_score DESC, s.significance_score DESC, s.published_at DESC, s.id DESC`
          : query.sort === "sources"
            ? sql`(SELECT count(*) FROM ${S()}.story_sources sc WHERE sc.story_id = s.id) DESC, s.significance_score DESC, s.published_at DESC`
            : query.sort === "votes"
              ? sql`(SELECT count(*) FROM ${S()}.votes vc WHERE vc.story_id = s.id) DESC, s.significance_score DESC, s.published_at DESC`
              : sql`s.published_at DESC, s.id DESC`;

  const [rows, countRows, corpusMeta] = await Promise.all([
    sql<RawStoryRow[]>`
      SELECT ${selectStoryColumns(viewerId)}
      FROM ${S()}.stories s
      WHERE s.in_scope = true
        ${curationClause}
        ${topicClause}
        ${windowClause}
        ${evidenceClause}
        ${searchClause}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}
    `,
    sql<{ n: string }[]>`
      SELECT count(*)::text AS n
      FROM ${S()}.stories s
      WHERE s.in_scope = true
        ${curationClause}
        ${topicClause}
        ${windowClause}
        ${evidenceClause}
        ${searchClause}
    `,
    getOrComputeJit(scopedJitKey("corpus-telemetry"), 15_000, async () => {
      const [topicCountRows, sourceStatsRows] = await Promise.all([
        sql<{ topic_id: string; n: string }[]>`
          SELECT st.topic_id, count(DISTINCT s.id)::text AS n
          FROM ${S()}.story_topics st
          JOIN ${S()}.stories s ON s.id = st.story_id
          WHERE s.in_scope = true AND st.is_root = true
          GROUP BY st.topic_id
        `,
        sql<{ sources: string; kinds: string }[]>`
          SELECT
            count(DISTINCT src.id)::text AS sources,
            count(DISTINCT src.kind)::text AS kinds
          FROM ${S()}.story_sources ss
          JOIN ${S()}.sources src ON src.id = ss.source_id
          JOIN ${S()}.stories s ON s.id = ss.story_id
          WHERE s.in_scope = true
        `,
      ]);
      const countMap = new Map(topicCountRows.map((r) => [r.topic_id, Number(r.n)]));
      return {
        topicCounts: ROOT_TOPICS.map((rt) => ({
          id: rt.id,
          label: rt.label,
          count: countMap.get(rt.id) ?? 0,
        })),
        activeSourceCount: Number(sourceStatsRows[0]?.sources ?? 0),
        activeKindCount: Number(sourceStatsRows[0]?.kinds ?? 0),
      };
    }),
  ]);

  return {
    stories: rows.slice(0, PAGE_SIZE).map(hydrateStory),
    hasMore: rows.length > PAGE_SIZE,
    totalMatching: Number(countRows[0]?.n ?? 0),
    topicCounts: corpusMeta.topicCounts,
    activeSourceCount: corpusMeta.activeSourceCount,
    activeKindCount: corpusMeta.activeKindCount,
  };
}

export async function getStoryById(storyId: string, userId?: string): Promise<StoryView | null> {
  if (!/^\d{1,18}$/.test(storyId)) return null;
  await ensureSchema();
  const rows = await sql<RawStoryRow[]>`
    SELECT ${selectStoryColumns(userId ?? "0")}
    FROM ${S()}.stories s
    WHERE s.id = ${storyId}
    LIMIT 1
  `;
  return rows.length > 0 ? hydrateStory(rows[0]) : null;
}

export async function listSavedStories(userId: string): Promise<StoryView[]> {
  await ensureSchema();
  const rows = await sql<RawStoryRow[]>`
    SELECT ${selectStoryColumns(userId)}
    FROM ${S()}.saves mine
    JOIN ${S()}.stories s ON s.id = mine.story_id
    WHERE mine.user_id = ${userId}
    ORDER BY mine.created_at DESC
  `;
  return rows.map(hydrateStory);
}

// Weekly Intelligence Brief synthesis (REQ-C06), validated against BriefSpecSchema.
export async function getWeeklyBrief(windowDays = 14): Promise<BriefSpec> {
  await ensureSchema();

  const [totalsRow, velocityRows, landmarkRows, singleSourceRows] = await Promise.all([
    sql<
      {
        this_week: string;
        prev_week: string;
        active_sources: string;
        multi_source: string;
        avg_sig: string | null;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE published_at >= now() - (${windowDays} * interval '1 day'))::text AS this_week,
        count(*) FILTER (
          WHERE published_at < now() - (${windowDays} * interval '1 day')
            AND published_at >= now() - (${windowDays * 2} * interval '1 day')
        )::text AS prev_week,
        (
          SELECT count(DISTINCT ss.source_id)::text
          FROM ${S()}.story_sources ss
          JOIN ${S()}.stories st ON st.id = ss.story_id
          WHERE st.in_scope = true
        ) AS active_sources,
        count(*) FILTER (
          WHERE (SELECT count(*) FROM ${S()}.story_sources ss WHERE ss.story_id = s.id) >= 2
        )::text AS multi_source,
        round(avg(significance_score))::text AS avg_sig
      FROM ${S()}.stories s
      WHERE s.in_scope = true
    `,
    sql<{ topic_id: string; this_week: string; prev_week: string }[]>`
      SELECT
        st.topic_id,
        count(DISTINCT s.id) FILTER (WHERE s.published_at >= now() - (${windowDays} * interval '1 day'))::text AS this_week,
        count(DISTINCT s.id) FILTER (
          WHERE s.published_at < now() - (${windowDays} * interval '1 day')
            AND s.published_at >= now() - (${windowDays * 2} * interval '1 day')
        )::text AS prev_week
      FROM ${S()}.story_topics st
      JOIN ${S()}.stories s ON s.id = st.story_id
      WHERE s.in_scope = true AND st.is_root = true
      GROUP BY st.topic_id
    `,
    sql<RawStoryRow[]>`
      SELECT ${selectStoryColumns("0")}
      FROM ${S()}.stories s
      WHERE s.in_scope = true
      ORDER BY s.significance_score DESC, s.rigor_score DESC,
        (SELECT count(*) FROM ${S()}.story_sources ss WHERE ss.story_id = s.id) DESC,
        s.published_at DESC
      LIMIT 8
    `,
    sql<RawStoryRow[]>`
      SELECT ${selectStoryColumns("0")}
      FROM ${S()}.stories s
      WHERE s.in_scope = true
        AND (SELECT count(*) FROM ${S()}.story_sources ss WHERE ss.story_id = s.id) = 1
      ORDER BY s.significance_score DESC, s.rigor_score DESC, s.published_at DESC
      LIMIT 6
    `,
  ]);

  const velMap = new Map(
    velocityRows.map((r) => [r.topic_id, { tw: Number(r.this_week), pw: Number(r.prev_week) }]),
  );

  const topicVelocity = ROOT_TOPICS.map((rt) => {
    const v = velMap.get(rt.id) ?? { tw: 0, pw: 0 };
    return {
      id: rt.id,
      label: rt.label,
      thisWeek: v.tw,
      prevWeek: v.pw,
      delta: v.tw - v.pw,
    };
  });

  const hydratedLandmarks = landmarkRows.map(hydrateStory);
  const hydratedSingles = singleSourceRows.map(hydrateStory);

  const allRecent = await sql<{ benchmarks: BenchmarkHit[] | string }[]>`
    SELECT benchmarks FROM ${S()}.stories WHERE in_scope = true ORDER BY published_at DESC LIMIT 120
  `;
  const benchTally = new Map<string, { id: string; label: string; mentions: number; bestRawScore: string | null }>();
  for (const row of allRecent) {
    const list = parseJsonColumn<BenchmarkHit[]>(row.benchmarks, []);
    for (const b of list) {
      const prev = benchTally.get(b.id) ?? { id: b.id, label: b.label, mentions: 0, bestRawScore: null };
      prev.mentions += 1;
      if (!prev.bestRawScore && b.score?.raw) prev.bestRawScore = b.score.raw;
      benchTally.set(b.id, prev);
    }
  }

  const t = totalsRow[0];
  const spec: BriefSpec = {
    schemaVersion: "si-brief-v1",
    generatedAt: new Date().toISOString(),
    windowDays,
    totals: {
      storiesThisWeek: Number(t?.this_week ?? 0),
      storiesPrevWeek: Number(t?.prev_week ?? 0),
      activeSources: Number(t?.active_sources ?? 0),
      multiSourceCount: Number(t?.multi_source ?? 0),
      avgSignificance: Number(t?.avg_sig ?? 0),
    },
    topicVelocity,
    landmarks: hydratedLandmarks.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      significanceScore: s.significanceScore,
      aiScore: s.aiScore,
      sourceCount: s.sources.length,
      topics: s.rootTopics.map((rt) => rt.label),
      publishedAt: s.publishedAt.toISOString(),
    })),
    singleSourceFinds: hydratedSingles.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      sourceName: s.sources[0]?.name ?? "Public feed",
      significanceScore: s.significanceScore,
      publishedAt: s.publishedAt.toISOString(),
    })),
    benchmarkMentions: [...benchTally.values()].sort((a, b) => b.mentions - a.mentions).slice(0, 8),
  };

  return BriefSpecSchema.parse(spec);
}

// Sources Health & Provenance Directory (REQ-C07)
export type SourceHealthRow = {
  id: string;
  name: string;
  kind: SourceKind;
  feedUrl: string;
  homeUrl: string;
  roleLabel: string;
  reviewLabel: string;
  independence: string;
  provenanceNote: string;
  lastOkAt: Date | null;
  lastError: string | null;
  storyCount: number;
};

export async function getSourcesDirectory(): Promise<SourceHealthRow[]> {
  await ensureSchema();
  const rows = await sql<
    {
      id: string;
      name: string;
      kind: SourceKind;
      feed_url: string;
      home_url: string;
      role_label: string;
      review_label: string;
      independence: string;
      provenance_note: string;
      last_ok_at: Date | null;
      last_error: string | null;
      story_count: string;
    }[]
  >`
    SELECT
      src.id, src.name, src.kind, src.feed_url, src.home_url,
      src.role_label, src.review_label, src.independence, src.provenance_note,
      src.last_ok_at, src.last_error,
      count(DISTINCT ss.story_id)::text AS story_count
    FROM ${S()}.sources src
    LEFT JOIN ${S()}.story_sources ss ON ss.source_id = src.id
    GROUP BY src.id
    ORDER BY src.kind ASC, src.name ASC
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    feedUrl: r.feed_url,
    homeUrl: r.home_url,
    roleLabel: r.role_label,
    reviewLabel: r.review_label,
    independence: r.independence,
    provenanceNote: r.provenance_note,
    lastOkAt: r.last_ok_at ? new Date(r.last_ok_at) : null,
    lastError: r.last_error,
    storyCount: Number(r.story_count ?? 0),
  }));
}

// Public Audit Ledger /review (REQ-C05)
export type AuditStatus = "shown" | "daily-capped" | "below-threshold" | "out-of-scope" | "unjudged";

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  shown: "Shown in curated feed",
  "daily-capped": "8.0+ but above daily top-5 cap",
  "below-threshold": "In scope, scored below 8.0",
  "out-of-scope": "Filtered out by scope disambiguation",
  unjudged: "Pending tier assessment",
};

export type AuditRow = {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  significanceScore: number;
  rigorScore: number;
  hypeScore: number;
  aiScore: number | null;
  aiReason: string | null;
  aiModel: string | null;
  scopeReason: string;
  status: AuditStatus;
  sources: string[];
};

export async function getReviewLedger(filters: { q?: string; source?: string; status?: string }) {
  await ensureSchema();
  const q = (filters.q ?? "").trim().slice(0, 100);
  const sourceFilter = (filters.source ?? "").trim();
  const statusFilter = (filters.status ?? "").trim();

  const dailyTopIdsRows = await sql<{ id: string }[]>`
    SELECT ranked.id FROM (
      SELECT st.id, row_number() OVER (
        PARTITION BY (st.published_at AT TIME ZONE ${FEED_TIME_ZONE})::date
        ORDER BY COALESCE(st.ai_score, 8.0) DESC, st.significance_score DESC, st.rigor_score DESC,
          (SELECT count(*) FROM ${S()}.story_sources c WHERE c.story_id = st.id) DESC,
          st.published_at DESC
      ) AS rk
      FROM ${S()}.stories st
      WHERE st.in_scope = true AND COALESCE(st.ai_score, 8.0) >= ${JUDGE_MIN_SCORE}
    ) ranked
    WHERE ranked.rk <= ${dailyCap()}
  `;
  const dailyTopSet = new Set(dailyTopIdsRows.map((r) => String(r.id)));

  const allStories = await sql<
    {
      id: string;
      title: string;
      url: string;
      published_at: Date;
      in_scope: boolean;
      scope_reason: string;
      significance_score: number;
      rigor_score: number;
      hype_score: number;
      ai_score: string | number | null;
      ai_reason: string | null;
      ai_model: string | null;
      source_ids: string[];
      source_names: string[];
    }[]
  >`
    SELECT
      s.id, s.title, s.url, s.published_at, s.in_scope, s.scope_reason,
      s.significance_score, s.rigor_score, s.hype_score, s.ai_score, s.ai_reason, s.ai_model,
      COALESCE(ARRAY(
        SELECT ss.source_id FROM ${S()}.story_sources ss WHERE ss.story_id = s.id
      ), '{}') AS source_ids,
      COALESCE(ARRAY(
        SELECT src.name FROM ${S()}.story_sources ss JOIN ${S()}.sources src ON src.id = ss.source_id WHERE ss.story_id = s.id ORDER BY src.name
      ), '{}') AS source_names
    FROM ${S()}.stories s
    ORDER BY s.significance_score DESC, s.published_at DESC
    LIMIT 300
  `;

  const counts = {
    total: allStories.length,
    shown: 0,
    dailyCapped: 0,
    belowThreshold: 0,
    outOfScope: 0,
    unjudged: 0,
  };

  const bands = [
    { label: "9.0–10.0 (Landmark)", count: 0 },
    { label: "8.0–8.9 (Significant)", count: 0 },
    { label: "6.0–7.9 (Commentary)", count: 0 },
    { label: "1.0–5.9 (Filtered)", count: 0 },
  ];

  const classified: (AuditRow & { sourceIds: string[] })[] = allStories.map((r) => {
    const score = r.ai_score === null ? null : Number(r.ai_score);
    let status: AuditStatus;
    if (!r.in_scope) {
      status = "out-of-scope";
      counts.outOfScope++;
    } else if (score === null) {
      status = "unjudged";
      counts.unjudged++;
    } else if (score < JUDGE_MIN_SCORE) {
      status = "below-threshold";
      counts.belowThreshold++;
    } else if (dailyTopSet.has(String(r.id))) {
      status = "shown";
      counts.shown++;
    } else {
      status = "daily-capped";
      counts.dailyCapped++;
    }

    if (score !== null) {
      if (score >= 9.0) bands[0].count++;
      else if (score >= 8.0) bands[1].count++;
      else if (score >= 6.0) bands[2].count++;
      else bands[3].count++;
    }

    return {
      id: String(r.id),
      title: r.title,
      url: r.url,
      publishedAt: new Date(r.published_at),
      significanceScore: Number(r.significance_score),
      rigorScore: Number(r.rigor_score ?? 0),
      hypeScore: Number(r.hype_score ?? 0),
      aiScore: score,
      aiReason: r.ai_reason,
      aiModel: r.ai_model,
      scopeReason: r.scope_reason,
      status,
      sources: r.source_names,
      sourceIds: r.source_ids,
    };
  });

  const filtered = classified
    .filter((item) => {
      if (q && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (sourceFilter && !item.sourceIds.includes(sourceFilter)) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      return true;
    })
    .slice(0, 120);

  const historyRows = await sql<{ done: boolean; last_error: string | null }[]>`
    SELECT done, last_error FROM ${S()}.history_progress
  `;
  const totalTasks = buildHistoryTasks().length + 1; // +1 for canon:2015-2025
  const doneTasks = historyRows.filter((h) => h.done).length;
  const failingTasks = historyRows.filter((h) => Boolean(h.last_error)).length;

  const sourceOptions = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM ${S()}.sources ORDER BY name ASC
  `;

  return {
    counts,
    bands,
    history: { totalTasks, doneTasks, failingTasks },
    sources: sourceOptions,
    stories: filtered,
  };
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function buildAtomFeedXml(baseUrl: string, rawTopic = ""): Promise<string> {
  const topic = normalizeTopicFilter(rawTopic);
  const { stories } = await listStories({
    topic,
    q: "",
    sort: "newest",
    window: "all",
    curation: "all",
    evidence: "all",
    preset: "",
    page: 1,
  });

  const topicLabel = topic ? TOPIC_LABEL_BY_ID.get(topic) : null;
  const feedTitle = topicLabel
    ? `Superintelligence Homepage — ${topicLabel}`
    : "Superintelligence Homepage — All Topics";
  const updated = stories[0]?.publishedAt.toISOString() ?? new Date().toISOString();
  const selfHref = `${baseUrl}/api/feed.atom${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`;

  const entries = stories
    .map((s) => {
      const cats = s.rootTopics
        .map((t) => `<category term="${escapeXml(t.id)}" label="${escapeXml(t.label)}" />`)
        .join("");
      const summaryLine = `[Significance ${s.significanceScore}/100 · Rigor ${s.rigorScore}/100 · ${s.sources.map((src) => src.name).join(", ")}] ${s.summary}`;
      return [
        "  <entry>",
        `    <id>urn:si-homepage:story:${escapeXml(s.id)}</id>`,
        `    <title>${escapeXml(s.title)}</title>`,
        `    <link href="${escapeXml(s.url)}" rel="alternate" />`,
        `    <updated>${s.publishedAt.toISOString()}</updated>`,
        `    <summary>${escapeXml(summaryLine.trim())}</summary>`,
        `    ${cats}`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(baseUrl)}/</id>`,
    `  <title>${escapeXml(feedTitle)}</title>`,
    `  <updated>${updated}</updated>`,
    `  <link href="${escapeXml(selfHref)}" rel="self" type="application/atom+xml" />`,
    `  <link href="${escapeXml(baseUrl)}/" rel="alternate" type="text/html" />`,
    entries,
    "</feed>",
  ].join("\n");
}

export async function buildSourcesOpmlXml(): Promise<string> {
  const sources = await getSourcesDirectory();
  const outlines = sources
    .map(
      (s) =>
        `      <outline type="rss" text="${escapeXml(s.name)}" title="${escapeXml(s.name)}" category="${escapeXml(s.kind)}" xmlUrl="${escapeXml(s.feedUrl)}" htmlUrl="${escapeXml(s.homeUrl)}" />`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>Superintelligence Homepage Sources</title>",
    "  </head>",
    "  <body>",
    '    <outline text="Superintelligence Sources" title="Superintelligence Sources">',
    outlines,
    "    </outline>",
    "  </body>",
    "</opml>",
  ].join("\n");
}
