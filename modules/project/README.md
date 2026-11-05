# project

Linear-style project workspace for running the project: issues (SI-n) with status, priority, assignee, milestone, labels and due dates; list, board with drag and drop, milestones, activity, issue drawer, command menu and keyboard shortcuts.

- **Tables** (owned here, via `db.schema`): `project_issues`, `project_milestones`, `project_comments`, `project_activity`.
- **Routes**: `/api/admin/project/*` (`routes.js`). **Page**: `/m/project` (old `/project` redirects). **Nav**: Project (admins). **Starter**: `starter.json`.
