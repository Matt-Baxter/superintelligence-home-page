import { z } from "zod";
import { ensureSchema, S, sql } from "@/lib/db";

// Human-in-the-loop review. The machine routes uncertain stories here; any signed-in reader can also flag one.
// Three agreeing human verdicts resolve an item and adjust the published rating.

export const ReviewVerdictSchema = z.enum(["confirm", "overrated", "underrated", "off_topic"]);
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  confirm: "Rating is right",
  overrated: "Rated too high",
  underrated: "Rated too low",
  off_topic: "Not about superintelligence",
};

export const VerdictInputSchema = z.object({
  verdict: ReviewVerdictSchema,
  note: z.string().trim().max(280).default(""),
});

export const FlagInputSchema = z.object({
  reason: z.string().trim().min(4, "Say briefly why this needs review.").max(200),
});

export const CONSENSUS_QUORUM = 3;

export type QueueItem = {
  queueId: string;
  storyId: string;
  title: string;
  url: string;
  sourceName: string;
  aiScore: number | null;
  inScope: boolean;
  origin: "machine" | "reader";
  reason: string;
  createdAt: Date;
  tally: Record<ReviewVerdict, number>;
  myVerdict: ReviewVerdict | null;
};

const emptyTally = (): Record<ReviewVerdict, number> => ({ confirm: 0, overrated: 0, underrated: 0, off_topic: 0 });

export async function listQueue(opts: { userId: string | null; status: "open" | "resolved"; limit?: number }): Promise<QueueItem[]> {
  await ensureSchema();
  const rows = await sql<
    {
      queue_id: string;
      story_id: string;
      title: string;
      url: string;
      source_name: string | null;
      ai_score: number | null;
      in_scope: boolean;
      origin: "machine" | "reader";
      reason: string;
      created_at: Date;
      tally: Record<string, number> | null;
      my_verdict: ReviewVerdict | null;
    }[]
  >`
    SELECT q.id AS queue_id, s.id AS story_id, s.title, s.url,
           (SELECT src.name FROM ${S()}.story_sources ss JOIN ${S()}.sources src ON src.id = ss.source_id
             WHERE ss.story_id = s.id ORDER BY ss.first_seen_at ASC LIMIT 1) AS source_name,
           s.ai_score, s.in_scope, q.origin, q.reason, q.created_at,
           (SELECT jsonb_object_agg(v.verdict, v.n) FROM (
              SELECT verdict, count(*)::int AS n FROM ${S()}.review_verdicts WHERE story_id = s.id GROUP BY verdict
            ) v) AS tally,
           (SELECT verdict FROM ${S()}.review_verdicts WHERE story_id = s.id AND user_id = ${opts.userId ?? null}::bigint) AS my_verdict
    FROM ${S()}.review_queue q
    JOIN ${S()}.stories s ON s.id = q.story_id
    WHERE q.status = ${opts.status}
    ORDER BY q.created_at DESC
    LIMIT ${Math.min(opts.limit ?? 50, 100)}
  `;
  return rows.map((r) => ({
    queueId: String(r.queue_id),
    storyId: String(r.story_id),
    title: r.title,
    url: r.url,
    sourceName: r.source_name ?? "Unknown source",
    aiScore: r.ai_score === null ? null : Number(r.ai_score),
    inScope: r.in_scope,
    origin: r.origin,
    reason: r.reason,
    createdAt: new Date(r.created_at),
    tally: { ...emptyTally(), ...(r.tally ?? {}) },
    myVerdict: r.my_verdict,
  }));
}

export async function queueCounts(): Promise<{ open: number; resolved: number }> {
  await ensureSchema();
  const [row] = await sql<{ open: number; resolved: number }[]>`
    SELECT count(*) FILTER (WHERE status = 'open')::int AS open,
           count(*) FILTER (WHERE status = 'resolved')::int AS resolved
    FROM ${S()}.review_queue
  `;
  return row ?? { open: 0, resolved: 0 };
}

