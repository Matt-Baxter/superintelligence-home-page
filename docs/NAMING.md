# Naming convention

One way to name routes, tables, labels, tags and metadata, so people, agents and the codebase map all agree. `scripts/naming.js` checks every rule marked **(checked)** in preflight.

## Identifiers and tags

- **Bare ids are kebab-case** (`automating-ai-research`, `swe-bench`) **(checked)**. Requirement ids keep the spec's form: `REQ-003`.
- **A qualified id is `namespace:id`** (`lib/ids.js`). The namespaces:

  | Namespace | Example | What |
  | --- | --- | --- |
  | `topic:` | `topic:alignment` | ontology topic |
  | `org:` | `org:openai` | organisation |
  | `benchmark:` | `benchmark:swe-bench` | benchmark |
  | `person:` | `person:<watchlist id>` | watchlist entry (never claims about them) |
  | `concept:` | `concept:attention` | Learn concept |
  | `req:` | `req:REQ-003` | shared-spec requirement |
  | `module:` | `module:learn` | plug-in module |
  | `source:`, `story:` | `story:42` | database rows |

- **Every tag carries its `qid`**, the words that `matched` and, for parent topics, `via` (the child topic that implied it). A tag must be able to explain itself (REQ-005/SC-006).
- **Filter by tag** with qualified ids: `GET /api/stories?tag=topic:alignment,org:openai` (all must match).
- **Ids are unique within their namespace** **(checked)**. References point at real ids: topic `parent`, benchmark `measures`, concept `topic` and relations **(checked)**.
- **Top-level topics are the spec's fixed list** of nine **(checked)**. Their labels match the spec's Assumptions word for word.
- **Labels** (what people read) are sentence case: "Automating AI research", not "Automating Ai Research".
- **Project labels** are kebab-case, or a requirement id that exists in the spec (`REQ-007`) **(checked)**.

## Routes

- **JSON APIs live under `/api/`.** Path segments are lowercase kebab-case nouns. Parameters are `:id`, `:n` (issue number), `:sid` (story id) **(checked)**. A file-like response keeps its extension: `/api/learn/feed.xml`.
- **Admin-only routes live under `/api/admin/`** **(checked)**, and a route under `/api/admin/` must require an admin **(checked)**.
- **A module's routes start with its id:** `/api/<module>/…` or `/api/admin/<module>/…`. A module may declare short aliases in its manifest (`api: ["/api/ui"]`) **(checked)**. The admin module's id is `admin`, so its routes are `/api/admin/…`.
- **Core routes never use a module's prefix** **(checked)**.
- **Pages:** core pages are `/<name>`; module pages are `/m/<name>`.
- **Verbs:** `GET` reads, `POST` creates or runs (`/run`, `/harvest`), `PUT` updates, `DELETE` removes. Toggles are `POST /api/stories/:id/vote`.

## Tables and columns

- **snake_case**, plural for tables (`stories`, `story_keys`) **(checked: snake_case)**.
- **A module's tables start with its id** (`project_issues`, `learn_jobs`) **(checked)**. Core tables live in `lib/db.js`.
- Columns: `id`, `<thing>_id` for references, `created_at`/`updated_at` as ISO text, booleans as `is_x`/`x` integers.

## Metadata

- **Every data file has an `about`** saying what it is and who may change it, and the ontology and the Learn concepts carry a `version` **(checked)**. This covers `lib/ontology.json`, `lib/sources.json`, `modules/*/data/*.json`, `modules/profiles.json` and `modules/project/starter.json`.
- **Every module manifest has `id`** (equal to its folder), **`version`** (semver) and **`description`** **(checked)**.
- **Branches:** `feature/`, `fix/`, `bakeoff/`. **Saved versions:** branch `feature/snapshot-<who>-<what>-<yyyy-mm-dd>` (GitHub tags can't be pushed from agent sessions) (see `docs/snapshots/`).
- **Commits and pull requests name the REQ ids they serve** (spec first).
