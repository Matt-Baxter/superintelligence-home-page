-- Combined Build database schema (isolated inside __SCHEMA__, default: si_combined).
-- Idempotent and safe to run repeatedly against Neon Postgres without touching public.* tables.
-- Satisfies REQ-001..REQ-018 and REQ-C01..REQ-C10.

CREATE SCHEMA IF NOT EXISTS "__SCHEMA__";

-- users: REQ-009, REQ-011, REQ-012 (username + salted scrypt hash only; zero personal data)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text NOT NULL CHECK (username ~ '^[A-Za-z0-9_-]{3,30}$'),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON "__SCHEMA__".users (lower(username));

-- sessions: REQ-010 (stores SHA-256 digest of random session cookie token, never raw token)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".sessions (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES "__SCHEMA__".users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON "__SCHEMA__".sessions (user_id);

-- sources: REQ-001, REQ-008, REQ-C07
CREATE TABLE IF NOT EXISTS "__SCHEMA__".sources (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('papers', 'frontier-lab', 'safety-group', 'research-org', 'forum', 'newsletter', 'news')),
  feed_url        text NOT NULL UNIQUE,
  home_url        text NOT NULL DEFAULT '',
  role_label      text NOT NULL DEFAULT 'primary',
  review_label    text NOT NULL DEFAULT 'editorial',
  independence    text NOT NULL DEFAULT 'independent',
  provenance_note text NOT NULL DEFAULT '',
  last_ok_at      timestamptz,
  last_error      text
);

-- stories: REQ-002..REQ-007, REQ-C01..REQ-C04
CREATE TABLE IF NOT EXISTS "__SCHEMA__".stories (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title              text NOT NULL,
  url                text NOT NULL,
  summary            text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 300),
  authors            text NOT NULL DEFAULT '',
  published_at       timestamptz NOT NULL,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  in_scope           boolean NOT NULL DEFAULT true,
  scope_reason       text NOT NULL DEFAULT '',
  significance_score smallint NOT NULL DEFAULT 0 CHECK (significance_score BETWEEN 0 AND 100),
  rigor_score        smallint NOT NULL DEFAULT 0 CHECK (rigor_score BETWEEN 0 AND 100),
  hype_score         smallint NOT NULL DEFAULT 0 CHECK (hype_score BETWEEN 0 AND 100),
  credibility_band   text NOT NULL DEFAULT 'preliminary',
  formal_rung        text NOT NULL DEFAULT 'none',
  paper_rigor        jsonb NOT NULL DEFAULT '{}'::jsonb,
  update_type        text NOT NULL DEFAULT 'update',
  evidence_level     text NOT NULL DEFAULT 'preprint',
  why_breakdown      jsonb NOT NULL DEFAULT '[]'::jsonb,
  orgs               jsonb NOT NULL DEFAULT '[]'::jsonb,
  benchmarks         jsonb NOT NULL DEFAULT '[]'::jsonb,
  people             jsonb NOT NULL DEFAULT '[]'::jsonb,
  code_urls          jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_score           numeric(3,1) CHECK (ai_score BETWEEN 0 AND 10),
  ai_reason          text,
  ai_model           text,
  ai_tier            smallint,
  ai_verdict         text,
  ai_confidence      numeric(4,3),
  ai_trail           jsonb NOT NULL DEFAULT '[]'::jsonb,
  judged_at          timestamptz
);

-- Idempotent additive migrations for existing schemas
ALTER TABLE "__SCHEMA__".stories ADD COLUMN IF NOT EXISTS rigor_score smallint NOT NULL DEFAULT 0;
ALTER TABLE "__SCHEMA__".stories ADD COLUMN IF NOT EXISTS hype_score smallint NOT NULL DEFAULT 0;
ALTER TABLE "__SCHEMA__".stories ADD COLUMN IF NOT EXISTS credibility_band text NOT NULL DEFAULT 'preliminary';
ALTER TABLE "__SCHEMA__".stories ADD COLUMN IF NOT EXISTS formal_rung text NOT NULL DEFAULT 'none';
ALTER TABLE "__SCHEMA__".stories ADD COLUMN IF NOT EXISTS paper_rigor jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS stories_published_idx ON "__SCHEMA__".stories (published_at DESC);
CREATE INDEX IF NOT EXISTS stories_significance_idx ON "__SCHEMA__".stories (significance_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS stories_rigor_idx ON "__SCHEMA__".stories (rigor_score DESC, significance_score DESC);
CREATE INDEX IF NOT EXISTS stories_in_scope_idx ON "__SCHEMA__".stories (in_scope, published_at DESC);

-- story_topics: REQ-005, REQ-017, REQ-C01 (stores both root spec topics and rolled-up subtopic lineage)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".story_topics (
  story_id bigint NOT NULL REFERENCES "__SCHEMA__".stories (id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  is_root  boolean NOT NULL DEFAULT true,
  matched  text[] NOT NULL DEFAULT '{}',
  via      text,
  PRIMARY KEY (story_id, topic_id)
);
CREATE INDEX IF NOT EXISTS story_topics_topic_idx ON "__SCHEMA__".story_topics (topic_id, story_id);

-- story_sources: REQ-004, REQ-C03 (tracks outlet and first_seen_at per source for lag computation)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".story_sources (
  story_id      bigint NOT NULL REFERENCES "__SCHEMA__".stories (id) ON DELETE CASCADE,
  source_id     text NOT NULL REFERENCES "__SCHEMA__".sources (id) ON DELETE CASCADE,
  url           text NOT NULL,
  outlet        text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, source_id)
);

-- story_keys: REQ-004 (arxiv:<id> > doi:<id> > url:<norm> > title:<norm>)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".story_keys (
  key      text PRIMARY KEY,
  story_id bigint NOT NULL REFERENCES "__SCHEMA__".stories (id) ON DELETE CASCADE
);

-- votes: REQ-013, REQ-015, REQ-016
CREATE TABLE IF NOT EXISTS "__SCHEMA__".votes (
  user_id    bigint NOT NULL REFERENCES "__SCHEMA__".users (id) ON DELETE CASCADE,
  story_id   bigint NOT NULL REFERENCES "__SCHEMA__".stories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
CREATE INDEX IF NOT EXISTS votes_story_idx ON "__SCHEMA__".votes (story_id);

-- saves: REQ-014, REQ-015, REQ-016
CREATE TABLE IF NOT EXISTS "__SCHEMA__".saves (
  user_id    bigint NOT NULL REFERENCES "__SCHEMA__".users (id) ON DELETE CASCADE,
  story_id   bigint NOT NULL REFERENCES "__SCHEMA__".stories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

-- history_progress: REQ-C04 (resumable 2015-present archive backfill cursor state)
CREATE TABLE IF NOT EXISTS "__SCHEMA__".history_progress (
  task_id    text PRIMARY KEY,
  cursor     text,
  done       boolean NOT NULL DEFAULT false,
  items      integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
