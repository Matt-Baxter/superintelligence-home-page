// Starts the server on a throwaway SQLite database preloaded with SYNTHETIC sample feeds (test/fixtures).
// Used by the browser test and for local demos while live feeds are unreachable. Never point this at production data.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
process.env.DATA_DIR = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "si-test-"));
process.env.FETCH_MINUTES = "0";
const { app, db, ingestItems, boot } = require("../server");
const feeds = require("../lib/feeds");
(async () => {
  await boot();
  const add = async (name, kind, format, file) => {
    const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, "fixture://" + file);
    const items = feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8"));
    await ingestItems(id, items);
    await db.run("UPDATE sources SET last_ok = ?, last_count = ? WHERE id = ?", db.now(), items.length, id);
  };
  await add("Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml");
  await add("Sample lab blog (test data)", "lab", "rss", "sample-rss.xml");
  await add("Sample daily papers (test data)", "papers", "hf-daily", "sample-hf.json");
  // Real default sources stay listed but paused here, since the test machine may not reach them.
  await db.run("UPDATE sources SET status = 'paused' WHERE url NOT LIKE 'fixture://%'");
  const port = Number(process.env.PORT || 3200);
  app.listen(port, () => console.log(`Test server with sample data on http://localhost:${port} (${db.engine}, data in ${process.env.DATA_DIR})`));
})();
