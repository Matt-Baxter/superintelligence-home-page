// Loopback-only demo, with a dedicated local SQLite database.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (process.env.NODE_ENV === "production") throw new Error("The demo is only for local testing.");
const fresh = process.env.DEMO_FRESH === "1";
const data = path.join(__dirname, "..", "out", "demo-data");
process.env.DATA_DIR = fresh ? fs.mkdtempSync(path.join(os.tmpdir(), "si-demo-")) : data;
fs.mkdirSync(process.env.DATA_DIR, { recursive: true, mode: 0o700 });
process.env.DEMO_ACCOUNTS = "1";
process.env.FIXTURE_SET ||= "spec";
require("./serve-fixtures");
