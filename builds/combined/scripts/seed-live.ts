import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  join(here, "..", ".env.development.local"),
  join(here, "..", "..", "..", ".env.development.local"),
]) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const { sql } = await import("../lib/db.ts");
const { fetchAllSources, judgePendingStories, seedDefaultSources } = await import("../lib/ingest.ts");
const { runHistoryStep } = await import("../lib/history.ts");

try {
  await seedDefaultSources();
  const historySummary = await runHistoryStep(6);
  console.log("Historical canon + archive backfill summary:", JSON.stringify(historySummary));
  const liveSummary = await fetchAllSources({ judgeLimit: 40 });
  console.log("Live harvest summary:", JSON.stringify(liveSummary));
  // Settle any remaining unjudged backlog deterministically so zero rows sit unjudged
  const prevJudge = process.env.JUDGE;
  process.env.JUDGE = "deterministic";
  const settledRest = await judgePendingStories(500);
  process.env.JUDGE = prevJudge;
  console.log("Deterministic backlog settlement:", JSON.stringify(settledRest));
} finally {
  await sql.end();
}
