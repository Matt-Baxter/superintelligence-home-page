#!/usr/bin/env node
// Paper watcher checks on synthetic fixtures (no network): the arXiv path, the --from path, de-duplication across runs,
// and the paper-to-code queue. Uses a throwaway SQLite database.
const { execFileSync } = require("node:child_process"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = path.join(__dirname, ".."), DATA = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-")), OUT = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-out-")), HIST = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-hist-"));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const run = (...a) => execFileSync(process.execPath, ["--no-warnings", "scripts/watch.js", ...a], { cwd: root, env: { ...process.env, DATA_DIR: DATA, WATCH_OUT: OUT, WATCH_HISTORY: HIST, DATABASE_URL: "", POSTGRES_URL: "", SITE_PROFILE: "extended", ALLOW_FIXTURE_FEEDS: "1", ARXIV_API: "fixture://sample-atom.xml", WATCH_DELAY_MS: "0" }, encoding: "utf8" }).trim().split("\n").at(-1);
const a = run();
ok(/2 found, 2 new/.test(a), `asking arXiv (fixture) stores new papers once across queries: ${a}`);
ok(/1 queued for paper-to-code/.test(a), "the most credible on-topic paper is queued for paper-to-code");
const b = run("--from", "test/fixtures/sample-atom.xml");
ok(/0 new, 2 already catalogued, 0 queued/.test(b), `a second run adds nothing and queues nothing twice: ${b}`);
const json = JSON.parse(fs.readFileSync(path.join(OUT, fs.readdirSync(OUT).find((f) => f.endsWith(".json"))), "utf8"));
ok(json.papers.every((p) => p.qid.startsWith("doc:") && p.verdict && Number.isFinite(p.credibility)), "the digest lists each paper with its doc id, verdict and credibility");
const tmp = path.join(OUT, "in.json"); fs.writeFileSync(tmp, JSON.stringify([{ title: "Sample thread (test data)", url: "https://x.com/sample/status/1", summary: "Synthetic.", authors: [] }]));
ok(/0 found/.test(run("--from", tmp, "--dry")), "Twitter/X links are dropped");
// History: a --from run saves the day's entries without paper authors; a fresh database replays earlier days first.
const today = new Date().toISOString().slice(0, 10), saved = JSON.parse(fs.readFileSync(path.join(HIST, `${today}.json`), "utf8"));
ok(saved.length === 2 && saved.every((e) => e.title && e.url && e.authors.length === 0), "a --from run saves the day's entries to the history folder, without paper authors");
fs.renameSync(path.join(HIST, `${today}.json`), path.join(HIST, "2000-01-01.json"));
const DATA2 = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-")), empty = path.join(OUT, "empty.json"); fs.writeFileSync(empty, "[]");
const c = execFileSync(process.execPath, ["--no-warnings", "scripts/watch.js", "--from", empty], { cwd: root, env: { ...process.env, DATA_DIR: DATA2, WATCH_OUT: OUT, WATCH_HISTORY: HIST, DATABASE_URL: "", POSTGRES_URL: "", SITE_PROFILE: "extended" }, encoding: "utf8" });
ok(/replayed 2 earlier reviews/.test(c), "a fresh database replays earlier days from the history folder");
const B = require("../modules/lab/built"), ids = B.builtArxivIds();
ok(ids.size > 0 && B.isBuilt(`Paper: x\nhttps://arxiv.org/abs/${[...ids][0]}\nFrom the daily watcher`, ids) && !B.isBuilt("Paper: x\nhttps://arxiv.org/abs/2611.00001", ids), "a paper-to-code job counts as built when its paper has a Lab example");
console.log(`\nwatch unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
