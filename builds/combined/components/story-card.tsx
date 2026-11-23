import Link from "next/link";
import { StoryActionsBar } from "@/components/story-actions-bar";
import { StoryAuditDrawer } from "@/components/story-audit-drawer";
import type { StoryView } from "@/lib/stories";
import { cleanDisplaySummary, domainOf, formatRelativeTime } from "@/lib/text";

const FORMAL_SHORT: Record<StoryView["formalRung"], string | null> = {
  none: null,
  claimed: "Proof Claimed",
  "statement-checked": "Formalized Spec",
  "outside-checked": "Machine-Checked Proof",
};

function toDecile(score: number): number {
  return Math.max(1, Math.min(10, Math.round(score / 10)));
}

/**
 * Institutional Editorial Story Card:
 * 1. Calm scannable top-level layout (Provenance + Calibrated Telemetry -> Serif Headline -> Crisp Abstract -> Root Pillars)
 * 2. Just-In-Time 3-Level Explanation & Score Audit Drawer (synthesized on demand)
 * 3. Progressive-enhancement optimistic Vote & Save controls
 */
export function StoryCard({
  story,
  returnTo = "/",
}: {
  story: StoryView;
  returnTo?: string;
}) {
  const domain = domainOf(story.url);
  const formalLabel = FORMAL_SHORT[story.formalRung];
  const primarySource = story.sources[0];
  const extraSourceCount = Math.max(0, story.sources.length - 1);
  const pubYear = story.publishedAt.getUTCFullYear();
  const isHistoricalArchive = pubYear <= 2023;
  const cleanedSummary = cleanDisplaySummary(story.summary);

  return (
    <article className="story-card">
      <div className="story-header-row">
        <div className="story-kicker">
          {primarySource && <span className="story-source-lead">{primarySource.name}</span>}
          {extraSourceCount > 0 && (
            <span className="corroboration-badge" title={story.sources.map((s) => s.name).join(", ")}>
              +{extraSourceCount} corroborating {extraSourceCount === 1 ? "feed" : "feeds"}
            </span>
          )}
          <span className="kicker-sep" aria-hidden="true">·</span>
          <span>{story.updateType}</span>
          <span className="kicker-sep" aria-hidden="true">·</span>
          <time dateTime={story.publishedAt.toISOString()} title={story.publishedAt.toUTCString()}>
            {formatRelativeTime(story.publishedAt)}
          </time>
          {domain && (
            <>
              <span className="kicker-sep" aria-hidden="true">·</span>
              <span className="mono">{domain}</span>
            </>
          )}
        </div>

        <div className="story-telemetry" aria-label="Calibrated research scores">
          {story.significanceScore >= 65 && (
            <span className="landmark-seal" title="Landmark tier: Significance ≥ 65">
              ★ Landmark
            </span>
          )}
          {isHistoricalArchive && (
            <span className="era-seal" title={`Historical archive item (${pubYear})`}>
              {pubYear} Archive
            </span>
          )}
          {formalLabel && (
            <span className="landmark-seal sage" title={story.paperRigor.formalProof.label}>
              ✓ {formalLabel}
            </span>
          )}
          {story.hypeScore >= 35 && (
            <span className="hype-seal" title="Elevated marketing hype / unbacked sweeping assertions">
              Hype {story.hypeScore}
            </span>
          )}
          <span
            className="metric-pill"
            title={`Significance ${story.significanceScore}/100 · Composite rank ${story.bestScore}`}
          >
            <span className="metric-pill-label">Sig</span>
            <span className="metric-pill-val">{story.significanceScore}</span>
            <span className="metric-micro-bar" aria-hidden="true">
              <span data-decile={toDecile(story.significanceScore)} />
            </span>
          </span>
          <span
            className="metric-pill"
            title={`Empirical Rigor ${story.rigorScore}/100 (${story.credibilityBand} credibility)`}
          >
            <span className="metric-pill-label">Rigor</span>
            <span className="metric-pill-val">{story.rigorScore}</span>
            <span className="metric-micro-bar sage" aria-hidden="true">
              <span data-decile={toDecile(story.rigorScore)} />
            </span>
          </span>
        </div>
      </div>

      <h2 className="story-headline">
        <a href={story.url} target="_blank" rel="noopener noreferrer">
          {story.title}
        </a>
      </h2>

      {cleanedSummary.text && (
        <p className={`story-summary${cleanedSummary.wasTocBoilerplate ? " summary-outline" : ""}`}>
          {cleanedSummary.text}
        </p>
      )}

      {(story.aiScore !== null || story.aiReason) && (
        <div className="ai-assessment">
          {story.aiScore !== null && (
            <span className="ai-score-chip" title="Calibrated relevance & quality rating (0–10)">
              {story.aiScore.toFixed(1)} / 10
            </span>
          )}
          {story.aiReason && <span className="ai-reason-text">{story.aiReason}</span>}
          {story.aiModel && <span className="ai-label">({story.aiModel})</span>}
        </div>
      )}

      <div className="story-taxonomy-row">
        {story.rootTopics.length > 0 && (
          <ul className="topics-clean" aria-label="Ontology pillars">
            {story.rootTopics.slice(0, 4).map((t) => (
              <li key={t.id}>
                <Link
                  href={`/?topic=${encodeURIComponent(t.id)}`}
                  className="topic-pill root"
                  title={
                    t.matched.length > 0
                      ? `Matched: ${t.matched.join(", ")}${t.via ? ` (via ${t.via})` : ""}`
                      : t.label
                  }
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {(story.orgs.length > 0 || story.benchmarks.length > 0 || story.codeUrls.length > 0) && (
          <div className="entity-strip">
            {story.orgs.slice(0, 2).map((o) => (
              <span key={o.id} className="entity-chip org">
                {o.label}
              </span>
            ))}
            {story.benchmarks.slice(0, 2).map((b) => (
              <span key={b.id} className="entity-chip bench">
                {b.label}
                {b.score ? ` · ${b.score.raw}` : ""}
              </span>
            ))}
            {story.codeUrls.length > 0 && (
              <a
                href={story.codeUrls[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="entity-chip code"
              >
                Code Artifact ↗
              </a>
            )}
          </div>
        )}
      </div>

      <StoryAuditDrawer storyId={story.id} storyTitle={story.title} />

      <StoryActionsBar
        storyId={story.id}
        returnTo={returnTo}
        initialVotes={story.votes}
        initialVoted={story.voted}
        initialSaved={story.saved}
      />
    </article>
  );
}
