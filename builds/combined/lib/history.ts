import { FOUNDATIONAL_CANON_STORIES } from "./canon-stories";
import { ensureSchema, S, sql } from "./db";
import { fetchTextWithTimeout, parseFeedXml, type ParsedFeedItem } from "./feeds";
import { ingestFeedItem, judgePendingStories, seedDefaultSources } from "./ingest";
import { tagText } from "./ontology";
import { DEFAULT_SOURCES, type SourceCatalogEntry } from "./sources-data";

// Resumable 2015–present Historical Archive Backfill + Foundational Canon Seeder (REQ-C04).
// Upgrades Build A's 2023-only history.ts by:
// 1. Extending archive horizon back to 2015-01-01 (covering foundational safety, debate, mesa-opt & scaling papers),
// 2. Implementing missing `arxiv-month` and `gnews-month` strategies alongside `substack`, `paged-rss`, `forum-graphql` & `full-feed`,
// 3. Seeding the verified 2015–2025 Foundational Superintelligence Canon as task `canon:2015-2025` with multi-source links,
// 4. Ordering archive tasks: canon + full-archive sources first, then monthly tasks newest-to-oldest back to 2016.

export const HISTORY_START = "2015-01-01T00:00:00Z";
const START_DATE = new Date(HISTORY_START);

type ArchiveStepResult = {
  items: ParsedFeedItem[];
  done: boolean;
  cursor?: string | null;
};

export type ArchiveTask = {
  id: string;
  sourceId: string;
  pauseMs: number;
  run: (cursor: string | null) => Promise<ArchiveStepResult>;
};

type SubstackArchivePost = {
  title?: string;
  canonical_url?: string;
  subtitle?: string;
  description?: string;
  post_date?: string;
};

type ForumGraphqlPost = {
  title?: string;
  pageUrl?: string;
  postedAt?: string;
  user?: { displayName?: string | null } | null;
  contents?: { plaintextDescription?: string | null } | null;
};

export function archiveMonthsSince(startYear = 2016, now: Date = new Date()): string[] {
  const out: string[] = [];
  let y = startYear;
  let m = 1;
  const endY = now.getUTCFullYear();
  const endM = now.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out.reverse();
}

