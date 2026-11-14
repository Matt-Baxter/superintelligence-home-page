import { test, expect } from "@playwright/test";
import { resetDatabase, signUp, testDb } from "./helpers";

// User Story 2 — Create an account and stay signed in (P1).
// Contract tests AT-07 to AT-09. Made-up usernames only.

const PASSWORD = "sample-password-1";

test.describe("User Story 2: accounts", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test.describe("REQ-009 (AT-07): sign up with an unused username", () => {
    test("the new user is signed in and sees their username", async ({ page }) => {
      await signUp(page, "sample_ada", PASSWORD);
      await expect(page).toHaveURL("/");
      await expect(page.locator(".site-header")).toContainText("Signed in as sample_ada");
    });
  });

  test.describe("REQ-009 (AT-08): a taken username is refused", () => {
    test("signing up with a taken username (any capitals) fails and creates no second account", async ({ page }) => {
      await signUp(page, "sample_bob", PASSWORD);
      await page.getByRole("button", { name: "Sign out" }).click();
      await signUp(page, "SAMPLE_BOB", "another-password-2");
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.getByRole("alert")).toHaveText("That username is taken.");
      const [{ count }] = await testDb()`SELECT count(*)::int AS count FROM users WHERE lower(username) = 'sample_bob'`;
      expect(count).toBe(1);
    });
  });

  test.describe("REQ-009: invalid input names the field and creates no account", () => {
    for (const [username, password, field] of [
      ["ab", PASSWORD, "Username"],
      ["a".repeat(31), PASSWORD, "Username"],
      ["bad name!", PASSWORD, "Username"],
      ["sample_carol", "short", "Password"],
    ] as const) {
      test(`${field.toLowerCase()} rule: "${username.slice(0, 12)}" / ${password.length}-character password`, async ({ page }) => {
        await signUp(page, username, password);
        await expect(page).toHaveURL(/\/signup/);
        await expect(page.getByRole("alert")).toContainText(field);
        const [{ count }] = await testDb()`SELECT count(*)::int AS count FROM users`;
        expect(count).toBe(0);
      });
    }
  });

  test.describe("REQ-010 (AT-09): stay signed in between visits", () => {
    test("a new browser session with the saved cookie is still signed in", async ({ page, browser }) => {
      await signUp(page, "sample_dee", PASSWORD);
      const state = await page.context().storageState();
      const session = state.cookies.find((c) => c.name === "session");
      expect(session, "session cookie").toBeTruthy();
      expect(session!.httpOnly).toBe(true);
      const days = (session!.expires * 1000 - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);

      const nextVisit = await browser.newContext({ storageState: state });
      const again = await nextVisit.newPage();
      await again.goto("/");
      await expect(again.locator(".site-header")).toContainText("Signed in as sample_dee");
      await nextVisit.close();
    });

    test("signing in with the right password works", async ({ page }) => {
      await signUp(page, "sample_eve", PASSWORD);
      await page.getByRole("button", { name: "Sign out" }).click();
      await page.goto("/signin");
      await page.getByLabel("Username").fill("Sample_Eve");
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL("/");
      await expect(page.locator(".site-header")).toContainText("Signed in as sample_eve");
    });

    test("signing out ends the session", async ({ page }) => {
      await signUp(page, "sample_finn", PASSWORD);
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page.locator(".site-header")).toContainText("Sign in");
      await expect(page.locator(".site-header")).not.toContainText("Signed in as");
      const [{ count }] = await testDb()`SELECT count(*)::int AS count FROM sessions`;
      expect(count).toBe(0);
    });
  });

  test.describe("User Story 2, scenario 4: sign-in errors don't reveal usernames", () => {
    test("a wrong password and an unknown username show the same message", async ({ page }) => {
      await signUp(page, "sample_gus", PASSWORD);
      await page.getByRole("button", { name: "Sign out" }).click();
      for (const [username, password] of [
        ["sample_gus", "wrong-password-9"],
        ["sample_nobody", "wrong-password-9"],
      ]) {
        await page.goto("/signin");
        await page.getByLabel("Username").fill(username);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/signin/);
        await expect(page.getByRole("alert")).toHaveText("Username or password is incorrect.");
      }
    });
  });

  test.describe("REQ-011: passwords are never readable", () => {
    test("the stored password is a hash and never shown on a page", async ({ page }) => {
      await signUp(page, "sample_hal", PASSWORD);
      const [user] = await testDb()`SELECT password_hash FROM users WHERE username = 'sample_hal'`;
      expect(user.password_hash).not.toContain(PASSWORD);
      expect(user.password_hash.length).toBeGreaterThan(40);
      expect(await page.content()).not.toContain(PASSWORD);
      const [s] = await testDb()`SELECT token_hash FROM sessions`;
      const cookie = (await page.context().cookies()).find((c) => c.name === "session");
      expect(s.token_hash).not.toBe(cookie!.value);
    });
  });

  test.describe("REQ-012: no personal data beyond a username and password", () => {
    test("the users table holds only id, username, password hash and created date", async () => {
      const cols = await testDb()`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name`;
      expect(cols.map((c) => c.column_name)).toEqual(["created_at", "id", "password_hash", "username"]);
    });
  });
});
