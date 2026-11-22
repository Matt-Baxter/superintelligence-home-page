import { sql } from "./db";
import { fetchText, parseFeed, type FeedItem } from "./feeds";
import { ingestItem } from "./ingest";
import { getHistorySources, type Source } from "./sources";
import {
  START,
  FORUM_TOP_PER_MONTH,
  SUBSTACK_PAGE_SIZE,
  arxivMonthUrl,
  forumPostsToItems,
  googleNewsMonthUrl,
  historyMonths,
  keepHistoryNewsItem,
  nextMonth,
  substackPostsToItems,
  type ForumPost,
  type SubstackPost,
} from "./history-helpers";

export { HISTORY_START } from "./history-helpers";

// History fill for Build A (research §16): a one-time pass that reads each source's archive back to
// HISTORY_START, so the feed covers 2023 onward and not only the newest posts. Every item goes
// through the same pipeline as daily news: keyword filter, grouping, then the AI judge and the
// daily cap decide what appears. Work is split into small tasks whose progress is saved in
// `history_progress`, so each run picks up where the last one stopped.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Tasks ----------

type TaskResult = { items: FeedItem[]; done: boolean; cursor?: string | null };
type Task = { id: string; sourceId: string; pauseMs: number; run: (cursor: string | null) => Promise<TaskResult> };

function graphqlEndpoint(source: Source): string {
  return source.history === "forum-month" ? source.feedUrl : new URL("/graphql", source.feedUrl).toString();
}

