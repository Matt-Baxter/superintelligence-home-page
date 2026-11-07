# Snapshot: john-extended-2026-11-07

Saved version of the site for later analysis. Ref `snapshot/john-extended-2026-11-07`, commit `69752aa189`, 2026-11-06. Re-create it with `git checkout snapshot/john-extended-2026-11-07`.

| Measure | Value |
| --- | --- |
| Spec requirements traced | 20 of 20 |
| API routes · tables · pages | 93 · 24 · 15 |
| Modules | 8: blocks-core, generative-ui, decision, capabilities, admin, project, codemap, learn |
| json-render blocks | 16 |
| Lines: lib · modules · pages | 668 · 1625 · 1949 |
| Browser-test checks | 150 |
| Agent-kit skills | 16 |
| Profiles | none (one version) |
| Beyond the shared spec | notes, reading lists, weekly brief, source suggestions, in-app agent log, Learn layer, project tracker, codebase map, capability tracker |

<details><summary>Routes</summary>

- `POST /api/signup`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/ontology`
- `GET /api/stories`
- `GET /api/stories/:id`
- `POST /api/stories/:id/vote`
- `POST /api/stories/:id/save`
- `POST /api/stories/:id/notes`
- `DELETE /api/notes/:id`
- `POST /api/stories`
- `GET /api/lists`
- `POST /api/lists`
- `GET /api/lists/:id`
- `PUT /api/lists/:id/items/:sid`
- `POST /api/lists/:id/follow`
- `DELETE /api/lists/:id`
- `GET /api/sources`
- `POST /api/sources/suggest`
- `PUT /api/sources/:id`
- `POST /api/sources/fetch`
- `GET /api/cron/fetch`
- `GET /api/agent-log`
- `POST /api/agent-log`
- `GET /api/agent-log/:id`
- `PUT /api/agent-log/:id`
- `DELETE /api/agent-log/:id`
- `GET /api/agent-log-export.md`
- `GET /api/brief`
- `GET /api/agent-log-view`
- `GET /api/catalog`
- `GET /api/modules`
- `GET /api/admin/overview`
- `GET /api/admin/sources`
- `POST /api/admin/sources/test`
- `POST /api/admin/sources/discover`
- `POST /api/admin/sources`
- `PUT /api/admin/sources/:id`
- `DELETE /api/admin/sources/:id`
- `POST /api/admin/sources/:id/harvest`
- `POST /api/admin/harvest`
- `GET /api/admin/runs`
- `GET /api/admin/catalog`
- `POST /api/admin/catalog/enable`
- `GET /api/admin/opml`
- `POST /api/admin/opml`
- `GET /api/admin/users`
- `PUT /api/admin/users/:id`
- `GET /api/admin/stories`
- `PUT /api/admin/stories/:id`
- `GET /api/admin/notes`
- `DELETE /api/admin/notes/:id`
- `GET /api/admin/ontology`
- `POST /api/admin/retag`
- `GET /api/admin/audit`
- `GET /api/capabilities`
- `GET /api/codemap`
- `GET /api/codemap/trace`
- `GET /api/codemap/ask`
- `GET /api/judges`
- `POST /api/judges/:id/run`
- `GET /api/ui/catalog`
- `POST /api/ui/validate`
- `GET /api/ui/views`
- `GET /api/ui/views/:name`
- `GET /api/learn/concepts`
- `GET /api/learn/concepts/:id`
- `GET /api/learn/explainer/:id`
- `GET /api/learn/story/:id`
- `POST /api/learn/teardown`
- `GET /api/admin/learn/jobs`
- `POST /api/admin/learn/jobs`
- `GET /api/admin/learn/jobs/:id`
- `PUT /api/admin/learn/jobs/:id`
- `DELETE /api/admin/learn/jobs/:id`
- `GET /learn/feed.xml`
- `GET /api/learn/posts/:id`
- `GET /api/admin/project/meta`
- `GET /api/admin/project/issues`
- `POST /api/admin/project/issues`
- `GET /api/admin/project/issues/:n`
- `PUT /api/admin/project/issues/:n`
- `POST /api/admin/project/issues/:n/deps`
- `DELETE /api/admin/project/issues/:n/deps/:m`
- `DELETE /api/admin/project/issues/:n`
- `POST /api/admin/project/issues/:n/comments`
- `DELETE /api/admin/project/comments/:id`
- `POST /api/admin/project/milestones`
- `PUT /api/admin/project/milestones/:id`
- `DELETE /api/admin/project/milestones/:id`
- `GET /api/admin/project/activity`
- `POST /api/admin/project/starter`

</details>

<details><summary>Tables</summary>

`users`, `sessions`, `sources`, `stories`, `story_keys`, `story_links`, `story_topics`, `votes`, `saves`, `notes`, `lists`, `list_items`, `follows`, `agent_log`, `agent_log_saves`, `fetch_runs`, `admin_audit`, `story_entities`, `learn_jobs`, `project_milestones`, `project_issues`, `project_comments`, `project_activity`, `project_deps`

</details>