function nextMonthIso(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function buildArxivMonthUrl(feedUrl: string, ym: string): string {
  const url = new URL(feedUrl);
  const [y, m] = ym.split("-");
  const lastDay = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  const baseQuery = url.searchParams.get("search_query") ?? "cat:cs.AI";
  url.searchParams.set(
    "search_query",
    `${baseQuery} AND submittedDate:[${y}${m}010000 TO ${y}${m}${String(lastDay).padStart(2, "0")}2359]`,
  );
  url.searchParams.set("max_results", "75");
  return url.toString();
}

export function buildGoogleNewsMonthUrl(baseFeedUrl: string, ym: string): string {
  const url = new URL(baseFeedUrl);
  const q = (url.searchParams.get("q") ?? "").replace(/\s*when:\S+/g, "").trim();
  url.searchParams.set("q", `${q} after:${ym}-01 before:${nextMonthIso(ym)}-01`);
  return url.toString();
}

// Seeds the 2015–2025 Foundational Superintelligence Canon with full multi-source links & analysis.
export async function seedFoundationalCanon(): Promise<{ created: number; grouped: number }> {
  await ensureSchema();
  await seedDefaultSources();

  let created = 0;
  let grouped = 0;
  for (const entry of FOUNDATIONAL_CANON_STORIES) {
    const pubDate = new Date(entry.publishedAt);
    for (let i = 0; i < entry.sources.length; i++) {
      const src = entry.sources[i];
      // Stagger firstSeenAt slightly across secondary sources so cross-source lag provenance is realistic & informative
      const seenAt = new Date(pubDate.getTime() + i * 45 * 60_000);
      const res = await ingestFeedItem(
        {
          title: entry.title,
          link: src.url || entry.url,
          summary: entry.summary,
          authors: entry.authors,
          published: pubDate,
          outlet: src.outlet ?? null,
          outletUrl: null,
        },
        src.sourceId,
        seenAt,
      );
      if (res.outcome === "created") created++;
      else if (res.outcome === "grouped") grouped++;
    }
  }
  return { created, grouped };
}

export function buildHistoryTasks(
  sources: SourceCatalogEntry[] = DEFAULT_SOURCES,
  now: Date = new Date(),
): ArchiveTask[] {
  const tasks: ArchiveTask[] = [];
  const allMonths = archiveMonthsSince(2018, now);
  const arxivMonths = archiveMonthsSince(2016, now);

  // 1. Whole-archive feeds first (1 request covers years of history, e.g. OpenAI 2016–present, Anthropic 2021–present, METR, BAIR)
  for (const s of sources) {
    if (s.history === "full-feed") {
      tasks.push({
        id: `${s.id}:full-feed`,
        sourceId: s.id,
        pauseMs: 250,
        run: async () => {
          const xml = await fetchTextWithTimeout(s.feedUrl, { timeoutMs: 12_000 });
          return { items: parseFeedXml(xml, 400), done: true };
        },
      });
    } else if (s.history === "substack") {
      const base = s.feedUrl.replace(/\/feed\/?$/, "");
      tasks.push({
        id: `${s.id}:archive`,
        sourceId: s.id,
        pauseMs: 800,
        run: async (cursor) => {
          const offset = Number.parseInt(cursor ?? "0", 10) || 0;
          const url = `${base}/api/v1/archive?sort=new&limit=25&offset=${offset}`;
          const raw = JSON.parse(await fetchTextWithTimeout(url, { timeoutMs: 10_000 })) as
            | SubstackArchivePost[]
            | { posts?: SubstackArchivePost[] };
          const posts = Array.isArray(raw) ? raw : raw.posts ?? [];
          const items: ParsedFeedItem[] = posts.map((p) => ({
            title: p.title ?? "",
            link: p.canonical_url ?? "",
            summary: p.subtitle || p.description || "",
            authors: "",
            published: p.post_date ? new Date(p.post_date) : null,
            outlet: null,
            outletUrl: null,
          }));
          const reachedStart = items.some((i) => i.published && i.published < START_DATE);
          const done = reachedStart || items.length < 25 || offset >= 400;
          return { items, done, cursor: done ? null : String(offset + 25) };
        },
      });
    } else if (s.history === "paged-rss") {
      tasks.push({
        id: `${s.id}:paged`,
        sourceId: s.id,
        pauseMs: 400,
        run: async (cursor) => {
          const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);
          const u = new URL(s.feedUrl);
          u.searchParams.set("paged", String(page));
          const items = parseFeedXml(await fetchTextWithTimeout(u.toString(), { timeoutMs: 10_000 }), 100);
          const reachedStart = items.some((i) => i.published && i.published < START_DATE);
          const done = reachedStart || items.length === 0 || page >= 15;
          return { items, done, cursor: done ? null : String(page + 1) };
        },
      });
    }
  }

  // 2. Monthly archive slices newest-first back to 2016/2018 (arXiv, Alignment Forum & LessWrong GraphQL, lab/news site archives)
  for (const ym of arxivMonths) {
    for (const s of sources) {
      if (s.history === "arxiv-month") {
        tasks.push({
          id: `${s.id}:${ym}`,
          sourceId: s.id,
          pauseMs: 1200,
          run: async () => {
            const xml = await fetchTextWithTimeout(buildArxivMonthUrl(s.feedUrl, ym), { timeoutMs: 12_000 });
            return { items: parseFeedXml(xml, 100), done: true };
          },
        });
      }
    }

    if (allMonths.includes(ym)) {
      for (const s of sources) {
        if (s.history === "forum-graphql") {
          tasks.push({
            id: `${s.id}:${ym}`,
            sourceId: s.id,
            pauseMs: 400,
            run: async () => {
              const endpoint = new URL("/graphql", s.feedUrl).toString();
              const query = `{ posts(input: {terms: {view: "top", limit: 25, after: "${ym}-01", before: "${nextMonthIso(ym)}-01"}}) { results { title pageUrl postedAt user { displayName } contents { plaintextDescription } } } }`;
              const body = await fetchTextWithTimeout(endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ query }),
                timeoutMs: 10_000,
              });
              const parsed = JSON.parse(body) as { data?: { posts?: { results?: ForumGraphqlPost[] } } };
              const results = parsed.data?.posts?.results ?? [];
              const items: ParsedFeedItem[] = results.map((r) => ({
                title: r.title ?? "",
                link: r.pageUrl ?? "",
                summary: r.contents?.plaintextDescription ?? "",
                authors: r.user?.displayName ?? "",
                published: r.postedAt ? new Date(r.postedAt) : null,
                outlet: null,
                outletUrl: null,
              }));
              return { items, done: true };
            },
          });
        } else if (s.history === "gnews-month") {
          // Only crawl lab/news site searches back to 2022 where Google News index is reliable, requiring headline topic hit
          if (ym >= "2022-01") {
            tasks.push({
              id: `${s.id}:${ym}`,
              sourceId: s.id,
              pauseMs: 600,
              run: async () => {
                const xml = await fetchTextWithTimeout(
                  buildGoogleNewsMonthUrl(s.historySearchUrl ?? s.feedUrl, ym),
                  { timeoutMs: 10_000 },
                );
                const parsed = parseFeedXml(xml, 60).filter((it) => tagText(it.title, "").inScope);
                return { items: parsed, done: true };
              },
            });
          }
        }
      }
    }
  }

  return tasks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runHistoryStep(maxTasks = 6): Promise<{
  attempted: number;
  completed: number;
  ingested: number;
  errors: number;
  canonSeeded: number;
}> {
  await ensureSchema();
  await seedDefaultSources();

  const tasks = buildHistoryTasks();
  const stateRows = await sql<{ task_id: string; cursor: string | null; done: boolean }[]>`
    SELECT task_id, cursor, done FROM ${S()}.history_progress
  `;
  const stateMap = new Map(stateRows.map((r) => [r.task_id, r]));

  let canonSeeded = 0;
  if (!stateMap.get("canon:2015-2025")?.done) {
    const canonRes = await seedFoundationalCanon();
    canonSeeded = canonRes.created + canonRes.grouped;
    await sql`
      INSERT INTO ${S()}.history_progress (task_id, cursor, done, items, last_error, updated_at)
      VALUES ('canon:2015-2025', NULL, true, ${canonRes.created}, NULL, now())
      ON CONFLICT (task_id) DO UPDATE SET
        done = true,
        items = EXCLUDED.items,
        last_error = NULL,
        updated_at = now()
    `;
  }

  const pending = tasks.filter((t) => !stateMap.get(t.id)?.done).slice(0, maxTasks);
  let attempted = 0;
  let completed = 0;
  let ingested = canonSeeded;
  let errors = 0;

  for (const task of pending) {
    attempted++;
    const prevCursor = stateMap.get(task.id)?.cursor ?? null;
    try {
      const res = await task.run(prevCursor);
      let storedCount = 0;
      for (const item of res.items) {
        if (item.published && item.published < START_DATE) continue;
        const out = await ingestFeedItem(item, task.sourceId);
        if (out.outcome === "created" || out.outcome === "grouped") storedCount++;
      }
      ingested += storedCount;
      if (res.done) completed++;

      await sql`
        INSERT INTO ${S()}.history_progress (task_id, cursor, done, items, last_error, updated_at)
        VALUES (${task.id}, ${res.cursor ?? null}, ${res.done}, ${storedCount}, NULL, now())
        ON CONFLICT (task_id) DO UPDATE SET
          cursor = EXCLUDED.cursor,
          done = EXCLUDED.done,
          items = ${S()}.history_progress.items + EXCLUDED.items,
          last_error = NULL,
          updated_at = now()
      `;
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message.slice(0, 200) : "Archive fetch failed";
      await sql`
        INSERT INTO ${S()}.history_progress (task_id, cursor, done, items, last_error, updated_at)
        VALUES (${task.id}, ${prevCursor}, false, 0, ${msg}, now())
        ON CONFLICT (task_id) DO UPDATE SET
          last_error = EXCLUDED.last_error,
          updated_at = now()
      `;
    }
    if (task.pauseMs > 0) await sleep(Math.min(task.pauseMs, 500));
  }

  await judgePendingStories(60);
  return { attempted, completed, ingested, errors, canonSeeded };
}
