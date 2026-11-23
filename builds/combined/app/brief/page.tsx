import type { Metadata } from "next";
import Link from "next/link";
import { getWeeklyBrief } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Weekly Intelligence Brief",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function BriefPage() {
  const brief = await getWeeklyBrief(14);

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">Executive Intelligence Brief</h1>
          <p className="feed-subtitle">
            Structured synthesis of top landmark developments, 14-day topic velocity, single-source high-significance finds, and benchmark signals.
          </p>
        </div>
        <div className="utility-group">
          <a href="/api/brief" className="btn-secondary">
            Validated JSON Spec
          </a>
          <a href="/api/feed.atom" className="btn-secondary">
            Atom Feed
          </a>
        </div>
      </div>

      <section className="panel-grid" aria-label="Key metrics">
        <div className="stat-card">
          <div className="stat-value">{brief.totals.storiesThisWeek}</div>
          <div className="stat-label">Stories in past {brief.windowDays} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{brief.totals.activeSources}</div>
          <div className="stat-label">Contributing public sources</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{brief.totals.multiSourceCount}</div>
          <div className="stat-label">Multi-source corroborated stories</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{brief.totals.avgSignificance}/100</div>
          <div className="stat-label">Mean deterministic significance</div>
        </div>
      </section>

      <section aria-labelledby="landmarks-heading">
        <h2 id="landmarks-heading" className="section-heading">
          Landmark Developments
        </h2>
        {brief.landmarks.length === 0 ? (
          <p className="empty-state">No stories available yet.</p>
        ) : (
          <ul className="stack-list">
            {brief.landmarks.map((item) => (
              <li key={item.id} className="stack-row highlighted">
                <div className="stack-row-head">
                  <span className="sig-badge landmark">Significance {item.significanceScore}/100</span>
                  <span className="stack-row-meta">
                    {item.sourceCount} {item.sourceCount === 1 ? "source" : "sources"} ·{" "}
                    {dateFormat.format(new Date(item.publishedAt))}
                  </span>
                </div>
                <h3 className="stack-row-title">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </h3>
                <div className="stack-row-foot">
                  <span>{item.topics.join(" · ")}</span>
                  <Link href={`/stories/${item.id}`}>Provenance →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="velocity-heading">
        <h2 id="velocity-heading" className="section-heading">
          Superintelligence Topic Activity ({brief.windowDays}-day window vs. prior period)
        </h2>
        <div className="panel-grid">
          {brief.topicVelocity.map((t) => (
            <Link
              key={t.id}
              href={`/?topic=${encodeURIComponent(t.id)}`}
              className="panel-card velocity-card"
            >
              <div className="velocity-card-title">{t.label}</div>
              <div className="velocity-card-row">
                <span className="stat-value velocity-card-val">
                  {t.thisWeek}
                </span>
                <span className={t.delta > 0 ? "velocity-delta-pos" : "velocity-delta-neg"}>
                  {t.delta > 0 ? `+${t.delta}` : t.delta} vs prior ({t.prevWeek})
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="panel-grid">
        <section className="panel-card" aria-labelledby="singles-heading">
          <h2 id="singles-heading" className="panel-card-heading">
            Single-Source High-Significance Finds
          </h2>
          <p className="panel-card-lede">
            High-scoring technical posts or papers that only a single source covered—often overlooked by mainstream aggregators.
          </p>
          <ul className="stack-list">
            {brief.singleSourceFinds.map((s) => (
              <li key={s.id} className="stack-row">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="source-link-title">
                  {s.title}
                </a>
                <div className="stack-row-submeta">
                  {s.sourceName} · {s.significanceScore}/100 · <Link href={`/stories/${s.id}`}>Breakdown</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card" aria-labelledby="bench-heading">
          <h2 id="bench-heading" className="panel-card-heading">
            Tracked Evaluation Benchmarks
          </h2>
          <p className="panel-card-lede">
            Frontier capability and safety benchmarks cited in recent stories, with extracted numeric or time-horizon scores.
          </p>
          {brief.benchmarkMentions.length === 0 ? (
            <p className="stack-row-note">No benchmark citations in current window.</p>
          ) : (
            <ul className="stack-list">
              {brief.benchmarkMentions.map((b) => (
                <li key={b.id} className="stack-row bench-row">
                  <strong>{b.label}</strong>
                  <span className="stack-row-meta">
                    {b.mentions} {b.mentions === 1 ? "story" : "stories"}
                    {b.bestRawScore ? ` · ${b.bestRawScore}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
