#!/usr/bin/env node
// End to end on synthetic data (test data): the research site's feed carries each write-up's rigor; the main app reads
// it and, only where the "rigor-badges" feature is on (the extended version; proposed, not in the spec version), returns
// it on the story's research source so the card shows a badge. The spec version ingests the same feed unchanged.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { spawn } = require("node:child_process");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };

// Child mode: a main-app server (spec or extended) that ingests a feed body from a file and serves it.
if (process.argv[2] === "--main") {
  const [, , , prof, port, file] = process.argv;
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), `si-${prof}-`)), SITE_PROFILE: prof, FETCH_MINUTES: "0" });
  const { app, db, ingestItems, boot } = require("../server"), feeds = require("../lib/feeds");
  (async () => {
    await boot();
    const add = async (name, kind, format, url, body) => { const id = await db.insert("INSERT INTO sources (name, kind, format, url, home, status) VALUES (?, ?, ?, ?, '', 'active')", name, kind, format, url); await ingestItems(id, feeds.parse(format, body)); };
    await add("Sample arXiv feed (test data)", "papers", "arxiv", "fixture://sample-atom.xml", fs.readFileSync(path.join(__dirname, "fixtures", "sample-atom.xml"), "utf8"));
    await add("Research write-ups (Sample, test data)", "research-org", "rss", "https://research.example.test/research/feed.xml", fs.readFileSync(file, "utf8"));
    app.listen(Number(port), () => console.log("ready"));
  })().catch((e) => { console.error(e); process.exit(1); });
  return;
}

const start = (args, env = {}) => new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ["--no-warnings", ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (b) => { if (/ready/.test(String(b))) resolve(p); }); p.on("exit", (c) => reject(new Error(`exited ${c}`)));
});
async function stories(port) {
  const r = await fetch(`http://localhost:${port}/api/signup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "sample-reader", password: "correct-horse-9" }) });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  return (await (await fetch(`http://localhost:${port}/api/stories?limit=50`, { headers: { cookie } })).json());
}

(async () => {
  const procs = [];
  try {
    const research = await start([path.join(__dirname, "research-feed.js"), "--serve"], { PORT: "3294", RESEARCH_PUBLIC: "1" }); procs.push(research);
    const xml = await (await fetch("http://localhost:3294/research/feed.xml")).text(), file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "si-feed-")), "feed.xml");
    fs.writeFileSync(file, xml);
    const feeds = require("../lib/feeds"), items = feeds.parse("rss", xml);
    console.log("Feed");
    ok(items.some((i) => i.rigor && i.rigor.verdict && i.rigor.credibility && i.rigor.grade), "the main app's RSS parser picks up each write-up's verdict, credibility and grade");
    ok(feeds.parse("rss", "<rss><channel><item><title>Plain item</title><link>https://example.test/a</link><category>AI</category></item></channel></rss>")[0].rigor === undefined, "a plain feed's categories are ignored: rigor only comes from si: categories");

    const ext = await start([__filename, "--main", "extended", "3295", file]); procs.push(ext);
    const spec = await start([__filename, "--main", "spec", "3296", file]); procs.push(spec);
    const E = await stories(3295), S = await stories(3296), list = (x) => (Array.isArray(x) ? x : x.stories || []);
    const joined = list(E).find((s) => /Scaling Laws for Test-Time Compute/.test(s.title));
    console.log("Extended version (rigor-badges on)");
    ok(joined && joined.sources.length === 2 && joined.sources.some((x) => x.rigor && x.rigor.verdict === "solid, modest step"), "the arXiv paper's story carries the research write-up as a second source, with its verdict");
    ok(list(E).some((s) => s.sources.some((x) => x.rigor && /^\d+$/.test(String(x.rigor.credibility)))), "the story API returns the credibility the card shows");
    console.log("Spec version (unchanged)");
    const sj = list(S).find((s) => /Scaling Laws for Test-Time Compute/.test(s.title));
    ok(sj && sj.sources.length === 2 && list(S).every((s) => s.sources.every((x) => x.rigor === undefined)), "the spec version groups the same write-up but returns no rigor: the badge waits for approval");
    const card = fs.readFileSync(path.join(__dirname, "..", "public", "js", "api.js"), "utf8");
    ok(/rigorBadge/.test(card) && /Research write-up:/.test(card), "the story card renders the badge from that field");
  } finally { procs.forEach((p) => p.kill()); }
  console.log(`\nrigor badge: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
