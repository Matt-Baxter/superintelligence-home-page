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
