# project

Linear-style project workspace for running the project: issues (SI-n) with status, priority, assignee, milestone, labels and due dates; list, board with drag and drop, milestones, activity, issue drawer, command menu and keyboard shortcuts.

- **Tables** (owned here, via `db.schema`): `project_issues`, `project_milestones`, `project_comments`, `project_activity`.
- **Routes**: `/api/admin/project/*` (`routes.js`). **Page**: `/m/project` (old `/project` redirects). **Nav**: Project (admins). **Starter**: `starter.json`.

## Specs (1.2.0, proposed REQ-030)

`/m/project#/specs`: every requirement in `specs/<nnn>/spec.md`, one table per spec, with its status (approved for the shared 001, proposed otherwise, from the spec's Status line), where it lives and how it's checked (`docs/SPEC_TRACE.md`), its Spec Kit tasks (`tasks.md`, with the agent/rules/people tag), people checks (`sync.json`), the measured status (`docs/SPEC_STATUS.md`) and the SI-n issues labelled with it. Filters: spec, status, who, has open tasks.

- **Route:** `GET /api/admin/project/specs` (`specs.js` parses; `routes.js` adds issues). Shape in docs/INTERFACES.md 1.11.
- **Sync:** issues come from `node scripts/project-sync.js`, which runs outside the web server; the page shows the command rather than a button.
- **Vercel:** `npm run build` writes `data/specs.json` (git-ignored) via `scripts/spec-index.js`, read when `specs/` isn't in the bundle.
- **Test:** `node test/project-specs-unit.js` (preflight) and the e2e "Project specs" section.


`/m/project#/timeline` (shortcut G then T): issues with a start and due date drawn as bars, grouped by milestone, with day/week/month zoom, a today line and weekend bands.

- **Dependencies:** "Blocked by" in the issue drawer adds links (`project_deps`). The server refuses self-links and loops. Arrows join each task to what it waits on.
- **Conflicts:** a task that starts before something it depends on ends turns red, and the timeline lists a warning. Conflicts are worked out on the server (`conflicts()` in `routes.js`), so the list and the API agree.
- **Editing:** drag a bar to move it, or drag either end to change its start or due date. Dates snap to days and save when you let go. Undo puts back the last move.
- Fits `/speckit-tasks`, which writes dependency-ordered tasks: import them as issues and link each to what it depends on.
