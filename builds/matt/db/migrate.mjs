// Applies db/schema.sql and upserts the source list. Safe to run more than once.
// Uses SOURCES=fixtures to load the sample sources instead of the real ones (tests only).
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".env.local")) && !process.env.DATABASE_URL) {
  process.loadEnvFile(join(root, ".env.local"));
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}
const local = ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
const sql = postgres(url, { max: 1, ssl: local ? false : "require", onnotice: () => {} });

const sourcesFile = process.env.SOURCES === "fixtures" ? "tests/fixtures/sources.json" : "lib/sources.json";
const sources = JSON.parse(readFileSync(join(root, sourcesFile), "utf8"));

try {
  await sql.unsafe(readFileSync(join(root, "db/schema.sql"), "utf8"));
  for (const s of sources) {
    await sql`
      INSERT INTO sources (id, name, kind, feed_url)
      VALUES (${s.id}, ${s.name}, ${s.kind}, ${s.feedUrl})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, feed_url = EXCLUDED.feed_url`;
  }
  console.log(`Schema applied; ${sources.length} sources loaded from ${sourcesFile}.`);
} finally {
  await sql.end();
}
