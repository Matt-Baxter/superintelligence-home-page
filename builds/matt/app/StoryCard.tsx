import type { Story } from "@/lib/stories";

// One story in the feed or the saved list. Feed text is rendered as text, never as HTML, so
// nothing from a feed can run (REQ-021). Vote and save are plain form posts, so they work with
// the keyboard and without JavaScript (REQ-013, REQ-014, REQ-023).

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function StoryCard({ story, returnTo }: { story: Story; returnTo: string }) {
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
      <div className="actions">
        <form method="post" action={`/api/stories/${story.id}/vote`}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-pressed={story.voted}>
            {story.voted ? "Remove vote" : "Vote"}
          </button>
        </form>
        <span className="vote-count">
          {story.votes} {story.votes === 1 ? "vote" : "votes"}
        </span>
        <form method="post" action={`/api/stories/${story.id}/save`}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-pressed={story.saved}>
            {story.saved ? "Unsave" : "Save"}
          </button>
        </form>
      </div>
    </article>
  );
}
