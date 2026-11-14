import { test, expect, type Page } from "@playwright/test";
import { resetDatabase, runFetch, signUp, testDb } from "./helpers";

// User Story 3 — Vote on and save superintelligence stories (P2).
// Contract tests AT-10 to AT-12. Made-up usernames only.

const PASSWORD = "sample-password-1";
const LOSS = "Loss of Control";
const GOVERNANCE = "AI Governance";

function story(page: Page, titleText: string) {
  return page.locator("article.story").filter({ has: page.locator("h2", { hasText: titleText }) });
}

async function storyId(titleText: string): Promise<string> {
  const rows = await testDb()`SELECT id FROM stories WHERE title ILIKE ${"%" + titleText + "%"}`;
  expect(rows.length).toBe(1);
  return String(rows[0].id);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator(".site-header")).not.toContainText("Signed in as");
}

async function signIn(page: Page, username: string) {
  await page.goto("/signin");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".site-header")).toContainText(`Signed in as ${username}`);
}

test.describe("User Story 3: votes and saves", () => {
  test.beforeEach(async ({ request }) => {
    await resetDatabase();
    await runFetch(request);
  });

  test.describe("REQ-013: one vote per user per story", () => {
    test("voting raises the count by one; voting again removes it", async ({ page }) => {
      await signUp(page, "sample_ana", PASSWORD);
      const s = story(page, LOSS);
      await expect(s.locator(".vote-count")).toHaveText("0 votes");
      await s.getByRole("button", { name: "Vote" }).click();
      await expect(story(page, LOSS).locator(".vote-count")).toHaveText("1 vote");
      await expect(story(page, LOSS).getByRole("button", { name: "Remove vote" })).toBeVisible();
      await story(page, LOSS).getByRole("button", { name: "Remove vote" }).click();
      await expect(story(page, LOSS).locator(".vote-count")).toHaveText("0 votes");
    });

    test("vote totals count every user's votes", async ({ page }) => {
      await signUp(page, "sample_ben", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Vote" }).click();
      await signOut(page);
      await signUp(page, "sample_cy", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Vote" }).click();
      await expect(story(page, LOSS).locator(".vote-count")).toHaveText("2 votes");
    });
  });

  test.describe("REQ-013 / REQ-015 (AT-10): votes survive signing out", () => {
    test("user A's vote is still counted and shown as A's after signing back in", async ({ page }) => {
      await signUp(page, "sample_dot", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Vote" }).click();
      await expect(story(page, LOSS).locator(".vote-count")).toHaveText("1 vote");
      await signOut(page);
      await expect(story(page, LOSS).locator(".vote-count")).toHaveText("1 vote");
      await signIn(page, "sample_dot");
      await expect(story(page, LOSS).getByRole("button", { name: "Remove vote" })).toBeVisible();
    });
  });

  test.describe("REQ-014 / REQ-015 (AT-11): saves are kept per user", () => {
    test("users A and B each see only their own saved stories", async ({ page }) => {
      await signUp(page, "sample_eli", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Save", exact: true }).click();
      await expect(story(page, LOSS).getByRole("button", { name: "Unsave" })).toBeVisible();
      await signOut(page);

      await signUp(page, "sample_fay", PASSWORD);
      await story(page, GOVERNANCE).getByRole("button", { name: "Save", exact: true }).click();
      await page.goto("/saved");
      await expect(page.locator("article.story")).toHaveCount(1);
      await expect(story(page, GOVERNANCE)).toHaveCount(1);
      await signOut(page);

      await signIn(page, "sample_eli");
      await page.goto("/saved");
      await expect(page.locator("article.story")).toHaveCount(1);
      await expect(story(page, LOSS)).toHaveCount(1);
    });

    test("unsaving removes the story from the saved list", async ({ page }) => {
      await signUp(page, "sample_gil", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Save", exact: true }).click();
      await page.goto("/saved");
      await story(page, LOSS).getByRole("button", { name: "Unsave" }).click();
      await expect(page).toHaveURL("/saved");
      await expect(page.getByText("You haven't saved any stories yet.")).toBeVisible();
    });

    test("signed-out visitors are sent to sign in from the saved page", async ({ page }) => {
      await page.goto("/saved");
      await expect(page).toHaveURL(/\/signin/);
    });
  });

  test.describe("REQ-016 (AT-12): users can only change their own votes and saves", () => {
    test("a hand-made request naming another user can't change that user's vote or save", async ({ page }) => {
      await signUp(page, "sample_hana", PASSWORD);
      await story(page, LOSS).getByRole("button", { name: "Vote" }).click();
      await story(page, LOSS).getByRole("button", { name: "Save", exact: true }).click();
      const [hana] = await testDb()`SELECT id FROM users WHERE username = 'sample_hana'`;
      await signOut(page);

      await signUp(page, "sample_ivan", PASSWORD);
      const id = await storyId(LOSS);
      for (const action of ["vote", "save"]) {
        // Two posts: if the server trusted userId, the second would remove Hana's row.
        for (let i = 0; i < 2; i++) {
          await page.request.post(`/api/stories/${id}/${action}`, {
            form: { userId: String(hana.id), user_id: String(hana.id), returnTo: "/" },
            maxRedirects: 0,
          });
        }
      }
      const votes = await testDb()`SELECT user_id FROM votes WHERE story_id = ${id}`;
      const saves = await testDb()`SELECT user_id FROM saves WHERE story_id = ${id}`;
      expect(votes.map((v) => String(v.user_id))).toEqual([String(hana.id)]);
      expect(saves.map((s) => String(s.user_id))).toEqual([String(hana.id)]);
    });
  });

  test.describe("User Story 3, scenario 5: signed-out visitors can't vote or save", () => {
    test("voting or saving while signed out asks the visitor to sign in and records nothing", async ({ page }) => {
      await page.goto("/");
      await story(page, LOSS).getByRole("button", { name: "Vote" }).click();
      await expect(page).toHaveURL(/\/signin/);
      const id = await storyId(LOSS);
      const res = await page.request.post(`/api/stories/${id}/save`, { form: { returnTo: "/" }, maxRedirects: 0 });
      expect(res.status()).toBe(303);
      expect(res.headers()["location"]).toContain("/signin");
      const [{ count }] = await testDb()`SELECT (SELECT count(*) FROM votes) + (SELECT count(*) FROM saves) AS count`;
      expect(Number(count)).toBe(0);
    });
  });

  test.describe("Contract: unknown stories and unsafe return addresses", () => {
    test("voting on a story that doesn't exist returns 404", async ({ page }) => {
      await signUp(page, "sample_jo", PASSWORD);
      const res = await page.request.post("/api/stories/999999/vote", { form: { returnTo: "/" }, maxRedirects: 0 });
      expect(res.status()).toBe(404);
    });

    test("a return address on another site is ignored", async ({ page }) => {
      await signUp(page, "sample_kim", PASSWORD);
      const id = await storyId(LOSS);
      const res = await page.request.post(`/api/stories/${id}/vote`, {
        form: { returnTo: "//evil.example.com/" },
        maxRedirects: 0,
      });
      expect(res.status()).toBe(303);
      expect(new URL(res.headers()["location"]).host).toBe(new URL(page.url()).host);
    });
  });
});
