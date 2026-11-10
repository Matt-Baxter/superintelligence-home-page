// Starts the server on a throwaway SQLite database preloaded with SYNTHETIC sample feeds (test/fixtures).
// Used by the browser test and for local demos while live feeds are unreachable. Never point this at production data.
require("./sample-clock"); // the fixtures' week stays "this week" (SAMPLE_NOW=real to turn off)
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
process.env.DATA_DIR = process.env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "si-test-"));
process.env.SITE_PROFILE = process.env.SITE_PROFILE || "extended"; // the browser test covers every feature; preflight checks the spec version
process.env.FETCH_MINUTES = "0";
process.env.ALLOW_FIXTURE_FEEDS = "1";
process.env.SOURCE_CATALOG = require("node:path").join(__dirname, "fixtures", "sample-catalog.json");
const { app, db, ingestItems, boot } = require("../server");
const feeds = require("../lib/feeds");
const { shiftItems } = require("./fixture-dates"); // fixture dates move forward to the last few days, so tests never depend on today
(async () => {
  await boot();
  const add = async (name, kind, format, file) => {
    // Re-runnable on an existing DATA_DIR: reuse the fixture source if this database already has it.
    const have = await db.get("SELECT id FROM sources WHERE url = ?", "fixture://" + file);
    const id = have ? have.id : await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, "fixture://" + file);
    const items = shiftItems(feeds.parse(format, fs.readFileSync(path.join(__dirname, "fixtures", file), "utf8")));
    await ingestItems(id, items);
    await db.run("UPDATE sources SET last_ok = ?, last_count = ? WHERE id = ?", db.now(), items.length, id);
  };
  await add("Sample arXiv feed (test data)", "papers", "arxiv", "sample-atom.xml");
  await add("Sample lab blog (test data)", "lab", "rss", "sample-rss.xml");
  await add("Sample daily papers (test data)", "papers", "hf-daily", "sample-hf.json");
  // FIXTURE_SET=spec adds labelled sources across every kind the shared spec names (test/fixtures/spec), for the
  // spec acceptance suite (test/spec-acceptance.js): 9 sources, 7 kinds, a re-published paper, a Twitter/X link, off-topic items.
  if (process.env.FIXTURE_SET === "spec") {
    await add("Sample mixed feed (test data)", "news", "rss", "sample-spec.xml");
    await add("Sample alignment forum (test data)", "forum", "rss", "spec/forum.xml");
    await add("Sample AI newsletter (test data)", "newsletter", "rss", "spec/newsletter.xml");
    await add("Sample forecasting org (test data)", "research-org", "rss", "spec/forecasting.xml");
    await add("Sample safety group (test data)", "research-org", "rss", "spec/safety.xml");
    await add("Sample governance group (test data)", "policy", "rss", "spec/policy.xml");
  }
  // Real default sources stay listed but paused here, since the test machine may not reach them.
  await db.run("UPDATE sources SET status = 'paused' WHERE url NOT LIKE 'fixture://%'");
  if (process.env.DEMO_ACCOUNTS === "1") {
    if (process.env.NODE_ENV === "production") throw new Error("Demo accounts are only for local testing.");
    const crypto = require("node:crypto");
    const accounts = [{ role: "reader", username: "demo-reader", password: "local-reader-2026" }, { role: "admin", username: "demo-admin", password: "local-admin-2026" }];
    for (const account of accounts) {
      if (await db.get("SELECT id FROM users WHERE username = ?", account.username)) throw new Error("Use a fresh DATA_DIR for the demo.");
      const salt = crypto.randomBytes(16).toString("hex"), hash = salt + ":" + crypto.scryptSync(account.password, salt, 64).toString("hex");
      await db.insert("INSERT INTO users (username, display_name, pass_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?)", account.username, `Sample ${account.role} (test data)`, hash, account.role === "admin" ? 1 : 0, db.now());
    }
    app.locals.demo = { accounts };
  }
  const port = Number(process.env.PORT || 3200);
  app.listen(port, process.env.DEMO_ACCOUNTS === "1" ? "127.0.0.1" : undefined, () => console.log(`Test server with sample data on http://localhost:${port} (${db.engine}, data in ${process.env.DATA_DIR})`));
})();
