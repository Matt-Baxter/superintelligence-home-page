import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arxivMonthUrl,
  forumPostsToItems,
  googleNewsMonthUrl,
  historyMonths,
  keepHistoryNewsItem,
  substackPostsToItems,
} from "../../lib/history-helpers.ts";

// Unit tests for the history fill's helpers (Build A research §16).

describe("History fill: months and archive addresses", () => {
  it("lists every month from January 2023 up to (not including) the current month, newest first", () => {
    const months = historyMonths(new Date("2023-04-15T00:00:00Z"));
    assert.deepEqual(months, ["2023-03", "2023-02", "2023-01"]);
    assert.equal(historyMonths(new Date("2026-11-22T00:00:00Z")).length, 46);
  });

  it("turns a daily Google News search into a one-month search", () => {
    const daily = "https://news.google.com/rss/search?q=superintelligence+when%3A2d&hl=en-US&gl=US&ceid=US%3Aen";
    const url = new URL(googleNewsMonthUrl(daily, "2023-07"));
    assert.equal(url.searchParams.get("q"), "superintelligence after:2023-07-01 before:2023-08-01");
    assert.equal(url.searchParams.get("hl"), "en-US");
    assert.equal(new URL(googleNewsMonthUrl(daily, "2023-12")).searchParams.get("q"), "superintelligence after:2023-12-01 before:2024-01-01");
  });

  it("narrows the arXiv search to papers submitted in one month (February in a leap year)", () => {
    const daily = "https://export.arxiv.org/api/query?search_query=cat:cs.AI+AND+ti:AGI&sortBy=submittedDate&max_results=20";
    const url = new URL(arxivMonthUrl(daily, "2024-02"));
    assert.equal(url.searchParams.get("search_query"), "cat:cs.AI AND ti:AGI AND submittedDate:[202402010000 TO 202402292359]");
    assert.equal(url.searchParams.get("max_results"), "100");
  });
});

describe("History fill: reading archive formats", () => {
  it("reads Substack archive posts", () => {
    const items = substackPostsToItems([
      { title: "Post", subtitle: "Sub", post_date: "2023-09-05T12:00:00.000Z", canonical_url: "https://x.substack.com/p/post" },
      { title: "No link", post_date: "2023-09-05T12:00:00.000Z" },
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].summary, "Sub");
    assert.equal(items[0].published?.toISOString(), "2023-09-05T12:00:00.000Z");
  });

  it("reads forum (Alignment Forum / LessWrong) posts", () => {
    const items = forumPostsToItems([
      { title: "Top post", pageUrl: "https://forum.example.org/posts/1", postedAt: "2023-07-19T15:00:00.000Z", contents: { plaintextDescription: "Desc" } },
    ]);
    assert.equal(items[0].link, "https://forum.example.org/posts/1");
    assert.equal(items[0].summary, "Desc");
  });

  it("keeps a historical news item only if a key phrase is in its headline", () => {
    const base = { link: "https://n.example.com/a", summary: "AI safety mentioned in passing", published: new Date() };
    assert.equal(keepHistoryNewsItem({ ...base, title: "Senate hearing on superintelligence risk" }), true);
    assert.equal(keepHistoryNewsItem({ ...base, title: "City council approves budget" }), false);
  });
});
