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
    expect(low.ai_score).toBe(4);
    await page.goto("/");
    await expect(page.locator("article.story")).not.toHaveCount(0);
    await expect(page.getByText("Minor Note Mentioning AI Safety")).toHaveCount(0);
  });

  test("each shown story has its score and reason, labelled as an AI assessment", async ({ page }) => {
    await page.goto("/");
    const scores = await page.locator("article.story .ai-score").allTextContents();
    const storyCount = await page.locator("article.story").count();
    expect(scores.length).toBe(storyCount);
    expect(scores.every((s) => /^AI significance: (8|9|10)\/10$/.test(s))).toBe(true);
    const first = page.locator("article.story .ai-assessment").first();
    await expect(first.locator(".ai-reason")).toHaveText("Sample assessment: a significant development for testing.");
    await expect(first.locator(".ai-label")).toContainText("AI assessment");
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
