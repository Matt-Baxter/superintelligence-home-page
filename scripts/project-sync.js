#!/usr/bin/env node
// Keep the Project tracker in step with the plan and the agents (REQ-030, proposed): one issue each for
//   - the shared spec's checks that only people can do (modules/project/sync.json "people"),
//   - each proposed requirement waiting for both partners' approval (specs/002-research-layer/spec.md),
//   - each agent job in the Learn studio queue (paper-to-code and the rest), with its status mirrored,
//   - each scheduled agent task (modules/project/sync.json "scheduled").
// Every synced issue carries a "sync-key:" line, so running it again updates issues instead of adding new ones.
// People's own edits to titles, assignees and priorities are kept; only status follows the source (for agent jobs).
//   node scripts/project-sync.js          (same DATABASE_URL / DATA_DIR as the server)   --dry   print, change nothing
const fs = require("node:fs"), path = require("node:path");
const root = path.join(__dirname, ".."), dry = process.argv.includes("--dry");
const CFG = require("../modules/project/sync.json");

function proposals() {
  const f = path.join(root, "specs", "002-research-layer", "spec.md");
  if (!fs.existsSync(f)) return [];
  return [...fs.readFileSync(f, "utf8").matchAll(/^- \*\*(REQ-\d{3})\*\*: ([^\n]+)/gm)].map((m) => ({ id: m[1], text: m[2].trim() }));
}
const JOB_STATUS = { queued: "todo", "needs-agent": "todo", running: "in_progress", done: "done", published: "done", failed: "todo" };

async function main() {
  const db = require("../lib/db"), { createKernel } = require("../kernel/kernel"), k = createKernel();
  db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  const now = () => db.now();
  let ms = await db.get("SELECT id FROM project_milestones WHERE name = ?", CFG.milestone.name);
  if (!ms && !dry) ms = { id: await db.insert("INSERT INTO project_milestones (name, description, created_at) VALUES (?, ?, ?)", CFG.milestone.name, CFG.milestone.description, now()) };

  const items = [];
  for (const [id, text] of Object.entries(CFG.people)) items.push({ key: `people:${id}`, title: `People check: ${id}`, description: text, labels: [id.startsWith("REQ") ? id : "spec", "people"], priority: 2 });
  for (const p of proposals()) items.push({ key: `approve:${p.id}`, title: `Approve ${p.id} with Matt (or drop it)`, description: `${p.text}\n\nProposed in specs/002-research-layer/spec.md. Both partners decide; until then it's extended-version only.`, labels: [p.id, "spec", "approval"], priority: 3, milestone: true });
  const jobs = await db.all("SELECT id, kind, note, status FROM learn_jobs ORDER BY id");
  for (const j of jobs) {
    const first = String(j.note || "").split("\n")[0].replace(/^Paper:\s*/, "").slice(0, 120) || `job #${j.id}`;
    items.push({ key: `job:${j.id}`, title: `${j.kind === "paper-to-code" ? "Paper-to-code" : `Studio ${j.kind}`}: ${first}`, description: `${j.note || ""}\n\nLearn studio job #${j.id} (${j.status}). An agent does it; see /m/learn.`, labels: ["agent", j.kind, j.kind === "paper-to-code" ? "REQ-026" : "REQ-024"], priority: 3, status: JOB_STATUS[j.status] || "todo", follow: true, milestone: true });
  }
  for (const s of CFG.scheduled) items.push({ ...s, priority: 3, status: "in_progress", milestone: true });

  let created = 0, updated = 0, same = 0;
  for (const it of items) {
    const marker = `sync-key: ${it.key}`;
    const have = await db.get("SELECT id, number, status FROM project_issues WHERE description LIKE ?", `%${marker}%`);
    if (have) {
      if (it.follow && it.status && have.status !== it.status) {
        if (!dry) { await db.run("UPDATE project_issues SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?", it.status, now(), it.status === "done" ? now() : null, have.id);
          await db.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, NULL, 'status', ?, ?)", have.id, `synced: ${it.status}`, now()); }
        updated++;
      } else same++;
      continue;
    }
    created++;
    if (dry) { console.log(`  + ${it.title}`); continue; }
    await db.tx(async (t) => {
      const n = ((await t.get("SELECT MAX(number) AS n FROM project_issues"))?.n || 0) + 1;
      const id = await t.insert(`INSERT INTO project_issues (number, title, description, status, priority, milestone_id, labels, sort_order, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        n, it.title.slice(0, 200), `${it.description}\n\n${marker}`, it.status || "todo", it.priority || 0, it.milestone && ms ? ms.id : null, JSON.stringify(it.labels.slice(0, 8)), -Date.now(), now(), now(), it.status === "done" ? now() : null);
      await t.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, NULL, 'created', 'project-sync', ?)", id, now());
    });
  }
  console.log(`project sync: ${items.length} items, ${created} created, ${updated} updated, ${same} unchanged${dry ? " (dry run)" : ""}`);
}
main().then(() => process.exit(0), (e) => { console.error("project sync:", e.message); process.exit(1); });
