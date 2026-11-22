import type { FeedItem } from "./feeds.ts";
import { matchTopics } from "./topics.ts";

// Pure helpers for the history fill (lib/history.ts): no database or network, so they can be
// unit-tested directly.

export const HISTORY_START = "2023-01-01";
export const START = new Date(`${HISTORY_START}T00:00:00Z`);
export const FORUM_TOP_PER_MONTH = 15;
export const SUBSTACK_PAGE_SIZE = 12;



// Months from HISTORY_START up to, but not including, the month of `now`, newest first.
export function historyMonths(now: Date = new Date()): string[] {
  const months: string[] = [];
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let d = new Date(START); d < end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    months.push(d.toISOString().slice(0, 7));
  }
  return months.reverse();
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

// Google News: the daily feed's query with "when:2d" replaced by a month's date range.
export function googleNewsMonthUrl(feedUrl: string, month: string): string {
  const url = new URL(feedUrl);
  const q = (url.searchParams.get("q") ?? "").replace(/\s*when:\S+/g, "").trim();
  url.searchParams.set("q", `${q} after:${month}-01 before:${nextMonth(month)}-01`);
  return url.toString();
}

// arXiv: the daily search narrowed to papers submitted in one month.
export function arxivMonthUrl(feedUrl: string, month: string): string {
  const url = new URL(feedUrl);
  const [y, m] = month.split("-");
  const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  const base = url.searchParams.get("search_query") ?? "";
  url.searchParams.set("search_query", `${base} AND submittedDate:[${y}${m}010000 TO ${y}${m}${String(last).padStart(2, "0")}2359]`);
  url.searchParams.set("max_results", "100");
  return url.toString();
}

export type SubstackPost = { title?: string; subtitle?: string; description?: string; post_date?: string; canonical_url?: string };
export function substackPostsToItems(posts: SubstackPost[]): FeedItem[] {
  return posts
    .filter((p) => p.title && p.canonical_url && p.post_date)
    .map((p) => ({
      title: p.title!,
      link: p.canonical_url!,
      summary: p.subtitle || p.description || "",
      published: new Date(p.post_date!),
    }));
}

export type ForumPost = { title?: string; pageUrl?: string; postedAt?: string; contents?: { plaintextDescription?: string } | null };
export function forumPostsToItems(posts: ForumPost[]): FeedItem[] {
  return posts
    .filter((p) => p.title && p.pageUrl && p.postedAt)
    .map((p) => ({
      title: p.title!,
      link: p.pageUrl!,
      summary: p.contents?.plaintextDescription ?? "",
      published: new Date(p.postedAt!),
    }));
}

// For news searches in the history, a key phrase must be in the headline itself: news archives
// are large, and a story whose headline isn't about superintelligence rarely is.
export function keepHistoryNewsItem(item: FeedItem): boolean {
  return matchTopics(item.title).length > 0;
}

