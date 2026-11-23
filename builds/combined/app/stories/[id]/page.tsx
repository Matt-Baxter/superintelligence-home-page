import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InteractivePaperFigure } from "@/components/interactive-paper-figure";
import { StoryActionsBar } from "@/components/story-actions-bar";
import { getCurrentUser } from "@/lib/auth";
import { SourceKindSchema } from "@/lib/schemas";
import { getStoryById } from "@/lib/stories";

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await getStoryById(id);
  return {
    title: story ? `${story.title} — Provenance` : "Story not found",
  };
}

export default async function StoryProvenancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  const story = await getStoryById(id, user?.id);

  if (!story) notFound();

  const returnTo = `/stories/${story.id}`;
  const leadKind = SourceKindSchema.catch("papers").parse(story.sources[0]?.kind);

  return (
    <>
      <p className="provenance-back-row">
        <Link href="/" className="mono-kicker no-underline">
          ← Return to Superintelligence Research Feed
        </Link>
      </p>

      <article className="panel-card elevated-plate slot-mb-lg">
        <div className="story-header-row slot-mb-sm">
          <div className="story-kicker">
            <span>{story.updateType}</span>
            <span className="kicker-sep">·</span>
            <span>{story.evidenceLevel}</span>
            <span className="kicker-sep">·</span>
            <time dateTime={story.publishedAt.toISOString()}>
              {dateTimeFormat.format(story.publishedAt)} UTC
            </time>
          </div>

          <div className="story-telemetry">
            <span className="landmark-seal">Composite {story.bestScore}/100</span>
            <span className="metric-pill">
              <span className="metric-pill-label">Sig</span>
              <strong className="metric-pill-val">{story.significanceScore}</strong>
            </span>
            <span className="metric-pill">
              <span className="metric-pill-label">Rigor</span>
              <strong className="metric-pill-val">{story.rigorScore}</strong>
            </span>
          </div>
        </div>

        <h1 className="provenance-headline">
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="no-underline">
            {story.title} ↗
          </a>
        </h1>

        {story.authors && <p className="provenance-authors">Authors: {story.authors}</p>}

        {story.aiScore !== null && story.aiReason && (
          <div className="ai-assessment slot-mt-sm">
            <span className="ai-score-chip">AI {story.aiScore}/100</span>
            <span className="ai-reason-text">{story.aiReason}</span>
          </div>
        )}

        <div className="provenance-primary-cta">
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-small">
            Read original publication ↗
          </a>
        </div>

        <StoryActionsBar
          storyId={story.id}
          returnTo={returnTo}
          initialVotes={story.votes}
          initialVoted={story.voted}
          initialSaved={story.saved}
        />

        {user ? (
          <details className="flag-details">
            <summary>Rating or scope looks wrong? Submit to community review queue</summary>
            <form method="post" action={`/api/stories/${story.id}/flag`} className="flag-form">
              <input type="hidden" name="returnTo" value="/queue" />
              <label htmlFor="flag-reason" className="label">
                What looks wrong
              </label>
              <input
                id="flag-reason"
                name="reason"
                type="text"
                required
                minLength={4}
                maxLength={200}
                placeholder="e.g. Narrow medical segmentation paper without AGI/alignment relevance"
              />
              <button type="submit" className="btn-secondary btn-small">
                Send to review queue
              </button>
            </form>
          </details>
        ) : null}
      </article>

      <section className="slot-mb-xl" aria-labelledby="interactive-audit-heading">
        <h2 id="interactive-audit-heading" className="section-heading slot-mt-0">
          Interactive Manuscript Attribution &amp; Rigor Audit
        </h2>
        <InteractivePaperFigure
          initialTitle={story.title}
          initialSummary={story.summary}
          initialUrl={story.url}
          initialKind={leadKind}
          initialSources={story.sources.length || 1}
          editable={true}
        />
      </section>

      {story.aiTrail.length > 0 && (
        <section className="panel-card slot-mb-lg" aria-labelledby="cascade-heading">
          <span className="mono-kicker">3-TIER EVALUATION CASCADE</span>
          <h2 id="cascade-heading" className="slot-subcard-title">
            Recorded Assessment Trail
          </h2>
          <ul className="stack-list">
            {story.aiTrail.map((step, idx) => (
              <li key={`${step.tier}-${idx}`} className="stack-row slot-text-sm">
                <strong>Tier {step.tier}</strong> ({step.model ?? "deterministic ontology"}) →{" "}
                <span className="landmark-seal">{step.verdict}</span> · confidence{" "}
                {Math.round(step.confidence * 100)}%{step.note ? ` · ${step.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="coverage-heading">
        <h2 id="coverage-heading" className="section-heading">
          Cross-Source Corroboration Timeline ({story.sources.length}{" "}
          {story.sources.length === 1 ? "source" : "sources"})
        </h2>
        <ul className="stack-list">
          {story.sources.map((src, index) => (
            <li key={src.sourceId} className={`stack-row${index === 0 ? " highlighted" : ""}`}>
              <div className="provenance-source-row">
                <div>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="provenance-source-link">
                    {src.outlet ? `${src.outlet} (via ${src.name})` : src.name} ↗
                  </a>
                  <span className="provenance-source-meta">
                    [{src.roleLabel} · {src.reviewLabel} · {src.independence}]
                  </span>
                </div>
                <span className="mono-kicker">
                  {index === 0
                    ? `First indexed ${dateTimeFormat.format(src.firstSeenAt)} UTC`
                    : `+${src.lagMinutes} min lag`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