function forumMonthTask(source: Source, month: string): Task {
  return {
    id: `${source.id}:${month}`,
    sourceId: source.id,
    pauseMs: 500,
    run: async () => {
      const query = `{ posts(input: {terms: {view: "top", limit: ${FORUM_TOP_PER_MONTH}, after: "${month}-01", before: "${nextMonth(month)}-01"}}) { results { title pageUrl postedAt contents { plaintextDescription } } } }`;
      const body = await fetchText(graphqlEndpoint(source), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = JSON.parse(body) as { data?: { posts?: { results?: ForumPost[] } } };
      return { items: forumPostsToItems(json.data?.posts?.results ?? []), done: true };
    },
  };
}

function substackTask(source: Source): Task {
  const base = source.feedUrl.replace(/\/feed\/?$/, "");
  return {
    id: `${source.id}:archive`,
    sourceId: source.id,
    // Substack rate-limits quick paging (HTTP 429 seen on 2026-11-22), so wait 2 s per page.
    pauseMs: 2000,
    run: async (cursor) => {
      const url = `${base}/api/v1/archive?sort=new&limit=${SUBSTACK_PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const json = JSON.parse(await fetchText(url)) as { posts?: SubstackPost[]; nextCursor?: string | null };
      const items = substackPostsToItems(json.posts ?? []);
      const reachedStart = items.some((i) => i.published && i.published < START);
      const done = reachedStart || !json.nextCursor || items.length === 0;
      return { items, done, cursor: json.nextCursor ?? null };
    },
  };
}

function pagedFeedTask(source: Source): Task {
  return {
    id: `${source.id}:archive`,
    sourceId: source.id,
    pauseMs: 500,
    run: async (cursor) => {
      const page = Number(cursor ?? "1");
      const url = new URL(source.feedUrl);
      url.searchParams.set("paged", String(page));
      const items = parseFeed(await fetchText(url.toString()), Infinity);
      const reachedStart = items.some((i) => i.published && i.published < START);
      return { items, done: reachedStart || items.length === 0, cursor: String(page + 1) };
    },
  };
}

function fullFeedTask(source: Source): Task {
  return {
    id: `${source.id}:full-feed`,
    sourceId: source.id,
    pauseMs: 500,
    run: async () => ({ items: parseFeed(await fetchText(source.feedUrl), Infinity), done: true }),
  };
}

function monthUrlTask(source: Source, month: string, url: string, pauseMs: number, filter?: (i: FeedItem) => boolean): Task {
  return {
    id: `${source.id}:${month}`,
    sourceId: source.id,
    pauseMs,
    run: async () => {
      const items = parseFeed(await fetchText(url), Infinity);
      return { items: filter ? items.filter(filter) : items, done: true };
    },
  };
}

// How each source's archive is read. Sources with no reachable archive have no history task.
export function historyTasks(now: Date = new Date()): Task[] {
  const sources = getHistorySources();
  const fixtures = process.env.SOURCES === "fixtures";
  const tasks: Task[] = [];

  // Whole-archive tasks first: a few requests each, and they cover every month at once.
  for (const s of sources) {
    const host = new URL(s.feedUrl).hostname;
    if (s.id === "openai" || s.history === "full-feed") tasks.push(fullFeedTask(s));
    else if (s.id === "miri" || s.history === "paged-feed") tasks.push(pagedFeedTask(s));
    else if (host.endsWith("substack.com") || ["blog.redwoodresearch.org", "blog.aiimpacts.org"].includes(host) || s.history === "substack")
      tasks.push(substackTask(s));
  }

  // Then month by month, newest month first, so recent history fills in first.
  // Test fixtures cover one month, so only one month's tasks are made for them.
  for (const month of fixtures ? historyMonths(now).slice(0, 1) : historyMonths(now)) {
    for (const s of sources) {
      const isNewsSearch = s.kind === "news" || new URL(s.feedUrl).hostname === "news.google.com";
      if (s.history === "news-month") {
        tasks.push(monthUrlTask(s, month, s.feedUrl, 1000, keepHistoryNewsItem));
      } else if (isNewsSearch || s.historySearch) {
        tasks.push(monthUrlTask(s, month, googleNewsMonthUrl(s.historySearch ?? s.feedUrl, month), 1000, keepHistoryNewsItem));
      } else if (s.id === "arxiv-ai") {
        tasks.push(monthUrlTask(s, month, arxivMonthUrl(s.feedUrl, month), 3000));
      } else if (s.id === "alignment-forum" || s.id === "lesswrong" || s.history === "forum-month") {
        tasks.push(forumMonthTask(s, month));
      }
    }
  }
  return tasks;
}

// ---------- Runner ----------

export type HistorySummary = { tasksRun: number; tasksFailed: number; tasksRemaining: number; storiesAdded: number };

// Runs history tasks until `deadline` (ms since epoch). Safe to call repeatedly.
export async function runHistory(deadline: number, now: Date = new Date()): Promise<HistorySummary> {
  const tasks = historyTasks(now);
  const rows = await sql<{ task_id: string; cursor: string | null; done: boolean }[]>`
    SELECT task_id, cursor, done FROM history_progress`;
  const progress = new Map(rows.map((r) => [r.task_id, r]));

  let tasksRun = 0;
  let tasksFailed = 0;
  let storiesAdded = 0;

  for (const task of tasks) {
    if (Date.now() > deadline) break;
    const state = progress.get(task.id);
    if (state?.done) continue;
    try {
      const result = await task.run(state?.cursor ?? null);
      let added = 0;
      for (const item of result.items) {
        if (!item.published || item.published < START || item.published > now) continue;
        try {
          if ((await ingestItem(item, task.sourceId)) === "created") added++;
        } catch (err) {
          console.error(`History: could not store an item from ${task.id}:`, err);
        }
      }
      storiesAdded += added;
      await sql`
        INSERT INTO history_progress (task_id, cursor, done, items, last_error, updated_at)
        VALUES (${task.id}, ${result.cursor ?? null}, ${result.done}, ${added}, NULL, now())
        ON CONFLICT (task_id) DO UPDATE SET cursor = EXCLUDED.cursor, done = EXCLUDED.done,
          items = history_progress.items + EXCLUDED.items, last_error = NULL, updated_at = now()`;
      tasksRun++;
      // A paged archive that isn't finished gets more pages on this run, time permitting.
      if (!result.done) {
        progress.set(task.id, { task_id: task.id, cursor: result.cursor ?? null, done: false });
        tasks.splice(tasks.indexOf(task) + 1, 0, task);
      }
    } catch (err) {
      tasksFailed++;
      const message = err instanceof Error ? err.message : "Failed";
      await sql`
        INSERT INTO history_progress (task_id, last_error, updated_at) VALUES (${task.id}, ${message.slice(0, 200)}, now())
        ON CONFLICT (task_id) DO UPDATE SET last_error = EXCLUDED.last_error, updated_at = now()`;
    }
    await sleep(task.pauseMs);
  }

  const doneRows = await sql<{ task_id: string }[]>`SELECT task_id FROM history_progress WHERE done`;
  const doneIds = new Set(doneRows.map((r) => r.task_id));
  const tasksRemaining = new Set(tasks.filter((t) => !doneIds.has(t.id)).map((t) => t.id)).size;
  return { tasksRun, tasksFailed, tasksRemaining, storiesAdded };
}
