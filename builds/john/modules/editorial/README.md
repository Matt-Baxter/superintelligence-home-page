# Editorial publishing

Original plain-text commentary, separate from harvested publisher records. Enabled in the extended profile through modules/modules.json; the spec and research profiles do not load it.

- `/m/editorial`: admin-only authoring UI; authorization enforced on every admin API.
- `/m/journal`: guest-readable published snapshots; drafts and revision bodies never leave admin APIs.
- `editorial_posts`: current draft plus the independently retained published snapshot, stable unique slug and optimistic revision counter.
- `editorial_revisions`: newest 20 snapshots per post; create, save, publish, unpublish and restore actions. At most 200 posts, with a serialized admission check across Postgres server instances; bodies capped at 20,000 characters. No polling or paid integration.
- All mutations use a database transaction including the revision and admin audit receipt. Updates require the current revision. Restore creates a new draft; published text stays unchanged until explicitly republished. Unpublish immediately removes the public view.

Public routes: `GET /api/editorial/posts`, `GET /api/editorial/posts/:slug`. Admin routes: list/detail/create/update under `/api/admin/editorial/posts`; `POST /api/admin/editorial/posts/:id/restore`. Publication requires an original-content confirmation. Text is escaped with DOM textContent and never treated as HTML or an external tool instruction.

Serves existing extended REQ-031/032 authoring/publication behavior alongside shared REQ-007/018. Shared specifications and deployment approval gates are unchanged. This module adds no source-feed ingestion and makes no claim of reviewed scientific evidence.
