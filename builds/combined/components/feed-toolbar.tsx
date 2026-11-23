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

  const hasAdvancedFilter =
    query.window !== "all" || query.evidence !== "all" || query.curation !== "all";
  const activeAdvancedCount =
    (query.window !== "all" ? 1 : 0) +
    (query.evidence !== "all" ? 1 : 0) +
    (query.curation !== "all" ? 1 : 0);

  const hasCustomState =
    Boolean(activeTopic) ||
    Boolean(query.q) ||
    query.sort !== "newest" ||
    hasAdvancedFilter ||
    Boolean(query.preset);

  return (
    <section className="workspace-toolbar" aria-label="Feed filters and presets">
      {/* Row 1: Editorial View Lenses + Share/Syndication Utilities */}
      <div className="toolbar-top-bar">
        <div className="view-lenses" role="navigation" aria-label="Named view presets">
          {FEED_PRESETS.map((preset) => {
            const isSelected =
              query.preset === preset.id ||
              (!query.preset && !hasCustomState && preset.id === "all-si");
            return (
              <Link
                key={preset.id}
                href={`/?preset=${encodeURIComponent(preset.id)}`}
                className="lens-tab"
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
            <Link href="/" className="btn-secondary btn-small">
              Reset
            </Link>
          )}
          <CopyLinkButton relativeHref={currentHref} />
          <a href={jsonTwinHref} className="btn-secondary btn-small" title="Machine-readable JSON feed twin">
            JSON
          </a>
          <a href={atomHref} className="btn-secondary btn-small" title="Atom 1.0 syndication feed">
            Atom
          </a>
        </div>
      </div>

      {/* Row 2: Unclipped Primary Search + Sort + Progressive Advanced Filters (Hick's Law) */}
      <form method="get" action="/" className="toolbar-search-zone" aria-label="Search, sort, era and rigor controls">
        {activeTopic && <input type="hidden" name="topic" value={activeTopic} />}

        <div className="primary-controls-grid">
          <label className="control-field search-field">
            <span className="field-caption">Search corpus, authors &amp; ontology concepts</span>
            <input
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="e.g. scalable oversight, sparse autoencoders, SIM, SWE-bench…"
              maxLength={120}
            />
          </label>

          <label className="control-field sort-field">
            <span className="field-caption">Sort ranking</span>
            <select name="sort" defaultValue={query.sort}>
              <option value="newest">Newest first</option>
              <option value="best">Best stories (calibrated)</option>
              <option value="significance">Significance (0–100)</option>
              <option value="rigor">Empirical rigor (0–100)</option>
              <option value="sources">Most corroborated</option>
              <option value="votes">Community votes</option>
            </select>
          </label>

          <div className="apply-btn-cell">
            <button type="submit" className="btn-primary">
              Apply
            </button>
          </div>
        </div>

        {/* Progressive Disclosure for Secondary Filters — never clips select options */}
        <details className="advanced-filters-disclosure" open={hasAdvancedFilter}>
          <summary>
            <span>Era, Empirical Rigor &amp; Curation Gates</span>
            {activeAdvancedCount > 0 && (
              <span className="active-filter-count">{activeAdvancedCount} active</span>
            )}
          </summary>

          <div className="advanced-controls-grid">
            <label className="control-field">
              <span className="field-caption">Historical era / window</span>
              <select name="window" defaultValue={query.window}>
                <option value="all">All eras (2015–present)</option>
                <option value="7d">Past 7 days</option>
                <option value="30d">Past 30 days</option>
                <option value="365d">Past 12 months</option>
                <option value="2026">2026 frontier</option>
                <option value="2024-2025">2024–2025 reasoning &amp; control</option>
                <option value="2022-2023">2022–2023 scaling &amp; RLHF</option>
                <option value="pre-2022">Foundational canon (2015–2021)</option>
              </select>
            </label>

            <label className="control-field">
              <span className="field-caption">Evidence &amp; verification rung</span>
              <select name="evidence" defaultValue={query.evidence}>
                <option value="all">All verified in-scope ({totalMatching})</option>
                <option value="empirical">Empirical rigor (35+/100)</option>
                <option value="safety-eval">Safety, scheming &amp; alignment evals</option>
                <option value="multi-source">Multi-source corroborated (2+)</option>
                <option value="formal">Machine-checked formal proof</option>
              </select>
            </label>

            <label className="control-field">
              <span className="field-caption">Editorial curation threshold</span>
              <select name="curation" defaultValue={query.curation}>
                <option value="all">All in-scope research</option>
                <option value="high-signal">High-signal (8.2+ &amp; low hype)</option>
                <option value="daily-top">Daily top 5 landmarks (8.0+)</option>
              </select>
            </label>
          </div>
        </details>
      </form>

      {/* Row 3: Canonical 9-Domain Superintelligence Taxonomy Index */}
      <nav className="taxonomy-strip" aria-label="Filter by superintelligence topic">
        <Link
          href={serializeFeedQuery({ ...query, topic: "", preset: "", page: 1 })}
          className="taxonomy-chip"
          aria-current={!activeTopic ? "true" : undefined}
        >
          <span>All domains</span>
          <span className="taxonomy-count">{totalMatching}</span>
        </Link>
        {topicCounts.map((t) => {
          const isCurrent = activeTopic === t.id;
          return (
            <Link
              key={t.id}
              href={serializeFeedQuery({ ...query, topic: t.id, preset: "", page: 1 })}
              className="taxonomy-chip"
              aria-current={isCurrent ? "true" : undefined}
            >
              <span>{t.label}</span>
              <span className="taxonomy-count">{t.count}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
