import { test, expect, type Page } from "@playwright/test";
import { resetDatabase, runFetch, testDb } from "./helpers";

// Build A only (Build A plan; research §14–15): the AI significance judge and Google News sources.
// Tests use the fake judge (JUDGE=fixtures): titles containing "Minor" score 4, everything else 9.
// No real AI calls are made.

function story(page: Page, titleText: string) {
  return page.locator("article.story").filter({ has: page.locator("h2", { hasText: titleText }) });
}

test.describe("Build A: AI significance judge", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase();
    const result = await runFetch(request);
    expect(result.judge.mode).toBe("fixtures");
    expect(result.judge.remaining).toBe(0);
  });

  test("stories scoring below 8 are hidden from the feed", async ({ page }) => {
    const [low] = await testDb()`SELECT ai_score FROM stories WHERE title ILIKE '%Minor Note%'`;
    expect(Number(low.ai_score)).toBe(4.2);
    await page.goto("/");
    await expect(page.locator("article.story")).not.toHaveCount(0);
    await expect(page.getByText("Minor Note Mentioning AI Safety")).toHaveCount(0);
  });

  test("each shown story has its score (one decimal) and reason, labelled as an AI assessment", async ({ page }) => {
    await page.goto("/");
    const scores = await page.locator("article.story .ai-score").allTextContents();
    const storyCount = await page.locator("article.story").count();
    expect(scores.length).toBe(storyCount);
    // One decimal place, and never below 8.0.
    expect(scores.every((s) => /^AI significance: (8\.\d|9\.\d|10\.0)\/10$/.test(s))).toBe(true);
    const first = page.locator("article.story .ai-assessment").first();
    await expect(first.locator(".ai-reason")).toHaveText("Sample assessment: a significant development for testing.");
    await expect(first.locator(".ai-label")).toContainText("AI assessment");
  });
});

test.describe("Build A: daily cap (top 5 per day)", () => {
  test("at most 5 stories appear per day: the highest scores, ties broken by number of sources", async ({ page, request }) => {
    await resetDatabase();
    await runFetch(request);
    const db = testDb();
    // Seven extra judged stories, all on one day (Nov 20, Central time).
    const day = "2026-11-20T18:00:00Z";
    const extra: [string, number][] = [
      ["Sample: Cap Test Score Ten", 10],
      ["Sample: Cap Test Score Nine A", 9.4],
      ["Sample: Cap Test Score Nine B", 9.4],
      ["Sample: Cap Test Score Eight Two Sources", 8.3],
      ["Sample: Cap Test Score Eight One Source A", 8.3],
      ["Sample: Cap Test Score Eight One Source B", 8.3],
      ["Sample: Cap Test Score Seven", 7.9],
    ];
    const ids: Record<string, string> = {};
    for (const [title, score] of extra) {
      const [row] = await db`
        INSERT INTO stories (title, url, summary, published_at, ai_score, ai_reason, ai_model, judged_at)
        VALUES (${title}, ${"https://example.com/" + encodeURIComponent(title)}, '', ${day}, ${score}, 'Sample assessment.', 'fixture-judge', now())
        RETURNING id`;
      ids[title] = String(row.id);
      await db`INSERT INTO story_sources (story_id, source_id, url) VALUES (${row.id}, 'sample-forum-a', ${"https://example.com/a/" + row.id})`;
    }
    await db`INSERT INTO story_sources (story_id, source_id, url)
      VALUES (${ids["Sample: Cap Test Score Eight Two Sources"]}, 'sample-forum-b', 'https://example.com/b/two')`;

    await page.goto("/");
    const shown = (await page.locator("article.story h2").allTextContents()).filter((t) => t.includes("Cap Test"));
    expect(shown).toHaveLength(5);
    expect(shown).toContain("Sample: Cap Test Score Ten");
    expect(shown).toContain("Sample: Cap Test Score Nine A");
    expect(shown).toContain("Sample: Cap Test Score Nine B");
    expect(shown).toContain("Sample: Cap Test Score Eight Two Sources");
    expect(shown).not.toContain("Sample: Cap Test Score Seven");
    // Exactly one of the two single-source 8s fits in the last slot.
    expect(shown.filter((t) => t.includes("One Source"))).toHaveLength(1);
  });
});

test.describe("Build A: Google News sources", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase();
    await runFetch(request);
  });

  test("news items show their outlet and a clean headline without the outlet suffix", async ({ page }) => {
    await page.goto("/");
    const s = story(page, "Lab Publishes Frontier Model Safety Framework");
    await expect(s).toHaveCount(1);
    await expect(s.locator("h2")).toHaveText("Sample: Lab Publishes Frontier Model Safety Framework");
    await expect(s.locator(".sources li")).toHaveText("Sample Times (via Google News)");
    // The search summary only repeated the headline, so no summary is shown.
    await expect(s.locator(".summary")).toHaveCount(0);
  });

  test("REQ-006: a news item whose outlet is X/Twitter is left out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Post About AGI Timelines")).toHaveCount(0);
  });
});
