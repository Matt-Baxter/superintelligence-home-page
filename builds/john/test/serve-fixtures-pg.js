// Same as serve-fixtures.js but against a Postgres database (DATABASE_URL must point at a throwaway test database).
require("./sample-clock"); // the fixtures' week stays "this week" (SAMPLE_NOW=real to turn off)
if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL to a throwaway Postgres database."); process.exit(1); }
process.env.SITE_PROFILE = process.env.SITE_PROFILE || "extended"; // the browser test covers every feature; preflight checks the spec version
process.env.FETCH_MINUTES = "0";
process.env.ALLOW_FIXTURE_FEEDS = "1";
process.env.SOURCE_CATALOG = require("node:path").join(__dirname, "fixtures", "sample-catalog.json");
const fs = require("node:fs"), path = require("node:path");
const { app, db, ingestItems, boot } = require("../server");
const feeds = require("../lib/feeds");
const { shiftItems } = require("./fixture-dates"); // fixture dates move forward to the last few days, so tests never depend on today
(async () => {
  await db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await boot();
  const add = async (name, kind, format, file) => {
    const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, "fixture://" + file);
    const items = shiftItems(feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8")));
    await ingestItems(id, items);
    await db.run("UPDATE sources SET last_ok = ?, last_count = ? WHERE id = ?", db.now(), items.length, id);
  };
  await add("Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml");
  await add("Sample lab blog (test data)", "lab", "rss", "sample-rss.xml");
  await add("Sample daily papers (test data)", "papers", "hf-daily", "sample-hf.json");
  await db.run("UPDATE sources SET status = 'paused' WHERE url NOT LIKE 'fixture://%'");
  const port = Number(process.env.PORT || 3300);
  app.listen(port, () => console.log(`Postgres test server on http://localhost:${port} (${db.engine})`));
})().catch((e) => { console.error(e); process.exit(1); });
