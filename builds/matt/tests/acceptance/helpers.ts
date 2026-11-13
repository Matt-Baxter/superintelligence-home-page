import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Test helpers. Tests only ever use the local test database with made-up users and the
// saved sample feeds (constitution IV).

const root = join(__dirname, "..", "..");
const sources: { id: string; name: string; kind: string; feedUrl: string }[] = JSON.parse(
  readFileSync(join(root, "tests/fixtures/sources.json"), "utf8"),
);

let db: ReturnType<typeof postgres> | undefined;
export function testDb() {
  db ??= postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  return db;
}

// Empties every table (including sources, so no real source rows linger) and reloads the
// sample sources.
export async function resetDatabase() {
  const sql = testDb();
  await sql`TRUNCATE users, sessions, sources, stories, story_topics, story_sources, story_keys, votes, saves RESTART IDENTITY CASCADE`;
  for (const s of sources) {
    await sql`INSERT INTO sources (id, name, kind, feed_url) VALUES (${s.id}, ${s.name}, ${s.kind}, ${s.feedUrl})`;
  }
}

// Runs one fetch of every sample source through the app's scheduled endpoint.
export async function runFetch(request: APIRequestContext) {
  const res = await request.get("/api/cron/fetch", {
    headers: { Authorization: "Bearer test-secret" },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

// Signs up a made-up user through the real sign-up form.
export async function signUp(page: Page, username: string, password = "sample-password-1") {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
}
