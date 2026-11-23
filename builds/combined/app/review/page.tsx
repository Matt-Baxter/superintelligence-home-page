import type { Metadata } from "next";
import Link from "next/link";
import { AUDIT_STATUS_LABEL, getReviewLedger, type AuditStatus } from "@/lib/stories";

export const metadata: Metadata = {
  title: "How Stories Are Chosen",
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100);
  const source = params.source ?? "";
  const status = params.status ?? "";

  const ledger = await getReviewLedger({ q, source, status });

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">How Stories Are Chosen</h1>
          <p className="feed-subtitle">
            Public audit ledger combining Build A&apos;s transparency ledger and 2015–present archive backfill tracker with Build B&apos;s deterministic 0–100 significance, 8-marker empirical rigor, and 3-tier assessment cascade.
          </p>
        </div>
        <Link href="/analysis" className="btn-secondary">
          Open SIM Outer-Loop &amp; Analysis Lab →
        </Link>
      </div>

      <section className="panel-grid" aria-label="Audit totals">
        <div className="stat-card">
          <div className="stat-value">{ledger.counts.total}</div>
          <div className="stat-label">Stories evaluated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ledger.counts.shown + ledger.counts.dailyCapped}</div>
          <div className="stat-label">In-scope 8.0+ stories ({ledger.counts.shown} daily-top)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ledger.counts.outOfScope + ledger.counts.belowThreshold}</div>
          <div className="stat-label">Filtered out or below 8.0</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {ledger.history.doneTasks}/{ledger.history.totalTasks}
          </div>
          <div className="stat-label">2015–present archive backfill tasks completed</div>
        </div>
      </section>

      <div className="panel-card dist-bands-card">
        <strong>Score distribution bands: </strong>
        {ledger.bands.map((b, idx) => (
          <span key={b.label} className="dist-band-item">
            {idx > 0 ? " · " : ""}
            {b.label}: <strong>{b.count}</strong>
          </span>
        ))}
      </div>

      <form method="get" action="/review" className="toolbar-shell" aria-label="Filter audit ledger">
        <div className="controls-form">
          <label className="control-field search-field">
            Title contains
            <input type="search" name="q" defaultValue={q} maxLength={100} placeholder="Filter evaluated titles" />
          </label>
          <label className="control-field">
            Source
            <select name="source" defaultValue={source}>
              <option value="">All sources</option>
              {ledger.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="control-field">
            Audit status
            <select name="status" defaultValue={status}>
              <option value="">Any status</option>
              {(Object.keys(AUDIT_STATUS_LABEL) as AuditStatus[]).map((k) => (
                <option key={k} value={k}>
                  {AUDIT_STATUS_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary">
            Filter
          </button>
          {(q || source || status) && (
            <Link href="/review" className="btn-secondary">
              Reset
            </Link>
          )}
        </div>
      </form>

      {ledger.stories.length === 0 ? (
        <p className="empty-state">No evaluated stories match those filters.</p>
      ) : (
        <ul className="stack-list">
          {ledger.stories.map((s) => (
            <li
              key={s.id}
              className={`stack-row${s.status === "shown" ? " highlighted" : ""}`}
            >
              <div className="stack-row-head">
                <div className="stack-row-badges">
                  <span className="sig-badge">Det {s.significanceScore}/100</span>
                  {s.rigorScore > 0 && <span className="sig-badge">Rigor {s.rigorScore}/100</span>}
                  {s.hypeScore >= 35 && <span className="sig-badge warn">Hype {s.hypeScore}</span>}
                  {s.aiScore !== null && <span className="sig-badge">Rating {s.aiScore.toFixed(1)}/10</span>}
                  <span className="stack-row-meta">
                    {AUDIT_STATUS_LABEL[s.status]}
                  </span>
                </div>
                <span className="stack-row-meta">
                  {dateFormat.format(s.publishedAt)} · {s.sources.join(", ")}
                </span>
              </div>
              <h3 className="stack-row-title">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </h3>
              <p className="stack-row-note tight">
                {s.aiReason || s.scopeReason} · <Link href={`/stories/${s.id}`}>Inspect provenance →</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
