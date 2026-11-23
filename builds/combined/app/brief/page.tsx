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
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span className="sig-badge landmark">Significance {item.significanceScore}/100</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {item.sourceCount} {item.sourceCount === 1 ? "source" : "sources"} ·{" "}
                    {dateFormat.format(new Date(item.publishedAt))}
                  </span>
                </div>
                <h3 style={{ margin: "0.35rem 0 0.25rem", fontSize: "1.025rem" }}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
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
              className="panel-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.925rem" }}>{t.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: "0.4rem" }}>
                <span className="stat-value" style={{ fontSize: "1.25rem" }}>
                  {t.thisWeek}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {t.delta > 0 ? `+${t.delta}` : t.delta} vs prior ({t.prevWeek})
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="panel-grid">
        <section className="panel-card" aria-labelledby="singles-heading">
          <h2 id="singles-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>
            Single-Source High-Significance Finds
          </h2>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.825rem" }}>
            High-scoring technical posts or papers that only a single source covered—often overlooked by mainstream aggregators.
          </p>
          <ul className="stack-list">
            {brief.singleSourceFinds.map((s) => (
              <li key={s.id} className="stack-row">
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {s.title}
                </a>
                <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                  {s.sourceName} · {s.significanceScore}/100 · <Link href={`/stories/${s.id}`}>Breakdown</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card" aria-labelledby="bench-heading">
          <h2 id="bench-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>
            Tracked Evaluation Benchmarks
          </h2>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.825rem" }}>
            Frontier capability and safety benchmarks cited in recent stories, with extracted numeric or time-horizon scores.
          </p>
          {brief.benchmarkMentions.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No benchmark citations in current window.</p>
          ) : (
            <ul className="stack-list">
              {brief.benchmarkMentions.map((b) => (
                <li key={b.id} className="stack-row" style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong>{b.label}</strong>
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
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
