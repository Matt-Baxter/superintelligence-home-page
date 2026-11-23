import Link from "next/link";
import { FEED_PRESETS, serializeFeedQuery, type FeedQuery } from "@/lib/schemas";
import { normalizeTopicFilter, type TopicCount } from "@/lib/stories";
import { CopyLinkButton } from "./copy-link-button";

export function FeedToolbar({
  query,
  topicCounts,
  totalMatching,
}: {
  query: FeedQuery;
  topicCounts: TopicCount[];
  totalMatching: number;
}) {
  const activeTopic = normalizeTopicFilter(query.topic);
  const currentHref = serializeFeedQuery(query);
  const jsonTwinHref = `/api/stories${currentHref === "/" ? "" : currentHref.slice(1)}`;
  const atomHref = `/api/feed.atom${activeTopic ? `?topic=${encodeURIComponent(activeTopic)}` : ""}`;
  const hasCustomState =
    Boolean(activeTopic) ||
    Boolean(query.q) ||
    query.sort !== "newest" ||
    query.window !== "all" ||
    query.curation !== "all" ||
    query.evidence !== "all" ||
    Boolean(query.preset);

  return (
    <section className="toolbar-shell" aria-label="Feed filters and presets">
      <div className="preset-row">
        <div className="preset-group" role="group" aria-label="Named view presets">
          <span className="eyebrow-label">Presets</span>
          {FEED_PRESETS.map((preset) => {
            const isSelected = query.preset === preset.id || (!query.preset && !hasCustomState && preset.id === "all-si");
            return (
              <Link
                key={preset.id}
                href={`/?preset=${encodeURIComponent(preset.id)}`}
                className="preset-pill"
                aria-current={isSelected ? "true" : undefined}
                title={preset.description}
              >
                {preset.label}
              </Link>
            );
          })}
        </div>

        <div className="utility-group">
          {hasCustomState && (
            <Link href="/" className="btn-secondary">
              Reset
            </Link>
          )}
          <CopyLinkButton relativeHref={currentHref} />
          <a href={jsonTwinHref} className="btn-secondary" title="Machine-readable JSON feed twin">
            JSON
          </a>
          <a href={atomHref} className="btn-secondary" title="Atom 1.0 syndication feed">
            Atom
          </a>
        </div>
      </div>

      <form method="get" action="/" className="controls-form" aria-label="Search, sort, era and rigor controls">
        {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}
        <label className="control-field search-field">
          Search titles, authors &amp; ontology concepts
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder="e.g. scalable oversight, mesa-optimization, SIM, SWE-bench"
            maxLength={120}
          />
        </label>

        <label className="control-field">
          Sort order
          <select name="sort" defaultValue={query.sort}>
            <option value="newest">Newest first</option>
            <option value="best">Best stories (calibrated)</option>
            <option value="significance">Significance (0–100)</option>
            <option value="rigor">Empirical rigor (0–100)</option>
            <option value="sources">Most sources</option>
            <option value="votes">Most votes</option>
          </select>
        </label>

        <label className="control-field">
          Historical era / window
          <select name="window" defaultValue={query.window}>
            <option value="all">All eras (2015–present)</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
            <option value="365d">Past year</option>
            <option value="2026">2026</option>
            <option value="2024-2025">2024–2025</option>
            <option value="2022-2023">2022–2023</option>
            <option value="pre-2022">Foundational (2015–2021)</option>
          </select>
        </label>

        <label className="control-field">
          Evidence &amp; rigor
          <select name="evidence" defaultValue={query.evidence}>
            <option value="all">All evidence ({totalMatching})</option>
            <option value="empirical">Empirical rigor (35+)</option>
            <option value="safety-eval">Safety &amp; alignment evals</option>
            <option value="multi-source">Multi-source (2+)</option>
            <option value="formal">Machine-checked proof</option>
          </select>
        </label>

        <label className="control-field">
          Curation
          <select name="curation" defaultValue={query.curation}>
            <option value="all">All in-scope</option>
            <option value="high-signal">High-signal (8.2+ &amp; low hype)</option>
            <option value="daily-top">Daily top 5 (8.0+)</option>
          </select>
        </label>

        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      <nav className="topic-filter-nav" aria-label="Filter by superintelligence topic">
        <Link
          href={serializeFeedQuery({ ...query, topic: "", preset: "", page: 1 })}
          className="topic-pill"
          aria-current={!activeTopic ? "true" : undefined}
        >
          All topics
        </Link>
        {topicCounts.map((t) => {
          const isCurrent = activeTopic === t.id;
          return (
            <Link
              key={t.id}
              href={serializeFeedQuery({ ...query, topic: t.id, preset: "", page: 1 })}
              className="topic-pill"
              aria-current={isCurrent ? "true" : undefined}
            >
              <span>{t.label}</span>
              <span className="pill-count">({t.count})</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
