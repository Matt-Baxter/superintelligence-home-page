#!/usr/bin/env node
// project-sync (REQ-030, proposed): one issue per people check, proposal, agent job and scheduled task; a second run
// duplicates nothing; a finished agent job moves its issue to Done. Throwaway SQLite database, no network.
const { execFileSync } = require("node:child_process"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const root = path.join(__dirname, ".."), DATA = fs.mkdtempSync(path.join(os.tmpdir(), "si-psync-"));
const env = { ...process.env, DATA_DIR: DATA, DATABASE_URL: process.env.TEST_DATABASE_URL || "", POSTGRES_URL: "", SITE_PROFILE: "extended" };
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
ok(n1 === people + props + tasks + 1 + sched + research + 200 + require("../docs/research/product-backlog.json").delivery_slices.length, `first run: 200 product ideas plus one issue per people check (${people}), proposal (${props}), agent job (1), scheduled task (${sched}) and research item waiting for a person (${research}): ${a}`);
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
const original = JSON.parse(sql("SELECT id, description FROM project_issues WHERE title LIKE 'Paper-to-code:%'"))[0];
node(`(async()=>{const db=require("./lib/db");await db.ready();await db.run("UPDATE project_issues SET title = ?, priority = ?, description = ?, labels = ? WHERE id = ?", "Sample human title (test data)", 1, ${JSON.stringify("Sample human note (test data)\n\nsync-key: job:1")}, '["custom"]', ${original.id});process.exit(0)})()`);
sync(); const refreshed = JSON.parse(sql(`SELECT title, priority, description, labels FROM project_issues WHERE id = ${original.id}`))[0];
ok(refreshed.title === 'Sample human title (test data)' && refreshed.priority === 1 && refreshed.description.includes('Sample human note') && refreshed.description.includes('Learn studio job #1 (done)'), 'legacy sync refreshes current context while retaining human title, priority and notes');
ok(JSON.parse(refreshed.labels).includes('custom') && JSON.parse(refreshed.labels).includes('REQ-026'), 'custom labels survive while generated labels are restored');
ok(/0 updated/.test(sync()), 'source-block migration is idempotent');
const gatedIssue = JSON.parse(sql("SELECT description FROM project_issues WHERE description LIKE '%sync-key: task:004-parity:T011%'"))[0];
ok(gatedIssue.description.includes('Blocked by 004/T000'), 'tracker task context retains the spec approval gate');
const product = JSON.parse(sql("SELECT id, status, labels FROM project_issues WHERE description LIKE '%sync-key: product-idea:%'"));
ok(product.length===200&&product.every(i=>i.status==='backlog'&&JSON.parse(i.labels).includes('proposed')), 'all 200 product ideas start in backlog as proposals');
const first=JSON.parse(sql(`SELECT id,description,labels FROM project_issues WHERE id=${product[0].id}`))[0];
node(`(async()=>{const db=require("./lib/db");await db.ready();await db.run("UPDATE project_issues SET title=?,status=?,priority=?,description=?,labels=? WHERE id=?", "Sample edited product title (test data)","in_progress",1,${JSON.stringify(first.description+'\n\nSample human product note (test data)')},${JSON.stringify(JSON.stringify([...JSON.parse(first.labels),'custom-product']))},${first.id});process.exit(0)})()`);
sync();const kept=JSON.parse(sql(`SELECT title,status,priority,description,labels FROM project_issues WHERE id=${first.id}`))[0];
ok(kept.title==='Sample edited product title (test data)'&&kept.status==='in_progress'&&kept.priority===1&&kept.description.includes('Sample human product note')&&JSON.parse(kept.labels).includes('custom-product'),'product refresh preserves human title, progress, priority, notes and labels');
ok(/0 created, 0 updated/.test(sync()),'product import remains idempotent after human edits');
const registry=require('../docs/research/product-backlog.json'),projectBacklog=require('../modules/project/product-backlog');
ok(projectBacklog.items(registry).filter(i=>i.key.startsWith("product-idea:")).length===200&&new Set(projectBacklog.items(registry).map(i=>i.key)).size===200+registry.delivery_slices.length,'backlog projects 200 stable identities');
for(const [name,mutate] of [['duplicate',b=>b.ideas[1].id=b.ideas[0].id],['duplicate phase',b=>b.phases.push(b.phases[0])],['duplicate epic',b=>b.epics.push(b.epics[0])],['missing field',b=>delete b.ideas[0].acceptance],['unknown phase',b=>b.ideas[0].phase='unknown'],['phase cycle',b=>b.phases[0].depends_on=[b.phases.at(-1).id]],['idea cycle',b=>{b.ideas[0].depends_on=['IDEA-002'];b.ideas[1].depends_on=['IDEA-001'];}]]){const copy=structuredClone(registry);mutate(copy);let rejected=false;try{projectBacklog.items(copy);}catch{rejected=true;}ok(rejected,`malformed ${name} fails before sync can write`);}
const updatedLabels=require('../modules/project/sync-source').labelsFor({key:'product-idea:001',labels:['product-backlog','phase:P2','epic:synthesis','needs-spec']},['product-backlog','phase:P0','epic:performance','scope-review','custom-product']);
ok(updatedLabels.includes('custom-product')&&updatedLabels.includes('phase:P2')&&!updatedLabels.includes('phase:P0')&&!updatedLabels.includes('epic:performance')&&!updatedLabels.includes('scope-review'),'phase, epic and scope refresh replace source-owned labels while preserving human labels');
console.log(`\nproject sync unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
