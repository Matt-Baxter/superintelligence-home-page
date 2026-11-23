import Link from "next/link";
import { REVIEW_LIMIT, STATUS_LABEL, reviewSourceOptions, reviewStories, reviewSummary, type ReviewStatus } from "@/lib/review";

// Judge review (Build A research §17): every stored story, its AI score and reason, and whether
// it is on the feed. Read-only and public: it shows only what the feed's sources already publish.

export const dynamic = "force-dynamic";
export const metadata = { title: "How stories are chosen · Superintelligence Homepage" };

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type Params = { q?: string; source?: string; status?: string };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100);
  const sources = reviewSourceOptions();
  const source = sources.some((s) => s.id === params.source) ? params.source! : "";
  const status = params.status && params.status in STATUS_LABEL ? params.status : "";
  const [summary, stories] = await Promise.all([reviewSummary(), reviewStories({ q, source, status })]);

  return (
    <>
      <h1 className="page-title">How stories are chosen</h1>
      <p className="review-intro">
        Every story that matched a superintelligence key phrase, with the AI judge&apos;s score. The feed shows stories
        scoring 8.0 or higher, at most 5 per day. Scores and reasons are AI assessments and can be wrong.
      </p>

      <section aria-labelledby="review-totals" className="review-summary">
        <h2 id="review-totals">Totals</h2>
        {summary.judging ? (
          <ul>
            <li>Stories found: {summary.total}</li>
            <li>{STATUS_LABEL.shown}: {summary.shown}</li>
            <li>{STATUS_LABEL.cap}: {summary.cap}</li>
            <li>{STATUS_LABEL.below}: {summary.below}</li>
            <li>{STATUS_LABEL.unjudged}: {summary.unjudged}</li>
          </ul>
        ) : (
          <p>The AI judge is off, so every one of the {summary.total} stories found is on the feed.</p>
        )}
        {summary.judging && (
          <p className="review-bands">
            Scores so far:{" "}
            {summary.scoreBands.map((b, i) => (
              <span key={b.label}>
                {i > 0 && " · "}
                {b.label}: {b.count}
              </span>
            ))}
          </p>
        )}
        <p>
          History back to 2023: {summary.history.done} of {summary.history.tasks} archive steps done
          {summary.history.failing > 0 && `, ${summary.history.failing} waiting to retry after an error`}.
        </p>
      </section>

      <form method="get" action="/review" className="review-filters" aria-label="Find stories">
        <label>
          Title contains
          <input type="search" name="q" defaultValue={q} maxLength={100} />
        </label>
        <label>
          Source
          <select name="source" defaultValue={source}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={status}>
            <option value="">Any status</option>
            {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Search</button>
      </form>

      {stories.length === 0 ? (
        <p className="empty">No stories match.</p>
      ) : (
        <>
          <p className="review-count">
            {stories.length === REVIEW_LIMIT ? `Newest ${REVIEW_LIMIT} matching stories` : `${stories.length} matching ${stories.length === 1 ? "story" : "stories"}`}
          </p>
          <ol className="review-list">
            {stories.map((s) => (
              <li key={s.id} className={`review-item status-${s.status}`}>
                <h3>
                  <a href={s.url} rel="noopener noreferrer">
                    {s.title}
                  </a>
                </h3>
                <p className="meta">
                  <time dateTime={s.publishedAt.toISOString()}>{dateFormat.format(s.publishedAt)}</time> · {s.sources.join(", ")}
                </p>
                <p className="review-status">
                  {s.score !== null && <strong>{s.score.toFixed(1)}/10</strong>} {STATUS_LABEL[s.status]}
                </p>
                {s.reason && <p className="ai-reason">{s.reason}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
      <p>
        <Link href="/">Back to the feed</Link>
      </p>
    </>
  );
}
