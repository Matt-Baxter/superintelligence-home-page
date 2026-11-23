import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  join(here, "..", ".env.development.local"),
  join(here, "..", "..", "..", ".env.development.local"),
]) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const schemaName = process.env.DB_SCHEMA || "si_combined";
if (!/^[a-z_][a-z0-9_]{1,40}$/.test(schemaName)) {
  console.error(`Invalid DB_SCHEMA: ${schemaName}`);
  process.exit(1);
}

const rawSql = readFileSync(join(here, "schema.sql"), "utf8");
const ddl = rawSql.replaceAll("__SCHEMA__", schemaName);

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(ddl);
  console.log(`Database schema "${schemaName}" is up to date.`);
} finally {
  await sql.end();
}
