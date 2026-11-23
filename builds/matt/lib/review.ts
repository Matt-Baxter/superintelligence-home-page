import { sql } from "./db";
import { historyTasks } from "./history";
import { JUDGE_MIN_SCORE, dailyCap, judgeMode } from "./judge";
import { getSources } from "./sources";
import { rankedInDay } from "./stories";

// The judge review page (Build A research §17): every stored story with its AI score, reason and
// whether it is on the feed, so anyone can see why a story is or isn't shown.

export type ReviewStatus = "shown" | "cap" | "below" | "unjudged";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  shown: "On the feed",
  cap: "Hidden: scored 8+ but not in that day's top 5",
  below: "Hidden: scored below 8",
  unjudged: "Hidden: not judged yet",
};

export type ReviewStory = {
  id: string;
  title: string;
  url: string;
  publishedAt: Date;
  score: number | null;
  reason: string | null;
  sources: string[];
  status: ReviewStatus;
};

export type ReviewSummary = {
  judging: boolean;
  total: number;
  unjudged: number;
  shown: number;
  cap: number;
  below: number;
  scoreBands: { label: string; count: number }[];
  history: { tasks: number; done: number; failing: number };
};

export const REVIEW_LIMIT = 100;

function statusSql() {
  return judgeMode() === "off"
    ? sql`'shown'`
    : sql`CASE
        WHEN s.judged_at IS NULL THEN 'unjudged'
        WHEN rk.rank_in_day <= ${dailyCap()} THEN 'shown'
        WHEN s.ai_score >= ${JUDGE_MIN_SCORE} THEN 'cap'
        ELSE 'below' END`;
}

export async function reviewSummary(): Promise<ReviewSummary> {
  const statusRows = await sql<{ status: ReviewStatus; n: number }[]>`
    SELECT ${statusSql()} AS status, count(*)::int AS n
    FROM stories s LEFT JOIN (${rankedInDay()}) rk ON rk.id = s.id
    GROUP BY 1`;
  const c: Partial<Record<ReviewStatus, number>> = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
  const bands = await sql<{ label: string; count: number }[]>`
    SELECT label, count(*)::int AS count FROM (
      SELECT CASE
        WHEN ai_score >= 9 THEN '9.0–10'
        WHEN ai_score >= 8 THEN '8.0–8.9'
        WHEN ai_score >= 7 THEN '7.0–7.9'
        WHEN ai_score >= 5 THEN '5.0–6.9'
        ELSE 'below 5' END AS label
      FROM stories WHERE judged_at IS NOT NULL
    ) b GROUP BY label`;
  const order = ["9.0–10", "8.0–8.9", "7.0–7.9", "5.0–6.9", "below 5"];
  const [hist] = await sql<{ done: number; failing: number }[]>`
    SELECT count(*) FILTER (WHERE done)::int AS done,
           count(*) FILTER (WHERE NOT done AND last_error IS NOT NULL)::int AS failing
    FROM history_progress`;
  const shown = c.shown ?? 0;
  const cap = c.cap ?? 0;
  const below = c.below ?? 0;
  const unjudged = c.unjudged ?? 0;
  return {
    judging: judgeMode() !== "off",
    total: shown + cap + below + unjudged,
    unjudged,
    shown,
    cap,
    below,
    scoreBands: order.map((label) => ({ label, count: bands.find((b) => b.label === label)?.count ?? 0 })),
    history: { tasks: historyTasks().length, done: hist.done, failing: hist.failing },
  };
}

export async function reviewStories({ q = "", source = "", status = "" }: { q?: string; source?: string; status?: string }): Promise<ReviewStory[]> {
  const pattern = `%${q.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const rows = await sql<
    { id: string; title: string; url: string; published_at: Date; ai_score: string | null; ai_reason: string | null; sources: string[]; status: ReviewStatus }[]
  >`
    SELECT * FROM (
      SELECT s.id, s.title, s.url, s.published_at, s.ai_score, s.ai_reason, ${statusSql()} AS status,
        COALESCE((
          SELECT array_agg(CASE WHEN ss.outlet IS NULL THEN src.name ELSE ss.outlet || ' (' || src.name || ')' END ORDER BY src.name)
          FROM story_sources ss JOIN sources src ON src.id = ss.source_id WHERE ss.story_id = s.id
        ), '{}') AS sources
      FROM stories s LEFT JOIN (${rankedInDay()}) rk ON rk.id = s.id
      WHERE s.title ILIKE ${pattern}
        AND (${source} = '' OR EXISTS (SELECT 1 FROM story_sources ss WHERE ss.story_id = s.id AND ss.source_id = ${source}))
    ) x
    WHERE ${status} = '' OR x.status = ${status}
    ORDER BY x.published_at DESC, x.id DESC
    LIMIT ${REVIEW_LIMIT}`;
  return rows.map((r) => ({
    id: String(r.id),
    title: r.title,
    url: r.url,
    publishedAt: new Date(r.published_at),
    score: r.ai_score === null ? null : Number(r.ai_score),
    reason: r.ai_reason,
    sources: r.sources,
    status: r.status,
  }));
}

export function reviewSourceOptions() {
  return getSources().map((s) => ({ id: s.id, name: s.name }));
}
