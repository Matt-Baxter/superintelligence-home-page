# Pipeline, step by step

## 1. Picking sources (`lib/harvest.js`)
- `harvest({trigger, force, sourceId})` selects active sources whose `next_due_at` has passed (all of them with `force`).
- Runs 5 at a time; stops starting new fetches after `HARVEST_BUDGET_MS` (45 s). Unreached sources stay due.
- Each fetch writes a `fetch_runs` row. Success: `failures = 0`, next due = now + `interval_minutes`. Failure: next due = interval × 2^(failures+1), capped at 32×.
- Triggers: Vercel cron (`/api/cron/fetch?slot=0..3`, four daily jobs), Admin buttons, the local timer (`FETCH_MINUTES`).
- After each run, `prune()` caps `fetch_runs` (2,000) and `admin_audit` (5,000) and deletes expired sessions.

## 2. Fetching and parsing (`lib/feeds.js`)
- `fetchSource(src)` → `fetchText()` with ETag/Last-Modified; a 304 returns `{notModified: true}`.
- `assertPublicUrl()` refuses private and local addresses. `fixture://name` reads `test/fixtures/name`, only when `ALLOW_FIXTURE_FEEDS=1`.
- Every format returns items `{title, url, summary, published, authors[], score?, arxivId?}`.

## 3. Grouping (`addItem` in `lib/harvest.js`)
- `feeds.storyKeys(item)` gives keys in order: `arxiv:<id>`, `url:<normalized url>`, `title:<normalized title>`.
- The first key already in `story_keys` decides the story; otherwise a new story is created. All keys are then recorded.
- Each (story, source, url) gets one `story_links` row. Coverage = distinct sources linked.

## 4. Tagging (`lib/tagger.js`)
- `tag(title, summary)` → `{topics, orgs}`; every tag carries the words that matched. A child topic adds its parent with `via`.
- Stored on `stories.topics` / `stories.orgs` (JSON) and `story_topics` (for filtering).

## 5. Judging (`lib/analysis.js`)
- `rescore(t, storyId)` runs when a story is created, when another source links to it, on Admin → Re-tag, and at boot for unscored stories (`backfill`, 300 at a time).
- Writes `stories.significance`, `stories.analysis` (JSON with `why` lines and `scope`), `stories.in_scope` (REQ-003: superintelligence-only feed) and `story_entities` (benchmarks with scores, people).
- Items linking to Twitter/X are dropped in `addItem` before any of this (REQ-006).

## 6. Serving (`server.js`)
- `storyRows(where, args, uid, {sort})` loads visible, in-scope matches (default sort: newest first, REQ-002), computes `rank` (votes, coverage, outside score, significance, age), sorts (`top`, `new`, `votes`, `signal`) and attaches links.
- The capabilities module's `/api/capabilities` aggregates topics, benchmark mentions, people and orgs over 7/30/90 days.

## 7. Modules
- At require time `server.js` creates the kernel: modules register and contribute (formats, signals, schema, prune hooks are applied before anything reads them).
- Routes from `http.routes` are mounted before static files; `start` hooks run in `boot()` after the database is ready.
- `/api/me` returns `user.nav` (core links plus `ui.nav` contributions); `/api/modules` (admins) describes modules, extension points and views.

## Tables at a glance
users, sessions · sources, fetch_runs · stories, story_keys, story_links, story_topics, story_entities · votes, saves, notes, lists, list_items, follows · agent_log, agent_log_saves · admin_audit · project_issues, project_milestones, project_comments, project_activity (owned by the project module). Shapes: `docs/CONTRACT.md`.
