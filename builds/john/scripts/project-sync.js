#!/usr/bin/env node
// Keep the Project tracker in step with the plan and the agents (REQ-030, proposed): one issue each for
//   - the shared spec's checks that only people can do (modules/project/sync.json "people"),
//   - each proposed requirement waiting for both partners' approval (every specs/<nnn>/spec.md except the shared 001),
//   - each task in specs/<nnn>/tasks.md ("- [ ] T001 [agent] [REQ-0xx] ..."), its status following the checkbox,
//   - each agent job in the Learn studio queue (paper-to-code and the rest), with its status mirrored,
//   - each scheduled agent task (modules/project/sync.json "scheduled").
// Every synced issue carries a "sync-key:" line, so running it again updates issues instead of adding new ones.
// People keep titles, assignees, priorities and notes outside the source block; generated context, labels and followed status stay current.
//   node scripts/project-sync.js          (same DATABASE_URL / DATA_DIR as the server)   --dry   print, change nothing
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, ".."), dry = process.argv.includes("--dry");
const CFG = require("../modules/project/sync.json");
const syncSource = require("../modules/project/sync-source");

// Proposed specs: every folder in specs/ except the shared spec (001), which is approved and not mirrored here.
function specDirs() {
  const d = path.join(root, "specs");
  return fs.existsSync(d) ? fs.readdirSync(d).filter((x) => !x.startsWith("001-") && fs.statSync(path.join(d, x)).isDirectory()).sort() : [];
}
function proposals() {
  const out = [];
  for (const dir of specDirs()) {
    const f = path.join(root, "specs", dir, "spec.md"); if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/^- \*\*(REQ-\d{3})\*\*: ([^\n]+)/gm)) out.push({ id: m[1], text: m[2].trim(), dir });
  }
  return out;
}
// Spec Kit tasks: "- [ ] T012 [rules] [REQ-037] Cap any single ..." (the [who] tag says who may do it; see tasks.md).
const WHO_PRIORITY = { people: 2, rules: 3, agent: 3 };
function tasks() {
  const out = [];
  for (const dir of specDirs()) {
    const f = path.join(root, "specs", dir, "tasks.md"); if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/^- \[( |x|X)\] (T\d{3})((?: \[[^\]]+\])*) ([^\n]+)/gm)) {
      const tags = [...m[3].matchAll(/\[([^\]]+)\]/g)].map((t) => t[1]);
      out.push({ id: m[2], done: m[1] !== " ", who: tags.find((t) => WHO_PRIORITY[t]) || "agent", reqs: tags.filter((t) => /^REQ-\d{3}$/.test(t)), text: m[4].trim(), dir });
    }
  }
  return out;
}
const JOB_STATUS = { queued: "todo", "needs-agent": "todo", running: "in_progress", done: "done", published: "done", failed: "todo" };

