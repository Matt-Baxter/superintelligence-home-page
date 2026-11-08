// Disposable, loopback-only demonstration. Never uses an existing or hosted database.
if (process.env.NODE_ENV === "production") throw new Error("The demo is only for local testing.");
process.env.DATA_DIR = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "si-demo-"));
process.env.DEMO_ACCOUNTS = "1";
require("./serve-fixtures");
