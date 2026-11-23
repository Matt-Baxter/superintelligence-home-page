import Link from "next/link";
import { FeedToolbar } from "@/components/feed-toolbar";
import { StoryCard } from "@/components/story-card";
import { getCurrentUser } from "@/lib/auth";
import { TOPIC_LABEL_BY_ID } from "@/lib/ontology";
import { parseFeedQuery, serializeFeedQuery } from "@/lib/schemas";
import { listStories, normalizeTopicFilter } from "@/lib/stories";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const query = parseFeedQuery(rawParams);
  const user = await getCurrentUser().catch(() => null);

  const {
    stories,
    hasMore,
    totalMatching,
    topicCounts,
    activeSourceCount,
    activeKindCount,
  } = await listStories(query, user?.id);

  const activeTopicId = normalizeTopicFilter(query.topic);
  const activeTopicLabel = activeTopicId ? TOPIC_LABEL_BY_ID.get(activeTopicId) : null;
  const returnTo = serializeFeedQuery(query);

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">
            {activeTopicLabel ? `${activeTopicLabel} — Superintelligence Feed` : "Superintelligence Feed"}
          </h1>
          <p className="feed-subtitle">
            {activeTopicLabel
              ? `Showing verified superintelligence research, lab releases, evaluations and policy developments tagged under ${activeTopicLabel}.`
              : "Progress toward AGI and superintelligence, alignment, interpretability, forecasting, scaling and frontier governance—grouped across sources with every tag and score explained."}
          </p>
        </div>
        <div className="feed-stats-strip" aria-label="Feed coverage summary">
          <span>
            <strong>{activeSourceCount}</strong> active sources
          </span>
          <span>·</span>
          <span>
            <strong>{activeKindCount}</strong> source kinds
          </span>
          <span>·</span>
          <span>
            <strong>{totalMatching}</strong> {totalMatching === 1 ? "story" : "stories"}
          </span>
        </div>
      </div>

      <FeedToolbar query={query} topicCounts={topicCounts} totalMatching={totalMatching} />

      {stories.length === 0 ? (
        <div className="empty-state">
          {activeTopicLabel || query.q ? (
            <>
              <p style={{ margin: "0 0 0.75rem" }}>
                No superintelligence stories match that filter yet.
              </p>
              <Link href="/" className="btn-secondary">
                Show all superintelligence stories
              </Link>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              No superintelligence stories yet. Check back soon after the scheduled source harvest runs.
            </p>
          )}
        </div>
      ) : (
        <div className="story-list">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} returnTo={returnTo} />
          ))}
        </div>
      )}

      {(query.page > 1 || hasMore) && (
        <nav className="pager" aria-label="Pagination">
          {query.page > 1 ? (
            <Link
              href={serializeFeedQuery({ ...query, page: query.page - 1 })}
              className="btn-secondary"
            >
              ← Newer stories
            </Link>
          ) : (
            <span />
          )}
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Page {query.page}</span>
          {hasMore ? (
            <Link
              href={serializeFeedQuery({ ...query, page: query.page + 1 })}
              className="btn-secondary"
            >
              Older stories →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
