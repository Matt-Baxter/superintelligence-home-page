# Data Model: Build A (Matt)

Phase 1 output of `/speckit-plan`. Neon Postgres. Field names are indicative; the
implementation's `builds/matt/db/schema.sql` is the source of truth for Build A only. (In the
bake-off, each build designs its own schema; contract, Section 3.)

## Tables

### users — REQ-009, REQ-011, REQ-012

| Field | Type | Rules |
|-------|------|-------|
| id | bigint, generated | primary key |
| username | text | 3–30 characters: letters, numbers, `_`, `-`; unique ignoring case |
| password_hash | text | scrypt hash with salt; never returned or logged |
| created_at | timestamptz | default now() |

No email or other personal data (REQ-012).

### sessions — REQ-010

| Field | Type | Rules |
|-------|------|-------|
| token_hash | text | primary key; SHA-256 of the cookie's random token |
| user_id | bigint | references users, delete cascade |
| expires_at | timestamptz | 30 days after sign-in; expired rows are ignored and cleaned up |

### sources — REQ-001, REQ-008

| Field | Type | Rules |
|-------|------|-------|
| id | text | primary key, short slug (e.g. `alignment-forum`) |
| name | text | display name |
| kind | text | one of: `papers`, `frontier-lab`, `safety-group`, `research-org`, `forum`, `newsletter` |
| feed_url | text | unique |
| last_ok_at | timestamptz, nullable | last successful fetch |
| last_error | text, nullable | short message from the last failed fetch |

Seeded from `lib/sources.ts`.

### stories — REQ-002, REQ-005, REQ-007

| Field | Type | Rules |
|-------|------|-------|
| id | bigint, generated | primary key |
| title | text | plain text |
| url | text | link to the original (the first source's link) |
| summary | text | plain text, at most 300 characters (REQ-007, REQ-021) |
| published_at | timestamptz | earliest publish date across its sources; feed is sorted by this, newest first |
| first_seen_at | timestamptz | default now() |

Only items matching at least one superintelligence topic are ever stored (REQ-003).

### story_topics — REQ-005, REQ-017

| Field | Type | Rules |
|-------|------|-------|
| story_id | bigint | references stories, delete cascade |
| topic_id | text | one of the 9 topic IDs in `lib/topics.ts` (e.g. `alignment`) |
| matched | text[] | the key phrases that matched, shown to readers |

Primary key (story_id, topic_id).

### story_sources — REQ-004

| Field | Type | Rules |
|-------|------|-------|
| story_id | bigint | references stories, delete cascade |
| source_id | text | references sources |
| url | text | this source's link to the item |

Primary key (story_id, source_id).

### story_keys — REQ-004

| Field | Type | Rules |
|-------|------|-------|
| key | text | primary key: `arxiv:<id>`, `url:<normalized>` or `title:<normalized>` |
| story_id | bigint | references stories, delete cascade |

### votes — REQ-013, REQ-015, REQ-016

| Field | Type | Rules |
|-------|------|-------|
| user_id | bigint | references users, delete cascade |
| story_id | bigint | references stories, delete cascade |
| created_at | timestamptz | default now() |

Primary key (user_id, story_id): at most one vote per user per story. Toggling a vote inserts
or deletes the row for the signed-in user only.

### saves — REQ-014, REQ-015, REQ-016

Same shape as `votes`.

### fetch_runs — refresh lock (research §2)

| Field | Type | Rules |
|-------|------|-------|
| id | int | single row, always 1 |
| started_at | timestamptz, nullable | set when a fetch starts; a fetch only starts if this is empty or older than 5 minutes |
| finished_at | timestamptz, nullable | last completed fetch; the feed page refreshes in the background when this is more than 30 minutes old |

## Relationships

```text
users 1─* sessions
users 1─* votes *─1 stories
users 1─* saves *─1 stories
stories 1─* story_topics
stories 1─* story_sources *─1 sources
stories 1─* story_keys
```

## Flow of one fetched item

```text
feed item → drop if link is Twitter/X (REQ-006)
          → HTML to plain text, cut summary to 300 chars (REQ-007, REQ-021)
          → match key phrases as whole words; drop if no topic matches (REQ-003)
          → build keys (arXiv ID, URL, title); if any key exists, add this source to that story
            (REQ-004), otherwise create a new story with its topics and keys
```