export async function flagStory(opts: { storyId: string; reason: string }): Promise<{ ok: boolean; alreadyQueued: boolean }> {
  await ensureSchema();
  const [story] = await sql<{ id: string }[]>`SELECT id FROM ${S()}.stories WHERE id = ${opts.storyId}::bigint`;
  if (!story) return { ok: false, alreadyQueued: false };
  const inserted = await sql`
    INSERT INTO ${S()}.review_queue (story_id, origin, reason)
    VALUES (${opts.storyId}::bigint, 'reader', ${opts.reason})
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  return { ok: true, alreadyQueued: inserted.length === 0 };
}

// Pure: what the crowd decided, or null while there is no quorum or no majority.
export function decideConsensus(tally: Record<ReviewVerdict, number>, quorum = CONSENSUS_QUORUM): ReviewVerdict | null {
  const entries = Object.entries(tally) as [ReviewVerdict, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total < quorum) return null;
  const [top, topN] = entries.sort((a, b) => b[1] - a[1])[0];
  return topN * 2 > total ? top : null;
}

// Pure: how a consensus changes the published 1–10 rating.
export function applyConsensus(aiScore: number | null, consensus: ReviewVerdict): { aiScore: number | null; inScope: boolean } {
  const base = aiScore ?? 5;
  switch (consensus) {
    case "off_topic":
      return { aiScore, inScope: false };
    case "overrated":
      return { aiScore: Math.max(1, Math.round((base - 1.5) * 10) / 10), inScope: true };
    case "underrated":
      return { aiScore: Math.min(10, Math.round((base + 1) * 10) / 10), inScope: true };
    default:
      return { aiScore, inScope: true };
  }
}

export async function recordVerdict(opts: {
  userId: string;
  storyId: string;
  verdict: ReviewVerdict;
  note: string;
}): Promise<{ ok: boolean; consensus: ReviewVerdict | null }> {
  await ensureSchema();
  const [open] = await sql<{ id: string }[]>`
    SELECT id FROM ${S()}.review_queue WHERE story_id = ${opts.storyId}::bigint AND status = 'open'
  `;
  if (!open) return { ok: false, consensus: null };

  await sql`
    INSERT INTO ${S()}.review_verdicts (user_id, story_id, verdict, note)
    VALUES (${opts.userId}::bigint, ${opts.storyId}::bigint, ${opts.verdict}, ${opts.note})
    ON CONFLICT (user_id, story_id) DO UPDATE SET verdict = EXCLUDED.verdict, note = EXCLUDED.note, created_at = now()
  `;

  const rows = await sql<{ verdict: ReviewVerdict; n: number }[]>`
    SELECT verdict, count(*)::int AS n FROM ${S()}.review_verdicts WHERE story_id = ${opts.storyId}::bigint GROUP BY verdict
  `;
  const tally = emptyTally();
  for (const r of rows) tally[r.verdict] = r.n;
  const consensus = decideConsensus(tally);
  if (!consensus) return { ok: true, consensus: null };

  const [story] = await sql<{ ai_score: number | null }[]>`
    SELECT ai_score FROM ${S()}.stories WHERE id = ${opts.storyId}::bigint
  `;
  const next = applyConsensus(story?.ai_score === null || story === undefined ? null : Number(story.ai_score), consensus);
  const humanStep = {
    tier: 3,
    model: null,
    verdict: next.inScope ? "relevant" : "irrelevant",
    confidence: 1,
    note: `Human consensus (${CONSENSUS_QUORUM}+ reviewers): ${VERDICT_LABEL[consensus]}`,
  };
  await sql`
    UPDATE ${S()}.stories
    SET ai_score = ${next.aiScore}, in_scope = ${next.inScope},
        ai_trail = COALESCE(ai_trail, '[]'::jsonb) || ${sql.json([humanStep])}
    WHERE id = ${opts.storyId}::bigint
  `;
  await sql`UPDATE ${S()}.review_queue SET status = 'resolved' WHERE id = ${open.id}`;
  return { ok: true, consensus };
}
