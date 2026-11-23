import type { Metadata } from "next";
import { getSourcesDirectory } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Public Sources & Provenance",
};

const KIND_HEADINGS: Record<string, string> = {
  papers: "Research Papers & Preprints",
  "frontier-lab": "Frontier AI Lab Research Blogs",
  "safety-group": "Alignment & Safety Research Groups",
  "research-org": "Forecasting & Research Organizations",
  forum: "Technical Research Forums",
  newsletter: "Curated Research Newsletters",
  news: "Targeted Superintelligence Press Searches",
};

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function SourcesPage() {
  const sources = await getSourcesDirectory();
  const kinds = [...new Set(sources.map((s) => s.kind))];
  const healthyCount = sources.filter((s) => s.lastOkAt && !s.lastError).length;

  return (
    <>
      <div className="feed-banner">
        <div>
          <h1 className="feed-heading">Public Superintelligence Sources</h1>
          <p className="feed-subtitle">
            {sources.length} open feeds across {kinds.length} source kinds ({healthyCount} healthy on last check). Zero Twitter/X dependencies. One failing feed never blocks the rest.
          </p>
        </div>
        <div className="utility-group">
          <a href="/api/sources.opml" className="btn-primary">
            Download OPML 2.0
          </a>
        </div>
      </div>

      {kinds.map((kind) => {
        const group = sources.filter((s) => s.kind === kind);
        return (
          <section key={kind} aria-labelledby={`kind-${kind}`}>
            <h2 id={`kind-${kind}`} className="section-heading">
              {KIND_HEADINGS[kind] ?? kind} ({group.length})
            </h2>
            <ul className="stack-list">
              {group.map((s) => (
                <li key={s.id} className="stack-row">
                  <div className="stack-row-head">
                    <div>
                      <a href={s.homeUrl || s.feedUrl} target="_blank" rel="noopener noreferrer" className="source-link-title">
                        {s.name} ↗
                      </a>
                      <span className="source-role-meta">
                        [{s.roleLabel} · {s.reviewLabel} · {s.independence}]
                      </span>
                    </div>
                    <span className={s.lastError ? "source-status-warn" : "source-status-ok"}>
                      {s.lastError
                        ? `Last fetch warning: ${s.lastError}`
                        : s.lastOkAt
                          ? `OK (${dateTimeFormat.format(s.lastOkAt)} UTC) · ${s.storyCount} stories`
                          : `Configured · ${s.storyCount} stories`}
                    </span>
                  </div>
                  <p className="stack-row-note">
                    {s.provenanceNote}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
