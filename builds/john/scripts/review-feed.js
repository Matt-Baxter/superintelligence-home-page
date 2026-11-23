// Read a manifest of local feed snapshots and print a review report as JSON.
const fs = require("node:fs");
const path = require("node:path");
const { FORMATS, parse } = require("../lib/feeds");
const { reviewFeedItems } = require("../lib/relevance-review");

try {
  const manifest = process.argv[2];
  if (!manifest) throw new Error("Usage: node scripts/review-feed.js <snapshot-manifest.json>");
  const sources = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const entries = sources.flatMap(({ name, url, format, file }) => {
    if (!name || !file || !Object.hasOwn(FORMATS, format)) throw new Error("Each snapshot requires name, format and file.");
    const snapshot = fs.readFileSync(path.resolve(path.dirname(manifest), file), "utf8");
    return parse(format, snapshot).map(item => ({ source: { name, url }, item }));
  });
  console.log(JSON.stringify(reviewFeedItems(entries), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
