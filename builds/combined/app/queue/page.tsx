import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  CONSENSUS_QUORUM,
  listQueue,
  queueCounts,
  ReviewVerdictSchema,
  VERDICT_LABEL,
  type QueueItem,
} from "@/lib/review-queue";

export const metadata: Metadata = {
  title: "Review Queue",
  description: "Stories the machine was unsure about, waiting for human judgment.",
};

const VERDICTS = ReviewVerdictSchema.options;
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status === "resolved" ? "resolved" : "open";
  const user = await getCurrentUser();
  const [items, counts] = await Promise.all([listQueue({ userId: user?.id ?? null, status }), queueCounts()]);

  return (
    <>
      <div className="feed-banner">
        <div>
          <p className="eyebrow-label">Human review</p>
          <h1 className="feed-heading">Review queue</h1>
          <p className="feed-subtitle">
            When the scorer is unsure, a story waits here. {CONSENSUS_QUORUM} matching votes from readers settle it and
            adjust its rating.
          </p>
        </div>
      </div>

      <nav className="status-tabs" aria-label="Queue status">
        <Link href="/queue" aria-current={status === "open" ? "page" : undefined}>
          Waiting <span className="pill-count">{counts.open}</span>
        </Link>
        <Link href="/queue?status=resolved" aria-current={status === "resolved" ? "page" : undefined}>
          Settled <span className="pill-count">{counts.resolved}</span>
        </Link>
      </nav>

      {!user && status === "open" ? (
        <p className="form-note">
          <Link href="/signin">Sign in</Link> to vote. Anyone can read the queue.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="empty-state">
          <p>{status === "open" ? "Nothing is waiting for review." : "No stories have been settled yet."}</p>
        </div>
      ) : (
        <ol className="queue-list">
          {items.map((item) => (
            <QueueRow key={item.queueId} item={item} canVote={Boolean(user) && status === "open"} />
          ))}
        </ol>
      )}
    </>
  );
}

function QueueRow({ item, canVote }: { item: QueueItem; canVote: boolean }) {
  const totalVotes = VERDICTS.reduce((sum, v) => sum + item.tally[v], 0);
  return (
    <li className="queue-item">
      <div className="story-top-meta">
        <span className="source-kind-tag">{item.origin === "machine" ? "Flagged by scorer" : "Flagged by reader"}</span>
        <span>{item.sourceName}</span>
        <span>{dateFormat.format(item.createdAt)}</span>
        <span className="mono">Score {item.aiScore ?? "n/a"}</span>
      </div>
      <h2 className="queue-title">
        <Link href={`/stories/${item.storyId}`}>{item.title}</Link>
      </h2>
      <p className="queue-reason">
        <span className="label">Why</span>
        {item.reason}
      </p>

      <ul className="verdict-tally" aria-label={`${totalVotes} of ${CONSENSUS_QUORUM} votes needed`}>
        {VERDICTS.map((v) => (
          <li key={v} className={item.myVerdict === v ? "mine" : undefined}>
            <span>{VERDICT_LABEL[v]}</span>
            <span className="mono">{item.tally[v]}</span>
          </li>
        ))}
      </ul>

      {canVote ? (
        <form method="post" action={`/api/review/${item.storyId}/verdict`} className="verdict-form">
          <input type="hidden" name="returnTo" value="/queue" />
          <fieldset>
            <legend className="sr-only">Your verdict for {item.title}</legend>
            {VERDICTS.map((v) => (
              <button
                key={v}
                type="submit"
                name="verdict"
                value={v}
                className={item.myVerdict === v ? "btn-primary btn-small" : "btn-secondary btn-small"}
                aria-pressed={item.myVerdict === v}
              >
                {VERDICT_LABEL[v]}
              </button>
            ))}
          </fieldset>
        </form>
      ) : null}
    </li>
  );
}
