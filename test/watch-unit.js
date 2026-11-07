#!/usr/bin/env node
// Paper watcher checks on synthetic fixtures (no network): the arXiv path, the --from path, de-duplication across runs,
// the paper-to-code queue, and abstract + paraphrase entries (the abstract is scored, the paraphrase only shown if
// fidelity() passes, only a hash and the 400-character excerpt stored). Uses a throwaway SQLite database.
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

// Abstract + paraphrase (REQ-033, T021): the abstract is scored; the paraphrase is shown only if fidelity() passes.
const R = require("../modules/review/review");
const ABS = "Sample abstract (test data). We introduce Sample-Net, a 40-million-parameter model trained on 12 synthetic tasks. On a Sample reasoning benchmark, Sample-Net improves accuracy by 4 percentage points over a baseline, averaged over 3 seeds. These results suggest that the method may improve sample efficiency. Limitations: we evaluate only on synthetic data, and we do not test on held-out Sample tasks or on any model larger than the one described here.";
const T = "Sample paper: Sample-Net reasoning (test data)";
const good = ABS.replace("We introduce Sample-Net, a", "Sample-Net is a").replace("model trained", "model, trained");
const bad = ABS.replace("4 percentage points", "6 percentage points");
const PARA = "Sample paraphrase (test data): a small Sample model gains on a Sample benchmark.";
const OUT2 = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-out2-")), DATA2 = fs.mkdtempSync(path.join(os.tmpdir(), "si-watch-db2-"));
const in2 = path.join(OUT2, "in.json");
fs.writeFileSync(in2, JSON.stringify([
  { title: T, url: "https://arxiv.org/abs/2611.90001", abstract: ABS, summary: good, authors: ["A. Example"] },
  { title: T, url: "https://arxiv.org/abs/2611.90002", abstract: ABS, summary: bad, authors: ["A. Example"] },
  { title: "Sample paper: no abstract given (test data)", url: "https://arxiv.org/abs/2611.90003", summary: PARA, authors: [] },
]));
const run2 = (...a) => execFileSync(process.execPath, ["--no-warnings", "scripts/watch.js", ...a], { cwd: root, env: { ...process.env, DATA_DIR: DATA2, WATCH_OUT: OUT2, DATABASE_URL: "", POSTGRES_URL: "", SITE_PROFILE: "extended", WATCH_DELAY_MS: "0" }, encoding: "utf8" }).trim().split("\n").at(-1);
const line2 = run2("--from", in2);
ok(/3 found, 2 new, 1 already catalogued/.test(line2), `the same abstract with a different paraphrase is the same document (stored once): ${line2}`);
const day2 = fs.readdirSync(OUT2).find((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f));
const d2 = JSON.parse(fs.readFileSync(path.join(OUT2, day2), "utf8")), md2 = fs.readFileSync(path.join(OUT2, day2.replace(".json", ".md")), "utf8");
const [pg, pb, pn] = ["90001", "90002", "90003"].map((id) => d2.papers.find((p) => p.arxiv === `2611.${id}`));
const absR = R.review({ kind: "paper", title: T, text: ABS, authors: "A. Example" });
ok(pg.read === "abstract" && pg.fidelity.pass && pg.summary === good && !pg.summaryWithheld, "a faithful paraphrase passes fidelity and is shown");
ok(pb.read === "abstract" && pb.summaryWithheld === "numbers" && pb.summary === null && md2.includes("summary withheld: numbers"), `a paraphrase that changes a number is withheld: ${pb.note}`);
ok(pg.score === absR.score && pb.score === absR.score && pg.credibility === absR.credibility && pb.credibility === absR.credibility && pg.qid === absR.qid,
  `both are scored from the abstract, whatever the paraphrase says (score ${absR.score}, credibility ${absR.credibility})`);
ok(pg.abstractSha256 === require("node:crypto").createHash("sha256").update(ABS).digest("hex"), "the digest carries the abstract's sha256");
const pnR = R.review({ kind: "paper", title: "Sample paper: no abstract given (test data)", text: PARA, authors: "" });
ok(pn.read === "paraphrase" && pn.credibility === pnR.credibility && pn.qid === pnR.qid && md2.includes("scored from the agent's paraphrase (no abstract given)"), "without an abstract the paraphrase is scored, as before, and the digest says so");
// What is stored (one row per abstract): the 400-character excerpt and the abstract's hash, never the paraphrase or the full abstract (REQ-007).
const rows2 = JSON.parse(execFileSync(process.execPath, ["-e", `const db=require("./lib/db");db.ready().then(async()=>{console.log(JSON.stringify(await db.all("SELECT url, excerpt, result FROM review_docs")));process.exit(0)})`], { cwd: root, env: { ...process.env, DATA_DIR: DATA2, DATABASE_URL: "", POSTGRES_URL: "", NODE_NO_WARNINGS: "1" }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").at(-1));
const sg = rows2.find((r) => r.url.endsWith("90001")), sb = rows2.find((r) => r.url.endsWith("90002"));
ok(ABS.length > 400 && sg.excerpt === ABS.slice(0, 400), "the stored excerpt is the abstract's first 400 characters");
ok(rows2.every((r) => !r.result.includes(ABS) && !r.result.includes(good.slice(0, 120)) && !r.result.includes("6 percentage points")), "no stored row holds the full abstract or a paraphrase");
ok(JSON.parse(sg.result).input.abstractSha256 === pg.abstractSha256 && JSON.parse(sg.result).input.fidelity.pass === true, "the stored result records the abstract's hash and the fidelity verdict");
ok(!sb && pb.qid === pg.qid && !pb.isNew, "the second paraphrase of the same abstract adds no row: the document id comes from the abstract");
console.log(`\nwatch unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
