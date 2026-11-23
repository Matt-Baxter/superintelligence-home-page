import Link from "next/link";
import { FeedToolbar } from "@/components/feed-toolbar";
import { InteractiveSiAtlas } from "@/components/interactive-si-atlas";
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

  const isFilteredView =
    Boolean(activeTopicId) ||
    Boolean(query.q) ||
    Boolean(query.preset && query.preset !== "all-si") ||
    query.page > 1 ||
    query.window !== "all" ||
    query.evidence !== "all" ||
    query.curation !== "all";

  return (
    <>
      {/* Institutional Editorial Masthead */}
      <div className="feed-banner">
        <div className="feed-banner-copy">
          <div className="banner-eyebrow-row">
            <span className="mono-kicker brass-dot">OPEN RESEARCH OBSERVATORY · 2015–PRESENT</span>
            <span className="atlas-divider-dot" aria-hidden="true">·</span>
            <span className="mono-kicker muted">DETERMINISTIC ONTOLOGY &amp; RIGOR VERIFICATION</span>
          </div>
          <h1 className="feed-heading">
            {activeTopicLabel
              ? `${activeTopicLabel}`
              : "Tracking the Trajectory Toward Bounded Superintelligence"}
          </h1>
          <p className="feed-subtitle">
            {activeTopicLabel
              ? `Verified empirical papers, frontier safety evaluations, and governance developments indexed under ${activeTopicLabel}—with every score, matched phrase, and rigor claim audited in the open.`
              : "A calm, reproducible research index synthesizing capabilities, automated AI R&D, alignment, mechanistic interpretability, scaling laws, and governance—explained from first principles to formal verification."}
          </p>
        </div>

        <dl className="masthead-telemetry" aria-label="Live corpus telemetry">
          <div className="telemetry-cell">
            <dt>Public Feeds</dt>
            <dd>{activeSourceCount}</dd>
          </div>
          <div className="telemetry-cell">
            <dt>Source Classes</dt>
            <dd>{activeKindCount}</dd>
          </div>
          <div className="telemetry-cell">
            <dt>In-Scope Corpus</dt>
            <dd>{totalMatching}</dd>
          </div>
          <div className="telemetry-cell">
            <dt>Social Noise</dt>
            <dd>0</dd>
          </div>
        </dl>
      </div>

      {/* Anthropic-Style Interactive Multi-Level Field Guide & Sacred-Geometry Emblem Explorer */}
      <InteractiveSiAtlas topicCounts={topicCounts} defaultCollapsed={isFilteredView} />

      {/* Clean Progressive-Disclosure Research Workspace Toolbar */}
      <FeedToolbar query={query} topicCounts={topicCounts} totalMatching={totalMatching} />

      {/* Feed Corpus */}
      {stories.length === 0 ? (
        <div className="empty-state">
          {activeTopicLabel || query.q ? (
            <>
              <p className="empty-state-copy">
                No superintelligence stories match that filter combination yet.
              </p>
              <Link href="/" className="btn-secondary">
                Reset to full research corpus
              </Link>
            </>
          ) : (
            <p className="slot-m-0">
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
          <span className="mono-kicker">Page {query.page}</span>
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
