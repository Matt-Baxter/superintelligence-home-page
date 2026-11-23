import { test, expect, type APIRequestContext } from "@playwright/test";
import { resetDatabase, testDb } from "./helpers";

// Build A only (research §16): the history fill reads sample archives (a full feed, a paged blog,
// a Substack-style archive, a forum API, a month of news search) and runs them through the same
// keyword filter, fake AI judge and daily cap as daily news.

async function runHistory(request: APIRequestContext) {
  const res = await request.get("/api/cron/history", { headers: { Authorization: "Bearer test-secret" } });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe("Build A: history fill back to 2023", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("historical stories from every kind of archive appear, judged like daily news", async ({ page, request }) => {
    const result = await runHistory(request);
    expect(result.history.tasksFailed).toBe(0);
    expect(result.history.tasksRemaining).toBe(0);
    expect(result.judge.remaining).toBe(0);
    expect(result.finished).toBe(true);

    await page.goto("/");
    const titles = await page.locator("article.story h2").allTextContents();
    for (const t of [
      "Sample: Introducing a Historical Frontier Model", // full feed
      "Sample: Interpretability Research Update, Early 2023", // paged blog
      "Sample: Scaling Laws Revisited", // Substack-style archive
      "Sample: A Top Alignment Post from 2023", // forum API
      "Sample: Senate Hearing on Superintelligence Risk", // month of news search
    ]) {
      expect(titles, t).toContain(t);
    }
    // Judged below 8 by the fake judge: hidden.
    expect(titles.join("\n")).not.toContain("Minor Update");
    // Before 2023: skipped.
    expect(titles.join("\n")).not.toContain("Before the History Window");
    expect(titles.join("\n")).not.toContain("Older Blog Post");
    // A historical news headline without a key phrase: skipped.
    expect(titles.join("\n")).not.toContain("City Council");
  });

  test("running it again adds nothing and creates no duplicates", async ({ request }) => {
    await runHistory(request);
    const [{ count: before }] = await testDb()`SELECT count(*)::int AS count FROM stories`;
    const again = await runHistory(request);
    expect(again.history.tasksRun).toBe(0);
    expect(again.history.storiesAdded).toBe(0);
    const [{ count: after }] = await testDb()`SELECT count(*)::int AS count FROM stories`;
    expect(after).toBe(before);
  });

  test("the history endpoint refuses callers without the secret", async ({ request }) => {
    const res = await request.get("/api/cron/history");
    expect(res.status()).toBe(401);
  });
});
