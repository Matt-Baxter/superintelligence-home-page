import { sql } from "./db";
import { FEED_TIME_ZONE, JUDGE_MIN_SCORE, dailyCap, judgeMode } from "./judge";
import { TOPICS } from "./topics";

// Reads stories for the feed. (REQ-002, REQ-004, REQ-005)

export const PAGE_SIZE = 40;

export type StorySource = { name: string; kind: string; url: string; outlet: string | null };
export type StoryTopic = { id: string; label: string; matched: string[] };
export type Story = {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: Date;
  sources: StorySource[];
  topics: StoryTopic[];
  votes: number;
  voted: boolean;
  saved: boolean;
  aiScore: number | null;
  aiReason: string | null;
  aiModel: string | null;
};

const TOPIC_ORDER = new Map(TOPICS.map((t, i) => [t.id, i]));
const TOPIC_LABEL = new Map(TOPICS.map((t) => [t.id, t.label]));

type Row = {
  id: string;
  title: string;
  url: string;
  summary: string;
  published_at: Date;
  sources: StorySource[];
  topics: { id: string; matched: string[] }[];
  votes: number;
  voted: boolean;
  saved: boolean;
  ai_score: string | number | null; // numeric(3,1) comes back as a string
  ai_reason: string | null;
  ai_model: string | null;
};

function toStory(r: Row): Story {
  return {
    id: String(r.id),
    title: r.title,
    url: r.url,
    summary: r.summary,
    publishedAt: new Date(r.published_at),
    sources: r.sources,
    topics: r.topics
      .filter((t) => TOPIC_LABEL.has(t.id))
      .sort((a, b) => (TOPIC_ORDER.get(a.id) ?? 0) - (TOPIC_ORDER.get(b.id) ?? 0))
      .map((t) => ({ id: t.id, label: TOPIC_LABEL.get(t.id)!, matched: t.matched })),
    votes: Number(r.votes),
    voted: r.voted,
    saved: r.saved,
    aiScore: r.ai_score === null ? null : Number(r.ai_score),
    aiReason: r.ai_reason,
    aiModel: r.ai_model,
  };
}

// Columns shared by the feed and the saved list. userId is the signed-in user, or 0 for a
// visitor (no user has ID 0, so voted and saved are false).
function storyColumns(userId: string) {
  return sql`
    s.id, s.title, s.url, s.summary, s.published_at, s.ai_score, s.ai_reason, s.ai_model,
    COALESCE((
      SELECT json_agg(json_build_object('name', src.name, 'kind', src.kind, 'url', ss.url, 'outlet', ss.outlet) ORDER BY src.name)
      FROM story_sources ss JOIN sources src ON src.id = ss.source_id
      WHERE ss.story_id = s.id
    ), '[]') AS sources,
    COALESCE((
      SELECT json_agg(json_build_object('id', st.topic_id, 'matched', st.matched))
      FROM story_topics st WHERE st.story_id = s.id
    ), '[]') AS topics,
    (SELECT count(*) FROM votes v WHERE v.story_id = s.id) AS votes,
    EXISTS (SELECT 1 FROM votes v WHERE v.story_id = s.id AND v.user_id = ${userId}) AS voted,
    EXISTS (SELECT 1 FROM saves sv WHERE sv.story_id = s.id AND sv.user_id = ${userId}) AS saved`;
}

// Stories scoring 8+, each with its rank among that day's 8+ stories (Central time): by score,
// then by how many sources covered it, then newest. The feed shows ranks 1 to dailyCap().
export function rankedInDay() {
  return sql`
    SELECT st.id, row_number() OVER (
      PARTITION BY (st.published_at AT TIME ZONE ${FEED_TIME_ZONE})::date
      ORDER BY st.ai_score DESC,
        (SELECT count(*) FROM story_sources c WHERE c.story_id = st.id) DESC,
        st.published_at DESC, st.id DESC
    ) AS rank_in_day
    FROM stories st
    WHERE st.ai_score >= ${JUDGE_MIN_SCORE}`;
}

export async function listStories({ page = 1, userId }: { page?: number; userId?: string } = {}): Promise<{ stories: Story[]; hasMore: boolean }> {
  const offset = (Math.max(1, Math.floor(page)) - 1) * PAGE_SIZE;
  // With judging on: only stories scoring 8+, and at most dailyCap() per day, chosen by score,
  // then by how many sources covered the story, then newest (Build A research §14).
  const visible =
    judgeMode() === "off"
      ? sql`SELECT id FROM stories`
      : sql`SELECT id FROM (${rankedInDay()}) ranked WHERE rank_in_day <= ${dailyCap()}`;
  const rows = await sql<Row[]>`
    SELECT ${storyColumns(userId ?? "0")}
    FROM stories s
    WHERE s.id IN (${visible})
    ORDER BY s.published_at DESC, s.id DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}`;
  return { stories: rows.slice(0, PAGE_SIZE).map(toStory), hasMore: rows.length > PAGE_SIZE };
}

// The signed-in user's saved stories, most recently saved first. (REQ-014)
export async function listSavedStories(userId: string): Promise<Story[]> {
  const rows = await sql<Row[]>`
    SELECT ${storyColumns(userId)}
    FROM saves mine JOIN stories s ON s.id = mine.story_id
    WHERE mine.user_id = ${userId}
    ORDER BY mine.created_at DESC`;
  return rows.map(toStory);
}
