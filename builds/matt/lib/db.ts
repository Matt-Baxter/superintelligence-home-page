import postgres from "postgres";

// Build A's database client (research §3). The same code talks to the live Neon database and
// the local test database. Always use the sql`...` template so values are sent as parameters,
// never pasted into the query text.

declare global {
  // Reuse one client across hot reloads in development.
  // eslint-disable-next-line no-var
  var __buildADb: ReturnType<typeof postgres> | undefined;
}

function isLocal(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  return postgres(url, {
    max: 5,
    ssl: isLocal(url) ? false : "require",
    onnotice: () => {},
  });
}

export const sql: ReturnType<typeof postgres> = globalThis.__buildADb ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__buildADb = sql;
}
