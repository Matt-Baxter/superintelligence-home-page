import { sql } from "./db";
import { fetchFeed, type FeedItem } from "./feeds";
import { getSources } from "./sources";
import { matchTopics } from "./topics";
import { arxivId, htmlToText, isTwitterUrl, normalizeTitle, normalizeUrl, truncate } from "./text";

// Turns feed items into stories. (REQ-001 to REQ-008, REQ-021)

export type IngestOutcome = "created" | "grouped" | "skipped";

function keysFor(link: string, title: string): string[] {
  const keys: string[] = [];
  const arxiv = arxivId(link);
  if (arxiv) keys.push(`arxiv:${arxiv}`);
  const url = normalizeUrl(link);
  if (url) keys.push(`url:${url}`);
  const t = normalizeTitle(title);
  if (t) keys.push(`title:${t}`);
  return keys;
}

export async function ingestItem(item: FeedItem, sourceId: string): Promise<IngestOutcome> {
  const link = item.link.trim();

  // REQ-006: never Twitter/X.
  if (isTwitterUrl(link)) return "skipped";
  // Only web links to an original page (REQ-007).
  if (!/^https?:\/\//i.test(link)) return "skipped";

  // REQ-021, REQ-007: plain text only; summaries at most 300 characters.
  const title = htmlToText(item.title);
  const summary = truncate(htmlToText(item.summary), 300);
  if (!title) return "skipped";

  // REQ-003: keep only items that match a superintelligence key phrase (whole words).
  const topics = matchTopics(`${title} ${summary}`);
  if (topics.length === 0) return "skipped";

  const published = item.published ?? new Date();
  const keys = keysFor(link, title);

  return sql.begin(async (tx) => {
    // REQ-004: an arXiv ID beats a URL, and a URL beats a title.
    const existing = await tx<{ story_id: string }[]>`
      SELECT story_id FROM story_keys WHERE key IN ${tx(keys)}
      ORDER BY CASE WHEN key LIKE 'arxiv:%' THEN 0 WHEN key LIKE 'url:%' THEN 1 ELSE 2 END
      LIMIT 1`;

    let storyId: string;
    let outcome: IngestOutcome;
    if (existing.length > 0) {
      storyId = existing[0].story_id;
      outcome = "grouped";
      await tx`UPDATE stories SET published_at = LEAST(published_at, ${published}) WHERE id = ${storyId}`;
    } else {
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO stories (title, url, summary, published_at)
        VALUES (${title}, ${link}, ${summary}, ${published})
        RETURNING id`;
      storyId = row.id;
      outcome = "created";
    }

    await tx`
      INSERT INTO story_sources (story_id, source_id, url)
      VALUES (${storyId}, ${sourceId}, ${link})
      ON CONFLICT (story_id, source_id) DO NOTHING`;

    for (const t of topics) {
      await tx`
        INSERT INTO story_topics (story_id, topic_id, matched)
        VALUES (${storyId}, ${t.id}, ${t.matched})
        ON CONFLICT (story_id, topic_id) DO UPDATE
          SET matched = ARRAY(SELECT DISTINCT unnest(story_topics.matched || EXCLUDED.matched))`;
    }

    for (const key of keys) {
      await tx`INSERT INTO story_keys (key, story_id) VALUES (${key}, ${storyId}) ON CONFLICT (key) DO NOTHING`;
    }

    // A story already seen from this source on an earlier fetch isn't new.
    return outcome;
  });
}

export type FetchSummary = { fetched: number; failed: number; stories: number };

// Fetches every source at once. One failing source never stops the others (REQ-008).
// Items are then stored one at a time, so two sources carrying the same paper can't both
// create a story for it (REQ-004).
export async function fetchAll(): Promise<FetchSummary> {
  const sources = getSources();
  const results = await Promise.allSettled(sources.map((s) => fetchFeed(s.feedUrl)));

  let fetched = 0;
  let failed = 0;
  let stories = 0;

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const result = results[i];
    if (result.status === "rejected") {
      failed++;
      const message = result.reason instanceof Error ? result.reason.message : "Fetch failed";
      await sql`UPDATE sources SET last_error = ${message.slice(0, 200)} WHERE id = ${source.id}`;
      continue;
    }
    fetched++;
    for (const item of result.value) {
      try {
        if ((await ingestItem(item, source.id)) === "created") stories++;
      } catch (err) {
        console.error(`Could not store an item from ${source.id}:`, err);
      }
    }
    await sql`UPDATE sources SET last_ok_at = now(), last_error = NULL WHERE id = ${source.id}`;
  }

  return { fetched, failed, stories };
}
