-- Build A (Matt) database schema. Safe to run more than once.
-- Source of truth for Build A only: see specs/001-superintelligence-homepage/data-model.md.

-- users: REQ-009, REQ-011, REQ-012. No email or other personal data.
CREATE TABLE IF NOT EXISTS users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- 3–30 characters: letters, numbers, `_`, `-`; unique ignoring case
  username      text NOT NULL CHECK (username ~ '^[A-Za-z0-9_-]{3,30}$'),
  -- scrypt hash with salt; never returned or logged
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));

-- sessions: REQ-010
CREATE TABLE IF NOT EXISTS sessions (
  -- SHA-256 of the cookie's random token
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- sources: REQ-001, REQ-008
CREATE TABLE IF NOT EXISTS sources (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  -- one of: papers, frontier-lab, safety-group, research-org, forum, newsletter
  kind       text NOT NULL CHECK (kind IN ('papers', 'frontier-lab', 'safety-group', 'research-org', 'forum', 'newsletter')),
  feed_url   text NOT NULL UNIQUE,
  last_ok_at timestamptz,
  last_error text
);

-- stories: REQ-002, REQ-005, REQ-007. Only superintelligence items are stored (REQ-003).
CREATE TABLE IF NOT EXISTS stories (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title         text NOT NULL,
  url           text NOT NULL,
  -- plain text, at most 300 characters
  summary       text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 300),
  published_at  timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_published ON stories (published_at DESC);

-- story_topics: REQ-005, REQ-017
CREATE TABLE IF NOT EXISTS story_topics (
  story_id bigint NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  -- the key phrases that matched, shown to readers
  matched  text[] NOT NULL,
  PRIMARY KEY (story_id, topic_id)
);
CREATE INDEX IF NOT EXISTS story_topics_topic ON story_topics (topic_id);

-- story_sources: REQ-004
CREATE TABLE IF NOT EXISTS story_sources (
  story_id  bigint NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
  url       text NOT NULL,
  PRIMARY KEY (story_id, source_id)
);

-- story_keys: REQ-004. key is arxiv:<id>, url:<normalized> or title:<normalized>
CREATE TABLE IF NOT EXISTS story_keys (
  key      text PRIMARY KEY,
  story_id bigint NOT NULL REFERENCES stories (id) ON DELETE CASCADE
);

-- votes: REQ-013, REQ-015, REQ-016. At most one vote per user per story.
CREATE TABLE IF NOT EXISTS votes (
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  story_id   bigint NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

-- saves: REQ-014, REQ-015, REQ-016
CREATE TABLE IF NOT EXISTS saves (
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  story_id   bigint NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

-- 2026-11-21: Google News search feeds and the AI significance judge (Build A plan, research §14–15).
-- Written as ALTERs so they also apply to databases created before this change.

-- A new source kind for news searches.
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_kind_check;
ALTER TABLE sources ADD CONSTRAINT sources_kind_check
  CHECK (kind IN ('papers', 'frontier-lab', 'safety-group', 'research-org', 'forum', 'newsletter', 'news'));

-- The outlet that published an item found through a news search (e.g. "IEEE Spectrum").
ALTER TABLE story_sources ADD COLUMN IF NOT EXISTS outlet text;

-- AI significance judgment: score 1–10 and Claude's one-line reason. NULL score = not judged yet.
ALTER TABLE stories ADD COLUMN IF NOT EXISTS ai_score smallint CHECK (ai_score BETWEEN 0 AND 10);
ALTER TABLE stories ADD COLUMN IF NOT EXISTS ai_reason text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS judged_at timestamptz;
CREATE INDEX IF NOT EXISTS stories_unjudged ON stories (published_at DESC) WHERE judged_at IS NULL;

-- 2026-11-21: decimal scores (one decimal place, e.g. 8.2) for finer ranking within a day.
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_ai_score_check;
ALTER TABLE stories ALTER COLUMN ai_score TYPE numeric(3,1);
ALTER TABLE stories ADD CONSTRAINT stories_ai_score_check CHECK (ai_score BETWEEN 0 AND 10);

-- 2026-11-22: history fill progress (Build A research §16). One row per history task.
CREATE TABLE IF NOT EXISTS history_progress (
  task_id    text PRIMARY KEY,
  cursor     text,
  done       boolean NOT NULL DEFAULT false,
  items      integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
