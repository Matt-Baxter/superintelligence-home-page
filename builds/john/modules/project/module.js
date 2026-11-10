// Project workspace: a Linear-style tracker for running the project itself (issues, milestones, comments, activity).
module.exports = {
  id: "project",
  version: "1.2.0",
  description: "Linear-style project workspace for admins: issues, board, timeline with dependencies, milestones, activity, command menu, specs view.",
  setup(ctx) {
    // Tables owned by this module. ${ID} and ${T} become the engine's id and timestamp types.
    ctx.point("db.schema").addSql(`
CREATE TABLE IF NOT EXISTS project_milestones (id \${ID}, name TEXT NOT NULL, description TEXT DEFAULT '', target_date TEXT, created_at TEXT DEFAULT \${T});
CREATE TABLE IF NOT EXISTS project_issues (id \${ID}, number INTEGER UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
  status TEXT DEFAULT 'todo', priority INTEGER DEFAULT 0, assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL, milestone_id INTEGER REFERENCES project_milestones(id) ON DELETE SET NULL,
  labels TEXT DEFAULT '[]', due_date TEXT, sort_order REAL DEFAULT 0, created_at TEXT DEFAULT \${T}, updated_at TEXT DEFAULT \${T}, completed_at TEXT);
CREATE TABLE IF NOT EXISTS project_comments (id \${ID}, issue_id INTEGER NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, body TEXT NOT NULL, created_at TEXT DEFAULT \${T});
CREATE TABLE IF NOT EXISTS project_activity (id \${ID}, issue_id INTEGER REFERENCES project_issues(id) ON DELETE CASCADE,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, detail TEXT DEFAULT '', at TEXT DEFAULT \${T});
CREATE INDEX IF NOT EXISTS idx_pact_issue ON project_activity(issue_id, id);
CREATE TABLE IF NOT EXISTS project_deps (issue_id INTEGER NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE,
  depends_on INTEGER NOT NULL REFERENCES project_issues(id) ON DELETE CASCADE, PRIMARY KEY (issue_id, depends_on));
`);
    // Timeline: when work starts (due_date is when it ends).
    ctx.point("db.schema").addColumns([["project_issues", "start_date", "TEXT"]]);
    ctx.point("http.routes").add((app, deps) => require("./routes")(app, deps));
    ctx.point("ui.nav").add({ href: "/m/project", label: "Project", admin: true, order: 80 });
  },
};
