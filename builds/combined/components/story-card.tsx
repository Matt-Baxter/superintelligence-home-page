import Link from "next/link";
import type { StoryView } from "@/lib/stories";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatModelLabel(modelId: string | null): string {
  if (!modelId) return "Tier-0 Ontology";
  if (modelId === "tier0-ontology" || modelId === "tier0-rules") return "Tier-0 Ontology";
  if (modelId === "fixture-judge") return "Sample Fixture Judge";
  return modelId;
}

export function StoryCard({ story, returnTo }: { story: StoryView; returnTo: string }) {
  const isLandmark = story.significanceScore >= 65 || (story.aiScore !== null && story.aiScore >= 9.0);
  const pubYear = story.publishedAt.getUTCFullYear();
  const isFoundational = pubYear < 2022;

  return (
    <article
      className="story"
      data-story-id={story.id}
      data-published={story.publishedAt.toISOString()}
    >
      <div className="story-top-meta">
        <span className={`sig-badge${isLandmark ? " landmark" : ""}`}>
          Significance {story.significanceScore}/100
        </span>
        {story.rigorScore >= 25 && (
          <span className="sig-badge" title={`Credibility band: ${story.credibilityBand}`}>
            Rigor {story.rigorScore}/100
          </span>
        )}
        {story.formalRung !== "none" && (
          <span className="sig-badge landmark" title={story.paperRigor.formalProof.label}>
            Formal proof: {story.formalRung}
          </span>
        )}
        {story.hypeScore >= 35 && (
          <span className="sig-badge warn" title="Unbacked sweeping claim or hype wording detected">
            Hype watch ({story.hypeScore})
          </span>
        )}
        {isFoundational && (
          <span className="sig-badge" title="Foundational superintelligence & alignment canon (2015–2021)">
            Foundational ({pubYear})
          </span>
        )}
        <span>{story.updateType}</span>
        <span>·</span>
        <time dateTime={story.publishedAt.toISOString()}>{dateFormat.format(story.publishedAt)}</time>
        {story.sources.length > 1 && (
          <>
            <span>·</span>
            <strong>{story.sources.length} sources grouped</strong>
          </>
        )}
      </div>

      <h2>
        <a href={story.url} target="_blank" rel="noopener noreferrer">
          {story.title}
        </a>
      </h2>

      {story.summary && <p className="summary">{story.summary}</p>}

      {story.aiScore !== null && story.aiReason && (
        <p className="ai-assessment">
          <span className="ai-score">Significance rating: {story.aiScore.toFixed(1)}/10</span>{" — "}
          <span>{story.aiReason}</span>{" "}
          <span className="ai-label">({formatModelLabel(story.aiModel)})</span>
        </p>
      )}

      <ul className="topics" aria-label="Superintelligence topics">
        {story.rootTopics.map((t) => (
          <li key={t.id}>
            <Link href={`/?topic=${encodeURIComponent(t.id)}`} className="topic-label">
              {t.label}
            </Link>{" "}
            <span className="matched">
              (matched: {t.matched.join(", ")}
              {t.via ? ` · via ${t.via}` : ""})
            </span>
          </li>
        ))}
      </ul>

      {(story.benchmarks.length > 0 || story.orgs.length > 0 || story.codeUrls.length > 0) && (
        <div className="entity-strip" aria-label="Extracted benchmarks, organizations and artifacts">
          {story.orgs.map((o) => (
            <span key={o.id} className="entity-chip">
              Org: {o.label}
            </span>
          ))}
          {story.benchmarks.map((b) => (
            <span key={b.id} className="entity-chip">
              Benchmark: {b.label}
              {b.score ? ` (${b.score.raw})` : ""}
            </span>
          ))}
          {story.codeUrls.map((codeUrl) => (
            <a
              key={codeUrl}
              href={codeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="entity-chip"
            >
              Code / Weights
            </a>
          ))}
        </div>
      )}

      <ul className="sources" aria-label="Sources">
        {story.sources.map((s) => (
          <li key={s.sourceId}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.outlet ? `${s.outlet} (via ${s.name})` : s.name}
            </a>
            <span className="source-kind-tag">[{s.reviewLabel}]</span>
          </li>
        ))}
      </ul>

      <div className="story-actions">
        <form method="post" action={`/api/stories/${story.id}/vote`}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="action-btn" aria-pressed={story.voted}>
            {story.voted ? "Remove vote" : "Vote"}
          </button>
        </form>
        <span style={{ color: "var(--muted)" }}>
          {story.votes} {story.votes === 1 ? "vote" : "votes"}
        </span>

        <form method="post" action={`/api/stories/${story.id}/save`}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="action-btn" aria-pressed={story.saved}>
            {story.saved ? "Unsave" : "Save"}
          </button>
        </form>

        <Link href={`/stories/${story.id}`} className="provenance-link">
          Provenance &amp; breakdown →
        </Link>
      </div>
    </article>
  );
}
