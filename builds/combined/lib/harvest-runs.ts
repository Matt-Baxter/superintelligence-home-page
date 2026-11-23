import { ensureSchema, S, sql } from "@/lib/db";

export type HarvestRun = {
  id: string;
  trigger: string;
  startedAt: Date;
  finishedAt: Date | null;
  sourcesOk: number;
  sourcesFailed: number;
  itemsSeen: number;
  created: number;
  judged: number;
  queuedForReview: number;
};

export async function listHarvestRuns(limit = 8): Promise<HarvestRun[]> {
  await ensureSchema();
  const rows = await sql<
    {
      id: string;
      trigger: string;
      started_at: Date;
      finished_at: Date | null;
      sources_ok: number;
      sources_failed: number;
      items_seen: number;
      created: number;
      judged: number;
      queued_for_review: number;
    }[]
  >`
    SELECT id, trigger, started_at, finished_at, sources_ok, sources_failed,
           items_seen, created, judged, queued_for_review
    FROM ${S()}.harvest_runs
    ORDER BY started_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `;
  return rows.map((r) => ({
    id: String(r.id),
    trigger: r.trigger,
    startedAt: new Date(r.started_at),
    finishedAt: r.finished_at ? new Date(r.finished_at) : null,
    sourcesOk: r.sources_ok,
    sourcesFailed: r.sources_failed,
    itemsSeen: r.items_seen,
    created: r.created,
    judged: r.judged,
    queuedForReview: r.queued_for_review,
  }));
}
