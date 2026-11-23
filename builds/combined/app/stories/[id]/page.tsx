import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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

  return (
    <>
      <p style={{ margin: "0 0 0.75rem" }}>
        <Link href="/">← Back to Superintelligence Feed</Link>
      </p>

      <article className="panel-card" style={{ marginBottom: "1.25rem" }}>
        <div className="story-top-meta">
          <span className="sig-badge landmark">Significance {story.significanceScore}/100</span>
          <span className="sig-badge">Rigor {story.rigorScore}/100 ({story.credibilityBand})</span>
          <span className="sig-badge">Best composite {story.bestScore}/100</span>
          {story.hypeScore > 0 && <span className="sig-badge">Hype {story.hypeScore}/100</span>}
          <span>{story.updateType}</span>
          <span>·</span>
          <span>{story.evidenceLevel}</span>
          <span>·</span>
          <time dateTime={story.publishedAt.toISOString()}>
            {dateTimeFormat.format(story.publishedAt)} UTC
          </time>
        </div>

        <h1 style={{ margin: "0.25rem 0 0.5rem", fontSize: "clamp(1.25rem, 2.5vw, 1.65rem)", lineHeight: 1.3 }}>
          <a href={story.url} target="_blank" rel="noopener noreferrer">
            {story.title} ↗
          </a>
        </h1>

        {story.authors && (
          <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
            Authors: {story.authors}
          </p>
        )}

        {story.summary && <p className="summary">{story.summary}</p>}

        <div className="story-actions" style={{ marginTop: "0.875rem" }}>
          <a href={story.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Read original source ↗
          </a>

          <form method="post" action={`/api/stories/${story.id}/vote`}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="action-btn" aria-pressed={story.voted}>
              {story.voted ? "Remove vote" : "Vote"} ({story.votes})
            </button>
          </form>

          <form method="post" action={`/api/stories/${story.id}/save`}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="action-btn" aria-pressed={story.saved}>
              {story.saved ? "Unsave" : "Save"}
            </button>
          </form>
        </div>

        {user ? (
          <details className="flag-details">
            <summary>Rating looks wrong? Send it to human review</summary>
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
                placeholder="e.g. This is a medical imaging paper"
              />
              <button type="submit" className="btn-secondary btn-small">
                Send to review queue
              </button>
            </form>
          </details>
        ) : null}
      </article>

      <div className="panel-grid">
        <section className="panel-card" aria-labelledby="why-heading">
          <h2 id="why-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>
            Deterministic Significance Breakdown ({story.significanceScore}/100)
          </h2>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.825rem" }}>
            Every point is computed deterministically from source evidence tier, corroboration, benchmarks and frontier claims.
          </p>
          <ul className="stack-list">
            {story.why.map((w) => (
              <li key={w.factor} className="stack-row">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong>{w.factor}</strong>
                  <span className="sig-badge">+{w.points} pts</span>
                </div>
                <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {w.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel-card" aria-labelledby="ontology-heading">
          <h2 id="ontology-heading" style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>
            Ontology Tagging &amp; Scope Provenance
          </h2>
          <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.825rem" }}>
            {story.scopeReason}
          </p>
          <ul className="stack-list">
            {story.topics.map((t) => (
              <li key={t.id} className="stack-row">
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
                  <Link href={`/?topic=${encodeURIComponent(t.id)}`} style={{ fontWeight: 600 }}>
                    {t.label}
                  </Link>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {t.isRoot ? "Canonical Spec Topic" : "Sub-topic"}
                  </span>
                </div>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.825rem", color: "var(--muted)" }}>
                  matched: {t.matched.join(", ") || "(rolled up)"}
                  {t.via ? ` · rolled up via ${t.via}` : ""}
                </p>
              </li>
            ))}
          </ul>

          {story.aiScore !== null && (
            <div style={{ marginTop: "0.875rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.95rem" }}>
                3-Tier Assessment Trail ({story.aiScore.toFixed(1)}/10)
              </h3>
              {story.aiReason && (
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  {story.aiReason}
                </p>
              )}
              <ul className="stack-list">
                {story.aiTrail.map((step, idx) => (
                  <li key={`${step.tier}-${idx}`} style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Tier {step.tier} ({step.model ?? "rules"}) → <strong>{step.verdict}</strong> (confidence{" "}
                    {Math.round(step.confidence * 100)}%{step.note ? ` · ${step.note}` : ""})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="panel-card" style={{ marginBottom: "1.25rem" }} aria-labelledby="rigor-heading">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem", alignItems: "baseline" }}>
          <h2 id="rigor-heading" style={{ margin: 0, fontSize: "1.05rem" }}>
            Paper Evidence, Claim-Backing &amp; Goodhart Audit ({story.rigorScore}/100)
          </h2>
          <Link
            href={`/analysis?tab=live-inspector&title=${encodeURIComponent(story.title)}&summary=${encodeURIComponent(story.summary)}&url=${encodeURIComponent(story.url)}`}
            className="btn-secondary"
          >
            Inspect in Analysis Lab →
          </Link>
        </div>
        <p style={{ margin: "0.35rem 0 0.75rem", color: "var(--muted)", fontSize: "0.825rem" }}>
          Artifact kind: <strong>{story.paperRigor.paperKind.label}</strong> ({story.paperRigor.paperKind.why}) · Rubric:{" "}
          <strong>{story.paperRigor.rubric}</strong> · Credibility: <strong>{story.credibilityBand}</strong>
          {story.paperRigor.formalProof.rungId !== "none"
            ? ` · Formal proof: ${story.paperRigor.formalProof.label}`
            : ""}
        </p>

        <div className="panel-grid" style={{ margin: "0.5rem 0" }}>
          <div>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>
              Present Evidence Markers ({story.paperRigor.presentMarkers.length})
            </h3>
            {story.paperRigor.presentMarkers.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--muted)" }}>
                No quantitative/methodological markers extracted from summary snippet.
              </p>
            ) : (
              <ul className="stack-list">
                {story.paperRigor.presentMarkers.map((m) => (
                  <li key={m.id} className="stack-row" style={{ padding: "0.5rem 0.65rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
                      <strong style={{ fontSize: "0.84rem" }}>{m.label}</strong>
                      <span className="sig-badge">+{m.points}</span>
                    </div>
                    {m.snippet && (
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                        &ldquo;{m.snippet}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "0.9rem" }}>
              Sentence Claim-Backing &amp; Negation Checks
            </h3>
            <p style={{ margin: "0 0 0.45rem", fontSize: "0.8rem", color: "var(--muted)" }}>
              Backed: <strong>{story.paperRigor.claims.backed}</strong> · Partly backed:{" "}
              <strong>{story.paperRigor.claims.partlyBacked}</strong> · Unbacked:{" "}
              <strong>{story.paperRigor.claims.unbacked}</strong>
            </p>
            {story.paperRigor.negatedMarkers.length > 0 && (
              <p style={{ margin: "0 0 0.45rem", fontSize: "0.8rem", color: "var(--status-warn)" }}>
                Negated markers blocked:{" "}
                {story.paperRigor.negatedMarkers.map((n) => `${n.label} ("${n.snippet}")`).join("; ")}
              </p>
            )}
            {story.paperRigor.claims.items.length > 0 ? (
              <ul className="stack-list">
                {story.paperRigor.claims.items.map((c, idx) => (
                  <li key={idx} className="stack-row" style={{ padding: "0.5rem 0.65rem", fontSize: "0.8rem" }}>
                    <span className={`sig-badge${c.level === "unbacked" ? " warn" : ""}`}>{c.level}</span>{" "}
                    <span style={{ color: "var(--text-secondary)" }}>{c.sentence}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--muted)" }}>
                No sweeping unhedged assertions detected in summary text.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="coverage-heading">
        <h2 id="coverage-heading" className="section-heading">
          Cross-Source Coverage Timeline ({story.sources.length}{" "}
          {story.sources.length === 1 ? "source" : "sources"})
        </h2>
        <ul className="stack-list">
          {story.sources.map((src, index) => (
            <li key={src.sourceId} className={`stack-row${index === 0 ? " highlighted" : ""}`}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.5rem" }}>
                <div>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                    {src.outlet ? `${src.outlet} (via ${src.name})` : src.name} ↗
                  </a>
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
                    [{src.roleLabel} · {src.reviewLabel} · {src.independence}]
                  </span>
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {index === 0
                    ? `First seen ${dateTimeFormat.format(src.firstSeenAt)} UTC`
                    : `+${src.lagMinutes} min after first seen`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
