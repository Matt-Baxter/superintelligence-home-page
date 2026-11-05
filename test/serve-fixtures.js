// Starts the server on a throwaway database preloaded with SYNTHETIC sample feeds (test/fixtures).
// Used by the browser test and for local demos while live feeds are unreachable. Never point this at production data.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
process.env.DATA_DIR = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "si-test-"));
process.env.FETCH_MINUTES = "0";
const { app, db, ingestItems, seedSources } = require("../server");
const feeds = require("../lib/feeds");
seedSources();
const add = (name, kind, format, file) => {
  const id = Number(db.prepare("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')").run(name, kind, format, "fixture://" + file).lastInsertRowid);
  const items = feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8"));
  ingestItems(id, items);
  db.prepare("UPDATE sources SET last_ok = ?, last_count = ? WHERE id = ?").run(new Date().toISOString(), items.length, id);
};
add("Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml");
add("Sample lab blog (test data)", "lab", "rss", "sample-rss.xml");
add("Sample daily papers (test data)", "papers", "hf-daily", "sample-hf.json");
// Real default sources stay listed but paused here, since this sandbox can't reach them.
db.prepare("UPDATE sources SET status = 'paused' WHERE url NOT LIKE 'fixture://%'").run();
const port = Number(process.env.PORT || 3200);
app.listen(port, () => console.log(`Test server with sample data on http://localhost:${port} (data in ${process.env.DATA_DIR})`));
