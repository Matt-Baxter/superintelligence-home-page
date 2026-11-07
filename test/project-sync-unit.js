#!/usr/bin/env node
// project-sync (REQ-030, proposed): one issue per people check, proposal, agent job and scheduled task; a second run
// duplicates nothing; a finished agent job moves its issue to Done. Throwaway SQLite database, no network.
const { execFileSync } = require("node:child_process"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = path.join(__dirname, ".."), DATA = fs.mkdtempSync(path.join(os.tmpdir(), "si-psync-"));
const env = { ...process.env, DATA_DIR: DATA, DATABASE_URL: "", POSTGRES_URL: "", SITE_PROFILE: "extended" };
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const node = (code) => execFileSync(process.execPath, ["--no-warnings", "-e", code], { cwd: root, env, encoding: "utf8" }).trim();
const sql = (q) => node(`(async()=>{const db=require("./lib/db"),{createKernel}=require("./kernel/kernel"),k=createKernel();db.extend({sql:k.store.schema.join("\\n"),columns:k.store.columns});await db.ready();const r=await db.all(${JSON.stringify(q)});console.log(JSON.stringify(r));process.exit(0)})()`);
const sync = () => execFileSync(process.execPath, ["--no-warnings", "scripts/project-sync.js"], { cwd: root, env, encoding: "utf8" }).trim().split("\n").at(-1);
sql("SELECT 1"); // create the schema
node(`(async()=>{const db=require("./lib/db"),{createKernel}=require("./kernel/kernel"),k=createKernel();db.extend({sql:k.store.schema.join("\\n"),columns:k.store.columns});await db.ready();await db.insert("INSERT INTO learn_jobs (kind, note, updated_at) VALUES ('paper-to-code', 'Paper: Sample paper (test data)\\nhttps://arxiv.org/abs/2611.00002', ?)", new Date().toISOString());process.exit(0)})()`);
const a = sync(); const n1 = JSON.parse(sql("SELECT COUNT(*) AS n FROM project_issues"))[0].n;
const dirs = fs.readdirSync(path.join(root, "specs")).filter((d) => !d.startsWith("001-"));
const count = (file, re) => dirs.reduce((n, d) => { const f = path.join(root, "specs", d, file); return n + (fs.existsSync(f) ? (fs.readFileSync(f, "utf8").match(re) || []).length : 0); }, 0);
const props = count("spec.md", /^- \*\*REQ-\d{3}\*\*/gm), tasks = count("tasks.md", /^- \[[ xX]\] T\d{3}/gm);
const CFG = require("../modules/project/sync.json"), people = Object.keys(CFG.people).length, sched = CFG.scheduled.length, research = 2;
ok(n1 === people + props + tasks + 1 + sched + research, `first run: one issue per people check (${people}), proposal (${props}), agent job (1), scheduled task (${sched}) and research item waiting for a person (${research}): ${a}`);
ok(/0 created/.test(sync()) && JSON.parse(sql("SELECT COUNT(*) AS n FROM project_issues"))[0].n === n1, "second run creates nothing");
node(`(async()=>{const db=require("./lib/db"),{createKernel}=require("./kernel/kernel"),k=createKernel();db.extend({sql:k.store.schema.join("\\n"),columns:k.store.columns});await db.ready();await db.run("UPDATE learn_jobs SET status = 'done'");process.exit(0)})()`);
ok(/1 updated/.test(sync()), "a finished agent job is picked up");
const job = JSON.parse(sql("SELECT status, labels FROM project_issues WHERE title LIKE 'Paper-to-code:%'"))[0];
ok(job.status === "done" && JSON.parse(job.labels).includes("agent"), "its issue is Done and labelled agent");
const appr = JSON.parse(sql("SELECT labels FROM project_issues WHERE title LIKE 'Approve REQ-027%'"))[0];
ok(appr && JSON.parse(appr.labels).includes("REQ-027"), "proposals carry their REQ id as a label");
const t1 = JSON.parse(sql("SELECT status, labels FROM project_issues WHERE title LIKE 'T001 (003)%'"))[0];
ok(t1 && t1.status === "done" && JSON.parse(t1.labels).includes("spec-task"), "a ticked spec task is Done and labelled spec-task");
const t0 = JSON.parse(sql("SELECT status, priority FROM project_issues WHERE title LIKE 'T000 (003)%'"))[0];
ok(t0 && t0.status === "todo" && t0.priority === 2, "an open people task is To do, at people priority");
console.log(`\nproject sync unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
