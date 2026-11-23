// Runs the full app (extended profile) against the project's Neon Postgres database, with live feeds.
// Non-destructive: tables are created if missing, nothing is dropped, and no demo accounts with known
// passwords are seeded (this database may be shared with the deployed site). The first account to sign up
// on an empty database becomes the admin. After each harvest the knowledge graph is rebuilt from new stories.
const fs = require("node:fs");
const path = require("node:path");

const envFile = path.join(__dirname, "..", "..", "..", ".env.development.local");
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && fs.existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error("No DATABASE_URL: connect the Neon integration or set DATABASE_URL.");
  process.exit(1);
}
process.env.SITE_PROFILE ||= "extended";

const jrBundle = path.join(__dirname, "..", "public", "js", "jr.js");
const adminModulePage = path.join(__dirname, "..", "public", "m", "admin.html");
if (!fs.existsSync(jrBundle) || !fs.existsSync(adminModulePage)) {
  require("./build-extended");
}

const { app, db, boot, harvester } = require("../server");
const FETCH_MINUTES = Number(process.env.FETCH_MINUTES ?? 30);

async function harvestAndIndex(trigger) {
  try {
    const r = await harvester.harvest({ trigger });
    if (r.sources) console.log(`Harvest: ${r.ok} ok, ${r.errors} errors, ${r.stored} new stories`);
    const k = await app.locals.knowledgeBuild?.(500);
    if (k) console.log(`Knowledge graph: ${k.stories} stories, ${k.chunks_changed} chunks changed, ${k.edges} edges`);
  } catch (e) {
    console.error("Harvest or graph build failed:", e.message);
  }
}

const port = Number(process.env.PORT || 3200);
const server = app.listen(port, () => {
  console.log(`Superintelligence Homepage on http://localhost:${port} (${db.engine}, Neon)`);
});
server.on("error", (err) => {
  console.error(`Failed to listen on port ${port}:`, err.message);
  process.exit(1);
});

async function bootWithRetry(attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await boot();
      const users = (await db.get("SELECT COUNT(*) AS n FROM users")).n;
      if (!users) console.log("No accounts yet: the first account created becomes the admin.");
      if (FETCH_MINUTES > 0) {
        harvestAndIndex("schedule");
        setInterval(() => harvestAndIndex("schedule"), FETCH_MINUTES * 60e3).unref();
      } else {
        harvestAndIndex("startup");
      }
      return;
    } catch (e) {
      console.error(`Boot attempt ${i}/${attempts} failed:`, e.message);
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, i * 1500));
    }
  }
}

bootWithRetry();
