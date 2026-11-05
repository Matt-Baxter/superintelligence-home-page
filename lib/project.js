// Project workspace (Linear-style issue tracker for running the project itself). Admins only.
// Free-tier friendly: no polling or background work; every read is one or two indexed queries.
const db = require("./db");

const STATUSES = [
  { id: "backlog", label: "Backlog" }, { id: "todo", label: "Todo" }, { id: "in_progress", label: "In progress" },
  { id: "in_review", label: "In review" }, { id: "done", label: "Done" }, { id: "canceled", label: "Canceled" },
];
const PRIORITIES = [{ id: 0, label: "No priority" }, { id: 1, label: "Urgent" }, { id: 2, label: "High" }, { id: 3, label: "Medium" }, { id: 4, label: "Low" }];
const STATUS_IDS = STATUSES.map((s) => s.id);
const PREFIX = "SI";

module.exports = function mountProject(app, { auth, admin, wrap, str, bad, notFound, audit }) {
  const A = [auth, admin];
  const now = () => db.now();
  const isoDate = (v) => (v === null || v === "" ? null : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : bad("Dates look like 2026-11-11."));
  const labelsOf = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(",")).map((x) => str(x, 30).toLowerCase()).filter(Boolean))].slice(0, 8);
  const shape = (r) => r && ({ ...r, key: `${PREFIX}-${r.number}`, labels: JSON.parse(r.labels || "[]") });
  const SELECT = `SELECT i.*, a.display_name AS assignee_name, c.display_name AS creator_name, m.name AS milestone_name,
    (SELECT COUNT(*) FROM project_comments pc WHERE pc.issue_id = i.id) AS comments
    FROM project_issues i LEFT JOIN users a ON a.id = i.assignee_id LEFT JOIN users c ON c.id = i.creator_id LEFT JOIN project_milestones m ON m.id = i.milestone_id`;
  const byNumber = async (n) => shape(await db.get(`${SELECT} WHERE i.number = ?`, Number(n))) || notFound("That issue");
  const log = (issueId, actorId, action, detail = "") => db.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, ?, ?, ?, ?)", issueId, actorId, action, String(detail).slice(0, 300), now());
  const memberIds = async () => new Set((await db.all("SELECT id FROM users WHERE is_admin = 1 AND COALESCE(disabled, 0) = 0")).map((r) => r.id));

  // Validated field values from a request body (only the fields present).
  async function fields(b) {
    const f = {};
    if (b.title !== undefined) { f.title = str(b.title, 200); if (!f.title) bad("Give the issue a title."); }
    if (b.description !== undefined) f.description = str(b.description, 20000);
    if (b.status !== undefined) { if (!STATUS_IDS.includes(b.status)) bad("Unknown status."); f.status = b.status; }
    if (b.priority !== undefined) { const p = Number(b.priority); if (![0, 1, 2, 3, 4].includes(p)) bad("Unknown priority."); f.priority = p; }
    if (b.assignee_id !== undefined) { f.assignee_id = b.assignee_id ? Number(b.assignee_id) : null; if (f.assignee_id && !(await memberIds()).has(f.assignee_id)) bad("Issues can be assigned to admins only."); }
    if (b.milestone_id !== undefined) { f.milestone_id = b.milestone_id ? Number(b.milestone_id) : null; if (f.milestone_id && !(await db.get("SELECT id FROM project_milestones WHERE id = ?", f.milestone_id))) bad("Unknown milestone."); }
    if (b.labels !== undefined) f.labels = JSON.stringify(labelsOf(b.labels));
    if (b.due_date !== undefined) f.due_date = isoDate(b.due_date);
    if (b.sort_order !== undefined) f.sort_order = Number(b.sort_order) || 0;
    return f;
  }

  async function createIssue(b, actor) {
    const f = await fields({ status: "todo", priority: 0, ...b });
    if (!f.title) bad("Give the issue a title.");
    return db.tx(async (t) => {
      const n = ((await t.get("SELECT MAX(number) AS n FROM project_issues"))?.n || 0) + 1;
      const id = await t.insert(`INSERT INTO project_issues (number, title, description, status, priority, assignee_id, creator_id, milestone_id, labels, due_date, sort_order, created_at, updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, n, f.title, f.description || "", f.status, f.priority, f.assignee_id || null, actor, f.milestone_id || null, f.labels || "[]", f.due_date || null, -Date.now(), now(), now(), f.status === "done" ? now() : null);
      await t.run("INSERT INTO project_activity (issue_id, actor_id, action, detail, at) VALUES (?, ?, 'created', '', ?)", id, actor, now());
      return n;
    });
  }

  app.get("/api/admin/project/meta", ...A, wrap(async (req) => {
    const counts = Object.fromEntries((await db.all("SELECT status, COUNT(*) AS n FROM project_issues GROUP BY status")).map((r) => [r.status, r.n]));
    const labels = new Set(); (await db.all("SELECT labels FROM project_issues")).forEach((r) => JSON.parse(r.labels || "[]").forEach((l) => labels.add(l)));
    return {
      prefix: PREFIX, statuses: STATUSES, priorities: PRIORITIES, counts, labels: [...labels].sort(), me: req.user.id,
      members: await db.all("SELECT id, display_name AS name, username FROM users WHERE is_admin = 1 AND COALESCE(disabled, 0) = 0 ORDER BY id"),
      milestones: await db.all(`SELECT m.*, (SELECT COUNT(*) FROM project_issues i WHERE i.milestone_id = m.id AND i.status <> 'canceled') AS total,
        (SELECT COUNT(*) FROM project_issues i WHERE i.milestone_id = m.id AND i.status = 'done') AS done FROM project_milestones m ORDER BY m.target_date IS NULL, m.target_date, m.id`),
    };
  }));

  app.get("/api/admin/project/issues", ...A, wrap(async (req) => {
    const w = ["1=1"], a = [], q = req.query;
    if (q.status) { const st = String(q.status).split(",").filter((s) => STATUS_IDS.includes(s)); if (st.length) { w.push(`i.status IN (${st.map(() => "?").join(",")})`); a.push(...st); } }
    if (q.assignee === "me") { w.push("i.assignee_id = ?"); a.push(req.user.id); }
    else if (q.assignee === "none") w.push("i.assignee_id IS NULL");
    else if (q.assignee) { w.push("i.assignee_id = ?"); a.push(Number(q.assignee)); }
    if (q.priority !== undefined && q.priority !== "") { w.push("i.priority = ?"); a.push(Number(q.priority)); }
    if (q.milestone) { w.push("i.milestone_id = ?"); a.push(Number(q.milestone)); }
    if (q.label) { w.push("i.labels LIKE ?"); a.push(`%"${String(q.label).replace(/[%_"]/g, "")}"%`); }
    const text = str(q.q, 100).toLowerCase();
    if (text) { w.push("(LOWER(i.title) LIKE ? OR LOWER(i.description) LIKE ? OR CAST(i.number AS TEXT) = ?)"); a.push(`%${text}%`, `%${text}%`, text.replace(/^si-/, "")); }
    const rows = await db.all(`${SELECT} WHERE ${w.join(" AND ")} ORDER BY ${q.sort === "manual" ? "i.sort_order, " : ""}CASE i.priority WHEN 0 THEN 9 ELSE i.priority END, i.due_date IS NULL, i.due_date, i.number LIMIT 500`, ...a);
    return { issues: rows.map(shape) };
  }));

  app.post("/api/admin/project/issues", ...A, wrap(async (req) => {
    const n = await createIssue(req.body, req.user.id);
    return { issue: await byNumber(n) };
  }));

  app.get("/api/admin/project/issues/:n", ...A, wrap(async (req) => {
    const issue = await byNumber(req.params.n);
    const comments = await db.all("SELECT c.id, c.body, c.created_at, c.author_id, u.display_name AS author FROM project_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.issue_id = ? ORDER BY c.id", issue.id);
    const activity = await db.all("SELECT a.action, a.detail, a.at, u.display_name AS actor FROM project_activity a LEFT JOIN users u ON u.id = a.actor_id WHERE a.issue_id = ? ORDER BY a.id", issue.id);
    return { issue, comments: comments.map((c) => ({ ...c, mine: c.author_id === req.user.id })), activity };
  }));

  app.put("/api/admin/project/issues/:n", ...A, wrap(async (req) => {
    const before = await byNumber(req.params.n), f = await fields(req.body);
    const changed = Object.keys(f).filter((k) => String(f[k] ?? "") !== String(k === "labels" ? JSON.stringify(before.labels) : before[k] ?? ""));
    if (!changed.length) return { issue: before };
    if (f.status) f.completed_at = f.status === "done" ? before.completed_at || now() : null;
    const cols = Object.keys(f);
    await db.run(`UPDATE project_issues SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...cols.map((c) => f[c]), now(), before.id);
    const after = await byNumber(req.params.n);
    const show = { status: (v) => STATUSES.find((s) => s.id === v)?.label, priority: (v) => PRIORITIES.find((p) => p.id === Number(v))?.label, assignee_id: () => after.assignee_name || "nobody", milestone_id: () => after.milestone_name || "none", labels: () => after.labels.join(", ") || "none", due_date: (v) => v || "none" };
    for (const k of changed) if (k !== "sort_order") await log(before.id, req.user.id, k === "description" ? "edited the description" : `set ${k.replace("_id", "").replace("_", " ")}`, k in show ? show[k](f[k]) : k === "title" ? f.title : "");
    return { issue: after };
  }));

  app.delete("/api/admin/project/issues/:n", ...A, wrap(async (req) => {
    const i = await byNumber(req.params.n);
    await db.run("DELETE FROM project_issues WHERE id = ?", i.id);
    await audit.log(req.user.id, "project.issue.delete", i.key, i.title);
    return { ok: true };
  }));

  app.post("/api/admin/project/issues/:n/comments", ...A, wrap(async (req) => {
    const i = await byNumber(req.params.n), body = str(req.body.body, 5000);
    if (!body) bad("Write a comment first.");
    await db.run("INSERT INTO project_comments (issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?)", i.id, req.user.id, body, now());
    await db.run("UPDATE project_issues SET updated_at = ? WHERE id = ?", now(), i.id);
    return { ok: true };
  }));
  app.delete("/api/admin/project/comments/:id", ...A, wrap(async (req) => {
    const c = await db.get("SELECT * FROM project_comments WHERE id = ?", Number(req.params.id)); if (!c) notFound("That comment");
    if (c.author_id !== req.user.id) bad("You can only delete your own comments.");
    await db.run("DELETE FROM project_comments WHERE id = ?", c.id);
    return { ok: true };
  }));

  app.post("/api/admin/project/milestones", ...A, wrap(async (req) => {
    const name = str(req.body.name, 100); if (!name) bad("Name the milestone.");
    const id = await db.insert("INSERT INTO project_milestones (name, description, target_date, created_at) VALUES (?, ?, ?, ?)", name, str(req.body.description, 1000), isoDate(req.body.target_date ?? null), now());
    return { id };
  }));
  app.put("/api/admin/project/milestones/:id", ...A, wrap(async (req) => {
    const m = await db.get("SELECT * FROM project_milestones WHERE id = ?", Number(req.params.id)); if (!m) notFound("That milestone");
    await db.run("UPDATE project_milestones SET name = ?, description = ?, target_date = ? WHERE id = ?", str(req.body.name, 100) || m.name,
      req.body.description !== undefined ? str(req.body.description, 1000) : m.description, req.body.target_date !== undefined ? isoDate(req.body.target_date) : m.target_date, m.id);
    return { ok: true };
  }));
  app.delete("/api/admin/project/milestones/:id", ...A, wrap(async (req) => {
    await db.run("DELETE FROM project_milestones WHERE id = ?", Number(req.params.id)); return { ok: true };
  }));

  app.get("/api/admin/project/activity", ...A, wrap(async () => ({
    activity: (await db.all(`SELECT a.action, a.detail, a.at, u.display_name AS actor, i.number, i.title FROM project_activity a
      LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN project_issues i ON i.id = a.issue_id ORDER BY a.id DESC LIMIT 100`)).map((r) => ({ ...r, key: r.number ? `${PREFIX}-${r.number}` : null })),
  })));

  // Load the project's real open to-dos (lib/project-starter.json, taken from docs/OUR_PARTS.md) into an empty tracker.
  app.post("/api/admin/project/starter", ...A, wrap(async (req) => {
    if ((await db.get("SELECT COUNT(*) AS n FROM project_issues")).n > 0) bad("The tracker already has issues; starter issues only load into an empty one.");
    const starter = require("./project-starter.json");
    const users = await db.all("SELECT id, LOWER(username) AS u, LOWER(display_name) AS d FROM users WHERE is_admin = 1");
    const who = (name) => (name ? users.find((x) => x.u.startsWith(name) || x.d.startsWith(name))?.id || null : null);
    const ms = {};
    for (const m of starter.milestones) ms[m.key] = await db.insert("INSERT INTO project_milestones (name, description, target_date, created_at) VALUES (?, ?, ?, ?)", m.name, m.description || "", m.target_date || null, now());
    for (const i of starter.issues) await createIssue({ ...i, milestone_id: ms[i.milestone] || null, assignee_id: who(i.owner) }, req.user.id);
    await audit.log(req.user.id, "project.starter", `${starter.issues.length} issues`);
    return { issues: starter.issues.length, milestones: starter.milestones.length };
  }));
};
module.exports.STATUSES = STATUSES;
