# Contract

SEIS 606 Project 2 · Superintelligence Homepage · John Affolter and Matthew Baxter

**Version 0.4 · November 4, 2026 · draft, not yet approved by both partners.**

This contract serves both halves of our **mix**: the split parts must fit together, and both bake-off versions must meet the same API and data models so the comparison is fair. Matt's accounts, data and API layer is the shared base. Each bake-off version writes stories into the shared schema and reads only through the API. If something isn't written here, neither side may depend on it.

## Change log

Every change is approved by both of us and gets a row here. Breaking changes bump the major version (1.0 → 2.0). Tick your box by editing this file in a pull request.

| Version | Date | Change | Approved by |
| --- | --- | --- | --- |
| 0.1 | Nov 4, 2026 | First draft: data models, API, auth, rules, milestones | John ☐ · Matt ☐ |
| 0.2 | Nov 4, 2026 | Project choice is now a mix: split base (accounts, data, API, deploy) plus a bake-off on the homepage experience, judged by CLEF or JEV and signed off by both. Roles table to revisit for the bake-off parts. | John ☐ · Matt ☐ |
| 0.3 | Nov 4, 2026 | Bake-off tools: John on v0, Matt on Claude. Hosting moves to Vercel (John's account) from Matt's GitHub repo, so data moves from SQLite to hosted Postgres and the 30-minute feed fetch becomes a Vercel Cron Job. | John ☐ · Matt ☐ |
| 0.4 | Nov 4, 2026 | **Proposed by John (built with Claude), needs Matt's approval.** Harvesting and admin layer. Adds tables `fetch_runs` and `admin_audit`; adds columns to `sources` (interval_minutes, max_items, etag, last_modified, failures, next_due_at, verified, from_catalog), `users` (disabled) and `stories` (hidden, hidden_reason); new source kinds `news`, `policy` and formats `jsonfeed`, `hn-algolia`, `semantic-scholar`; new `/api/admin/*` routes. Additive only: existing routes keep their shapes, except that `/api/stories` no longer returns hidden stories and `/api/cron/fetch` now returns a run summary around the same `report`. | John ☐ · Matt ☐ |

**Done means:** a classmate can sign up on the live site, see a grouped, tagged feed from at least 8 sources, and vote on and save stories that are still there the next time they sign in.

## Phases and gates

1. **Plan:** working agreement, spec and contract emailed to Paul by Nov 11. *Gate: Paul OKs the spec.*
2. **Core build:** accounts, sources, grouping and tags, votes, saves, agent log. *Gate: must-haves pass.*
3. **Deploy and share:** live URL with class accounts open, at least 2 weeks before our presentation. *Gate: class feedback in.*
4. **Polish and present:** weekly brief, lists, fixes from feedback, agent log complete.

The presentation date sets phases 3 and 4; we'll fill in exact dates once Paul confirms it.

## Acceptance criteria (the must-haves)

- [ ] A visitor can create an account; passwords are hashed; a session lasts across visits.
- [ ] At least 8 sources across at least 5 kinds (papers, lab, research org, forum, newsletter, academic, community) are fetched on a schedule. None are Twitter/X.
- [ ] One paper or announcement seen in several sources shows as one story listing every source.
- [ ] Every story has at least one topic tag or is marked untagged; each tag shows the words that matched.
- [ ] Votes and saves are stored per user and survive sign-out and redeploys.
- [ ] Users only edit or delete what they created; the server enforces it, not just the UI.
- [ ] The Agent log page lets each partner add, edit and export their own entries.
- [ ] The app is live at a public URL and shared with the class at least 2 weeks before our presentation.

## Integration milestones (decision points)

| # | Milestone | Proves the parts fit when | Decision |
| --- | --- | --- | --- |
| M1 | Contract approved | Both boxes in the change log are ticked | Freeze v1.0; build starts |
| M2 | Ingestion writes to the shared schema | The sample feeds load and `GET /api/stories` returns grouped, tagged stories | Build the UI against real data, not mocks |
| M3 | UI on the live API | Two test users vote and save, and see each other's votes counted | Cut should-haves if behind |
| M4 | Deployed and shared | A classmate signs up on the public URL | Open to the class |

## Data models

Hosted Postgres in production (Vercel functions can't keep a SQLite file between requests); SQLite locally and in tests, through the same queries (`lib/db.js`). Matt owns the schema. Ingestion code writes only to the three story tables.

| Table | Fields (type) | Written by |
| --- | --- | --- |
| users | id int, username text unique (case-insensitive), display_name text, pass_hash text, is_admin bool, disabled bool | API |
| sessions | token text, user_id int, expires_at bigint (ms) | API |
| sources | id, name, kind (papers, lab, research-org, forum, newsletter, academic, community, news, policy), format (rss, arxiv, hf-daily, jsonfeed, hn-algolia, semantic-scholar), url unique, status (active, paused, pending, rejected), last_ok, last_error; harvest settings and state: interval_minutes (default 360), max_items (default 50), etag, last_modified, failures, next_due_at, verified, from_catalog | API (admin); the harvester updates fetch state |
| stories | id, title, url, summary, authors, published_at ISO, first_seen ISO, topics JSON, orgs JSON, hidden bool, hidden_reason | Ingestion; `hidden` by admins only |
| story_keys | key text (arxiv:…, url:…, title:…), story_id | Ingestion |
| story_links | story_id, source_id, url, title, published_at | Ingestion |
| votes, saves | user_id, story_id | API |
| notes | id, user_id, story_id, text, private bool | API |
| lists, list_items, follows | list: id, owner_id, title, public bool; items: list_id, story_id, note | API |
| agent_log, agent_log_saves | entry: author_id, session_date, went_wrong, caught_how, fix, link, status; saves: chars typed, pasted, active ms | API |
| fetch_runs | id, source_id, trigger (cron, schedule, admin), started_at, finished_at, status (ok, not_modified, error), items, stored, error, duration_ms; newest 2000 kept | Harvester |
| admin_audit | id, admin_id, action, target, detail, at | Admin API |

All timestamps are ISO 8601 UTC strings (`2026-11-04T19:30:00Z`). A story's `topics` field is a list of `{"id":"reasoning","label":"Reasoning","matched":["chain of thought"]}`, so the UI can always show why a tag was applied.

**Ingestion interface.** Each feed item is normalized to `{title, url, summary, published, authors[], score?}` and stored with `addItem(item, sourceId)`. That function owns grouping: an arXiv id beats a URL, and a URL beats a normalized title.

## API

JSON over HTTPS. Requests send `Content-Type: application/json`.

| Method and path | Request | Response (200) |
| --- | --- | --- |
| POST /api/signup | `{username, password, displayName}` | `{user:{id, username, name, admin}}` + session cookie |
| POST /api/login, /api/logout | `{username, password}` | `{user}` / `{ok:true}` |
| GET /api/me | none | `{user}` or `{user:null}` |
| GET /api/stories | query: `topic, kind, org, q, days, saved=1, sort=top\|new\|votes, offset` | `{stories:[{id, title, url, summary, topics, orgs, votes, voted, saved, notes, sources:[{name, kind, url}], nsources}]}`, 40 per page |
| GET /api/stories/:id | none | `{story, notes:[…], lists:[…], inPublicLists:[…]}` |
| POST /api/stories/:id/vote, /save | none | `{voted, votes}` / `{saved}` (toggles) |
| POST /api/stories/:id/notes | `{text, private}` | `{ok:true}` |
| POST /api/stories | `{url, title, summary?}` (submit a link) | `{id}` |
| GET, POST /api/lists; GET /api/lists/:id | `{title, description, public}` | `{lists}` / `{id}` / `{list, stories}` |
| PUT /api/lists/:id/items/:storyId | `{note}` or `{remove:true}` | `{ok:true}` |
| GET /api/sources; POST /api/sources/suggest | `{name, url, kind, format}` | `{sources}` / `{ok, status}` |
| GET /api/brief | query: `week=YYYY-MM-DD` | `{spec, week}`: a json-render spec |
| GET, POST /api/agent-log; PUT /api/agent-log/:id | `{went_wrong, caught_how, fix, link, typedDelta, pastedDelta, activeDeltaMs, submit?}` | `{entries}` / `{entry}` |
| GET /api/cron/fetch | header `Authorization: Bearer $CRON_SECRET` (sent by Vercel Cron) | `{trigger, sources, ok, errors, stored, notReached, ms, report:[…]}`; harvests only sources that are due |
| `/api/admin/*` (admins only, 403 otherwise) | overview; sources (list, test, discover, add, edit, delete, harvest one); harvest (due or all); runs; catalog and catalog/enable; opml export and import; users (admin, disabled); stories (hide, unhide); shared notes (delete); ontology; retag; audit | See `lib/admin.js`. Every change writes an `admin_audit` row. Admins can't read others' agent log drafts. |

## Auth

Passwords are hashed with scrypt; sign-in sets an httpOnly session cookie that lasts 30 days. Every route except sign-up, sign-in and `/api/me` needs a session. The first account becomes the admin, who approves sources. Users can change only what they created (notes, lists, their own agent log entries), and the server checks this on every write.

## Rules

- **Errors:** every failure returns `{"error":"<a sentence a person can act on>"}` with 400 (bad input), 401 (not signed in), 403 (not yours), 404 (not found) or 429 (too many requests). 500 never includes internal details.
- **Mock data:** both of us develop against the synthetic sample feeds in `test/fixtures` and made-up users. Mock records are labelled "Sample" and never reach the live site.
- **Schema ownership:** Matt owns the schema. Changing a table or an API response shape means a pull request both of us approve, plus a new row in the change log above.
- **Twitter/X:** not a source, and submitted links to it are refused.

## Changes

Both partners approve every change, and each one gets a row in the change log with its date. Breaking changes bump the major version (1.0 → 2.0).

## Mini bake-offs

For a choice with two candidate builds:

1. Write a one-paragraph shared spec and its acceptance tests.
2. Agree on the comparison criteria and their weights before either of us builds (for example correctness on the tests, speed, code size, how well it fits the API above).
3. Both builds must meet this contract's API and data models; only the internals may differ.
4. CLEF or JEV scores both and recommends one, or a merge.
5. We both approve or override, and log the decision, its scores and our reason as a new version row.
