import { listStories, type Story } from "@/lib/stories";

// The superintelligence feed. (REQ-002 to REQ-007, REQ-021)
// Feed text is always rendered as text, never as HTML, so nothing from a feed can run.

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="story" data-story-id={story.id} data-published={story.publishedAt.toISOString()}>
      <h2>
        <a href={story.url}>{story.title}</a>
      </h2>
      <p className="meta">
        <time dateTime={story.publishedAt.toISOString()}>{dateFormat.format(story.publishedAt)}</time>
      </p>
      {story.summary && <p className="summary">{story.summary}</p>}
      <ul className="topics" aria-label="Superintelligence topics">
        {story.topics.map((t) => (
          <li key={t.id}>
            <span className="topic-label">{t.label}</span>{" "}
            <span className="matched">(matched: {t.matched.join(", ")})</span>
          </li>
        ))}
      </ul>
      <ul className="sources" aria-label="Sources">
        {story.sources.map((s) => (
          <li key={s.name}>
            <a href={s.url}>{s.name}</a>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { stories, hasMore } = await listStories({ page });

  if (stories.length === 0 && page === 1) {
    return <p className="empty">No superintelligence stories yet. Check back soon.</p>;
  }

  return (
    <>
      <h1 className="visually-hidden">Superintelligence feed</h1>
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
      <nav className="pager" aria-label="More stories">
        {page > 1 && <a href={page === 2 ? "/" : `/?page=${page - 1}`}>Newer stories</a>}
        {hasMore && <a href={`/?page=${page + 1}`}>Older stories</a>}
      </nav>
    </>
  );
}
