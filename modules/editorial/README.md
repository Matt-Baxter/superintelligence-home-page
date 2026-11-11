# Editorial publishing

Original plain-text commentary, separate from harvested publisher records. Enabled in the extended profile through modules/modules.json; the spec and research profiles do not load it.

- `/m/editorial`: admin-only authoring UI; authorization enforced on every admin API.
- `/m/journal`: guest-readable published snapshots; drafts and revision bodies never leave admin APIs.
- `editorial_posts`: current draft plus the independently retained published snapshot, stable unique slug and optimistic revision counter.
- `editorial_revisions`: newest 20 snapshots per post; create, save, publish, unpublish and restore actions. At most 200 posts, with a serialized admission check across Postgres server instances; bodies capped at 20,000 characters. No polling or paid integration.
- All mutations use a database transaction including the revision and admin audit receipt. Updates require the current revision. Restore creates a new draft; published text stays unchanged until explicitly republished. Unpublish immediately removes the public view.

Public routes: `GET /api/editorial/posts`, `GET /api/editorial/posts/:slug`. Admin routes: list/detail/create/update under `/api/admin/editorial/posts`; `POST /api/admin/editorial/posts/:id/restore`. Publication requires an original-content confirmation. Text is escaped with DOM textContent and never treated as HTML or an external tool instruction.

Serves existing extended REQ-031/032 authoring/publication behavior alongside shared REQ-007/018. Shared specifications and deployment approval gates are unchanged. This module adds no source-feed ingestion and makes no claim of reviewed scientific evidence.

## Delivery, generation and channels (proposed REQ-054, REQ-055)

- **Delivery**: `GET /api/editorial/feed.xml` (RSS 2.0) and `GET /api/editorial/feed.json` (JSON Feed 1.1) list the newest 50 published posts; `/m/journal?slug=…&embed=1` is a bare card for another site's iframe. Drafts and revisions are never delivered.
- **Generate a draft** (Editorial CMS, left column): weekly digest, topic round-up or story explainer, written by rules in `content.js` from the stored stories, their scores and their explanations. No model calls, no authors named, no claim put in anyone's mouth. The draft's first revision is recorded as `generate`; a person edits and publishes it.
- **Channel versions**: blog Markdown, newsletter, Bluesky, Threads, Mastodon and LinkedIn text of the saved draft, each within its network's limit. Nothing is posted; there is no Twitter/X version.
