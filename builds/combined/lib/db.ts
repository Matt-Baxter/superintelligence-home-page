import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

// Isolated Postgres client for builds/combined (REQ-009..REQ-016).
// Scopes every table to DB_SCHEMA (default: si_combined) so it shares Neon safely without
// colliding with Build A or Build B tables in public.*.

function loadWorkspaceEnvIfNeeded(): void {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return;
  for (const candidate of [
    join(process.cwd(), ".env.development.local"),
    join(process.cwd(), "..", "..", ".env.development.local"),
  ]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return;
    }
  }
}

export function resolveSchemaName(): string {
  const name = process.env.DB_SCHEMA || "si_combined";
  if (!/^[a-z_][a-z0-9_]{1,40}$/.test(name)) {
    throw new Error(`Invalid DB_SCHEMA "${name}"`);
  }
  return name;
}

declare global {
  var __siCombinedSql: ReturnType<typeof postgres> | undefined;
  var __siCombinedBootstrapped: Set<string> | undefined;
}

function createClient(): ReturnType<typeof postgres> {
  loadWorkspaceEnvIfNeeded();
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to Postgres.");
  }
  return postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
}

export const sql: ReturnType<typeof postgres> = new Proxy((() => {}) as unknown as ReturnType<typeof postgres>, {
  apply(_target, _thisArg, args) {
    globalThis.__siCombinedSql ??= createClient();
    return (globalThis.__siCombinedSql as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop, receiver) {
    globalThis.__siCombinedSql ??= createClient();
    const val = Reflect.get(globalThis.__siCombinedSql, prop, receiver);
    return typeof val === "function" ? val.bind(globalThis.__siCombinedSql) : val;
  },
});

// Safe dynamic schema identifier for queries: SELECT * FROM ${S()}.stories
export function S() {
  return sql(resolveSchemaName());
}

export async function ensureSchema(): Promise<void> {
  const schemaName = resolveSchemaName();
  globalThis.__siCombinedBootstrapped ??= new Set<string>();
  if (globalThis.__siCombinedBootstrapped.has(schemaName)) return;

  const schemaPath = join(process.cwd(), "db", "schema.sql");
  const ddl = readFileSync(schemaPath, "utf8").replaceAll("__SCHEMA__", schemaName);
  await sql.unsafe(ddl);
  globalThis.__siCombinedBootstrapped.add(schemaName);
}