async function main() {
  // Validate the entire proposed idea registry before opening or writing any database.
  const product = require("../modules/project/product-backlog"), backlog = require("../docs/research/product-backlog.json");
  const requirements = new Map();
  for(const dir of ["001-superintelligence-homepage",...specDirs()]){
    const file=path.join(root,"specs",dir,"spec.md");
    if(fs.existsSync(file))requirements.set(dir.slice(0,3),new Set([...fs.readFileSync(file,"utf8").matchAll(/^- \*\*(REQ-\d{3})\*\*:/gm)].map(m=>m[1])));
  }
  const productItems = product.items(product.validateReferences(backlog, requirements));
  // The Project tracker is an extended-version module; its tables only exist with that profile loaded.
  process.env.SITE_PROFILE = process.env.SITE_PROFILE || "extended";
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const now = () => db.now();
  let ms = await db.get("SELECT id FROM project_milestones WHERE name = ?", CFG.milestone.name);
  if (!ms && !dry) ms = { id: await db.insert("INSERT INTO project_milestones (name, description, created_at) VALUES (?, ?, ?)", CFG.milestone.name, CFG.milestone.description, now()) };

  const items = [...productItems];
  for (const [id, text] of Object.entries(CFG.people)) items.push({ key: `people:${id}`, title: `People check: ${id}`, description: text, labels: [id.startsWith("REQ") ? id : "spec", "people"], priority: 2 });
  for (const p of proposals()) items.push({ key: p.dir.startsWith("002-") ? `approve:${p.id}` : `approve:${p.dir}:${p.id}`, title: `Approve ${p.id} with Matt (or drop it)`, description: `${p.text}\n\nProposed in specs/${p.dir}/spec.md. Both partners decide; until then it's extended-version only.`, labels: [p.id, `spec:${p.dir.slice(0, 3)}`, "spec", "approval"], priority: 3, milestone: true });
  for (const t of tasks()) items.push({ key: `task:${t.dir}:${t.id}`, title: `${t.id} (${t.dir.split("-")[0]}): ${t.text}`.slice(0, 200),
    description: `${t.text}\n\nTask ${t.id} in specs/${t.dir}/tasks.md (who: ${t.who}). Tick its checkbox in the commit that finishes it; the next sync moves this issue to Done.`,
    labels: [...t.reqs, `spec:${t.dir.slice(0, 3)}`, "spec-task", t.who], priority: WHO_PRIORITY[t.who], status: t.done ? "done" : "todo", follow: true, milestone: true });
  const readiness = require("../modules/project/specs").collect();
  const blocked = new Map(readiness.reqs.flatMap((r) => r.tasks.filter((t) => t.blockedBy).map((t) => [`task:${r.spec}:${t.id}`, t.blockedBy])));
  for (const spec of readiness.specs) for (const task of spec.unlinkedTasks) if (task.blockedBy) blocked.set(`task:${spec.id}:${task.id}`, task.blockedBy);
  for (const item of items) {
    const m = item.key.match(/^task:(\d{3})-[^:]+:(T\d+)$/);
    const gate = m && blocked.get(`task:${m[1]}:${m[2]}`);
    if (gate) item.description += `\n\nBlocked by ${gate}: this spec explicitly requires approval before implementation starts.`;
  }
  const jobs = await db.all("SELECT id, kind, note, status FROM learn_jobs ORDER BY id");
  for (const j of jobs) {
    const first = String(j.note || "").split("\n")[0].replace(/^Paper:\s*/, "").slice(0, 120) || `job #${j.id}`;
    items.push({ key: `job:${j.id}`, title: `${j.kind === "paper-to-code" ? "Paper-to-code" : `Studio ${j.kind}`}: ${first}`, description: `${j.note || ""}\n\nLearn studio job #${j.id} (${j.status}). An agent does it; see /m/learn.`, labels: ["agent", j.kind, j.kind === "paper-to-code" ? "REQ-026" : "REQ-024"], priority: 3, status: JOB_STATUS[j.status] || "todo", follow: true, milestone: true });
  }
  // Research-layer work only people can do, kept open while anything waits (REQ-027, REQ-033): the agents' check-in
  // (scripts/checkin.js) reports the same counts every day.
  const W = await require("./checkin").waiting(db);
  items.push({ key: "research:forecasts-due", title: "Resolve forecasts that have fallen due", description: `Mark each due forecast as happened, did not happen or unclear on its topic's dossier (/m/dossier). Waiting now: ${W.forecastsDue}. Outlets' track records only count resolved forecasts.`, labels: ["REQ-033", "spec:002", "people"], priority: 2, status: W.forecastsDue ? "todo" : "done", follow: true, milestone: true });
  items.push({ key: "research:reviews-for-a-person", title: "Label the reviews the guards sent to a person", description: `Agree or disagree with each flagged verdict on the Review desk (/m/review). Waiting now: ${W.reviewsForPerson}. These labels are the judges' calibration (SC-104).`, labels: ["REQ-027", "spec:002", "people"], priority: 2, status: W.reviewsForPerson ? "todo" : "done", follow: true, milestone: true });
  for (const s of CFG.scheduled) items.push({ ...s, priority: 3, status: "in_progress", milestone: true });

  const sourceKeys = new Set();
  for (const item of items) { if (sourceKeys.has(item.key)) throw new Error(`Duplicate source sync key ${item.key}.`); sourceKeys.add(item.key); }
  const existing = new Map();
  for (const row of await db.all("SELECT id, number, status, completed_at, description, labels FROM project_issues WHERE description LIKE ?", "%sync-key:%")) {
    const keys = syncSource.keys(row.description);
    if (keys.length !== 1) throw new Error(`Ambiguous sync markers on issue ${row.number}; resolve them before syncing.`);
    for (const key of keys) {
      if (existing.has(key)) throw new Error(`Duplicate sync key ${key}; resolve the existing issues before syncing.`);
      existing.set(key, row);
    }
  }
  let created = 0, updated = 0, same = 0;
  for (const it of items) {
    const have = existing.get(it.key);
    const description = syncSource.descriptionFor(it, have?.description);
    const labels = JSON.stringify(syncSource.labelsFor(it, have ? JSON.parse(have.labels || "[]") : []));
    if (have) {
      const status = it.follow && it.status ? it.status : have.status;
      if (have.status !== status || have.description !== description || have.labels !== labels) {
        if (!dry) await db.tx(async (t) => {
          await t.run("UPDATE project_issues SET description = ?, labels = ?, status = ?, updated_at = ?, completed_at = ? WHERE id = ?", description, labels, status, now(), status !== have.status ? (status === "done" ? now() : null) : have.completed_at, have.id);
          await t.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, NULL, 'sync', ?, ?)", have.id, status !== have.status ? `source refreshed; status: ${status}` : "source context refreshed", now());
        });
        updated++;
      } else same++;
      continue;
    }
    created++;
    if (dry) { console.log(`  + ${it.title}`); continue; }
    await db.tx(async (t) => {
      const n = ((await t.get("SELECT MAX(number) AS n FROM project_issues"))?.n || 0) + 1;
      const id = await t.insert(`INSERT INTO project_issues (number, title, description, status, priority, milestone_id, labels, sort_order, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        n, it.title.slice(0, 200), description, it.status || "todo", it.priority || 0, it.milestone && ms ? ms.id : null, labels, -Date.now(), now(), now(), it.status === "done" ? now() : null);
      await t.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, NULL, 'created', 'project-sync', ?)", id, now());
    });
  }
  console.log(`project sync: ${items.length} items, ${created} created, ${updated} updated, ${same} unchanged${dry ? " (dry run)" : ""}`);
}
main().then(() => process.exit(0), (e) => { console.error("project sync:", e.message); process.exit(1); });
