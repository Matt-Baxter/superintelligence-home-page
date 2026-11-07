#!/usr/bin/env node
// Paper watcher checks on synthetic fixtures (no network): the arXiv path, the --from path, de-duplication across runs,
// and the paper-to-code queue. Uses a throwaway SQLite database.
const { execFileSync } = require("node:child_process"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = path.join(__dirname, ".."), DATA = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-")), OUT = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-out-"));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const run = (...a) => execFileSync(process.execPath, ["--no-warnings", "scripts/watch.js", ...a], { cwd: root, env: { ...process.env, DATA_DIR: DATA, WATCH_OUT: OUT, DATABASE_URL: "", POSTGRES_URL: "", SITE_PROFILE: "extended", ALLOW_FIXTURE_FEEDS: "1", ARXIV_API: "fixture://sample-atom.xml", WATCH_DELAY_MS: "0" }, encoding: "utf8" }).trim().split("\n").at(-1);
const a = run();
ok(/2 found, 2 new/.test(a), `asking arXiv (fixture) stores new papers once across queries: ${a}`);
ok(/1 queued for paper-to-code/.test(a), "the most credible on-topic paper is queued for paper-to-code");
const b = run("--from", "test/fixtures/sample-atom.xml");
ok(/0 new, 2 already catalogued, 0 queued/.test(b), `a second run adds nothing and queues nothing twice: ${b}`);
const json = JSON.parse(fs.readFileSync(path.join(OUT, fs.readdirSync(OUT).find((f) => f.endsWith(".json"))), "utf8"));
ok(json.papers.every((p) => p.qid.startsWith("doc:") && p.verdict && Number.isFinite(p.credibility)), "the digest lists each paper with its doc id, verdict and credibility");
const tmp = path.join(OUT, "in.json"); fs.writeFileSync(tmp, JSON.stringify([{ title: "Sample thread (test data)", url: "https://x.com/sample/status/1", summary: "Synthetic.", authors: [] }]));
ok(/0 found/.test(run("--from", tmp, "--dry")), "Twitter/X links are dropped");
console.log(`\nwatch unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
