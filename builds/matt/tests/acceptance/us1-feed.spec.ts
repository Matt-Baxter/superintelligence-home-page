import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { resetDatabase, runFetch, testDb } from "./helpers";

// User Story 1 — Read a superintelligence feed (P1).
// Contract tests AT-01 to AT-06 and AT-15, using the saved sample feeds in tests/fixtures/.

const pixelLog = join(__dirname, "..", "fixtures", "pixel-hits.log");
const WORKING_SAMPLE_SOURCES = [
  "Sample arXiv",
  "Sample Frontier Lab",
  "Sample Safety Group",
  "Sample Research Org",
  "Sample Forum A",
  "Sample Forum B",
  "Sample Newsletter A",
  "Sample Newsletter B",
];

function story(page: Page, titleText: string | RegExp) {
  return page.locator("article.story").filter({ has: page.locator("h2", { hasText: titleText }) });
}

test.describe("User Story 1: superintelligence feed", () => {
  let fetchResult: { fetched: number; failed: number; stories: number };

  test.beforeEach(async ({ request }) => {
    rmSync(pixelLog, { force: true });
    await resetDatabase();
    fetchResult = await runFetch(request);
  });

  test.describe("REQ-001 / REQ-002 (AT-01): stories from many sources, newest first", () => {
    test("stories from all 8 working sample sources appear", async ({ page }) => {
      await page.goto("/");
      const sourceNames = await page.locator("article.story .sources li").allTextContents();
      for (const name of WORKING_SAMPLE_SOURCES) {
        expect(sourceNames.some((s) => s.includes(name)), `missing source ${name}`).toBe(true);
      }
    });

    test("stories are sorted newest first", async ({ page }) => {
      await page.goto("/");
      const dates = await page.locator("article.story").evaluateAll((els) =>
        els.map((el) => Date.parse(el.getAttribute("data-published") ?? "")),
      );
      expect(dates.length).toBeGreaterThan(5);
      expect(dates.every((d) => !Number.isNaN(d))).toBe(true);
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  });

  test.describe("REQ-003 (AT-02): only superintelligence stories", () => {
    test("the AI photo-editing item is left out", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("article.story")).not.toHaveCount(0);
      await expect(page.getByText(/photo-editing/i)).toHaveCount(0);
    });
  });

  test.describe("REQ-004 (AT-03): duplicates grouped into one story", () => {
    test("the paper in three sources appears once, listing all three", async ({ page }) => {
      await page.goto("/");
      const paper = page.locator("article.story").filter({
        has: page.locator(".sources li", { hasText: "Sample arXiv" }),
      }).filter({ has: page.locator(".sources li", { hasText: "Sample Research Org" }) });
      await expect(paper).toHaveCount(1);
      await expect(paper.locator(".sources li")).toHaveCount(3);
      await expect(paper.locator(".sources li", { hasText: "Sample Forum A" })).toHaveCount(1);
      // No other story is about the same paper.
      await expect(page.locator("article.story h2", { hasText: /scalable oversight/i })).toHaveCount(1);
    });
  });

  test.describe("REQ-005 (AT-04): topics show the words that matched", () => {
    test('the "AGI timelines" story shows Forecasting & timelines and the matched words', async ({ page }) => {
      await page.goto("/");
      const s = story(page, "AGI Timelines");
      await expect(s).toHaveCount(1);
      const topic = s.locator(".topics li", { hasText: "Forecasting & timelines" });
      await expect(topic).toHaveCount(1);
      await expect(topic).toContainText("AGI timelines");
    });

    test("every story has at least one topic", async ({ page }) => {
      await page.goto("/");
      const counts = await page.locator("article.story").evaluateAll((els) =>
        els.map((el) => el.querySelectorAll(".topics li").length),
      );
      expect(counts.length).toBeGreaterThan(0);
      expect(counts.every((n) => n > 0)).toBe(true);
    });
  });

  test.describe("REQ-006 (AT-05): no Twitter/X", () => {
    test("the item linking to x.com is left out", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("Thread on Alignment Research")).toHaveCount(0);
      await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
    });
  });

  test.describe("REQ-007: link out, no full article text", () => {
    test("each story title links to its original and summaries are at most 300 characters", async ({ page }) => {
      await page.goto("/");
      const s = story(page, "Loss of Control");
      await expect(s.locator("h2 a")).toHaveAttribute("href", "https://safety.example.org/posts/loss-of-control");
      const lengths = await page.locator("article.story .summary").allTextContents();
      expect(lengths.every((t) => Array.from(t).length <= 300)).toBe(true);
    });
  });

  test.describe("REQ-008 (AT-06): a failing source doesn't break the feed", () => {
    test("the feed loads although one sample source is unreachable", async ({ page }) => {
      expect(fetchResult.failed).toBe(1);
      expect(fetchResult.fetched).toBe(8);
      await page.goto("/");
      await expect(page.locator("article.story")).not.toHaveCount(0);
      const [row] = await testDb()`SELECT last_error FROM sources WHERE id = 'sample-down'`;
      expect(row.last_error).toBeTruthy();
    });
  });

  test.describe("REQ-021 (AT-15): feed text is plain text", () => {
    test("script and image tags in a summary don't run or load, and the summary reads as text", async ({ page }) => {
      const dialogs: string[] = [];
      page.on("dialog", async (d) => {
        dialogs.push(d.message());
        await d.dismiss();
      });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const s = story(page, "AI Safety Evaluations");
      await expect(s).toHaveCount(1);
      await expect(s.locator(".summary")).toContainText("How we run AI safety evaluations before release.");
      await expect(s.locator("script, img")).toHaveCount(0);
      expect(dialogs).toEqual([]);
      expect(existsSync(pixelLog) ? readFileSync(pixelLog, "utf8") : "").toBe("");
    });
  });
});

test.describe("User Story 1: empty feed (Edge Cases)", () => {
  test("before any fetch, the feed shows a friendly empty message", async ({ page }) => {
    await resetDatabase();
    await page.goto("/");
    await expect(page.getByText("No superintelligence stories yet.")).toBeVisible();
  });
});
