import { analyzeStory } from "./analysis";
import { assessStory } from "./assess";
import { ensureSchema, S, sql } from "./db";
import { fetchFeed, type ParsedFeedItem } from "./feeds";
import { tagText } from "./ontology";
import type { SourceKind } from "./schemas";
import { DEFAULT_SOURCES, type SourceCatalogEntry } from "./sources-data";
import { extractCodeUrls, htmlToText, isTwitterUrl, storyKeysFor, truncate } from "./text";

// Transactional Multi-Source Ingest, Cross-Source Deduplication & Assessment Pipeline
// (REQ-001..REQ-008, REQ-021, REQ-C01..REQ-C04).

export type IngestOutcome = "created" | "grouped" | "skipped";

export async function seedDefaultSources(customSources?: SourceCatalogEntry[]): Promise<void> {
  await ensureSchema();
  const list = customSources ?? DEFAULT_SOURCES;
  for (const s of list) {
    if (isTwitterUrl(s.feedUrl) || isTwitterUrl(s.homeUrl)) continue;
    await sql`
      INSERT INTO ${S()}.sources (
        id, name, kind, feed_url, home_url, role_label, review_label, independence, provenance_note
      )
      VALUES (
        ${s.id}, ${s.name}, ${s.kind}, ${s.feedUrl}, ${s.homeUrl},
        ${s.roleLabel}, ${s.reviewLabel}, ${s.independence}, ${s.provenanceNote}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        feed_url = EXCLUDED.feed_url,
        home_url = EXCLUDED.home_url,
        role_label = EXCLUDED.role_label,
        review_label = EXCLUDED.review_label,
        independence = EXCLUDED.independence,
        provenance_note = EXCLUDED.provenance_note
    `;
  }
}

export async function ingestFeedItem(
  item: ParsedFeedItem,
  sourceId: string,
  seenAt: Date = new Date(),
): Promise<{ outcome: IngestOutcome; storyId?: string }> {
  const link = (item.link || "").trim();

  // REQ-006 / AT-05: Never Twitter/X/Nitter
  if (!link || isTwitterUrl(link) || (item.outletUrl && isTwitterUrl(item.outletUrl))) {
    return { outcome: "skipped" };
  }
  if (!/^https?:\/\//i.test(link)) {
    return { outcome: "skipped" };
  }

  // REQ-021 / AT-15 & REQ-007: Plain text only; summary <= 300 chars
  const title = htmlToText(item.title);
  if (!title || title.length < 4) return { outcome: "skipped" };

  let rawSummary = htmlToText(item.summary);
  if (item.outlet && rawSummary.toLowerCase().startsWith(title.toLowerCase())) {
    rawSummary = "";
  }
  const summary = truncate(rawSummary, 300);
  const authors = truncate(htmlToText(item.authors), 200);
  const codeUrls = extractCodeUrls(`${item.summary ?? ""} ${link}`);

  // REQ-003 & REQ-005: Match superintelligence ontology & disambiguated scope gate
  const tagged = tagText(title, summary);
  if (tagged.rootTopics.length === 0) {
    return { outcome: "skipped" };
  }

  const publishedAt = item.published ?? seenAt;
  const keys = storyKeysFor({ url: link, title, summary });
  if (keys.length === 0) return { outcome: "skipped" };

  const txResult = await sql.begin(async (tx) => {
    const schema = sql(process.env.DB_SCHEMA || "si_combined");

    // REQ-004 / AT-03: Priority lookup arxiv:<id> > doi:<id> > url:<norm> > title:<norm>
    const existing = await tx<{ story_id: string }[]>`
      SELECT story_id
      FROM ${schema}.story_keys
      WHERE key IN ${tx(keys)}
      ORDER BY CASE
        WHEN key LIKE 'arxiv:%' THEN 0
        WHEN key LIKE 'doi:%' THEN 1
        WHEN key LIKE 'url:%' THEN 2
        ELSE 3
      END
      LIMIT 1
    `;

    let storyId: string;
    let outcome: IngestOutcome;

    if (existing.length > 0) {
      storyId = String(existing[0].story_id);
      outcome = "grouped";
      await tx`
        UPDATE ${schema}.stories
        SET
          published_at = LEAST(published_at, ${publishedAt}),
          summary = CASE WHEN char_length(summary) < ${summary.length} THEN ${summary} ELSE summary END,
          authors = CASE WHEN authors = '' AND ${authors} <> '' THEN ${authors} ELSE authors END,
          in_scope = (in_scope OR ${tagged.inScope})
        WHERE id = ${storyId}
      `;
    } else {
      const [inserted] = await tx<{ id: string }[]>`
        INSERT INTO ${schema}.stories (
          title, url, summary, authors, published_at, first_seen_at,
          in_scope, scope_reason, orgs, code_urls
        )
        VALUES (
          ${title}, ${link}, ${summary}, ${authors}, ${publishedAt}, ${seenAt},
          ${tagged.inScope}, ${tagged.scopeReason},
          ${tx.json(tagged.orgs)}, ${tx.json(codeUrls)}
        )
        RETURNING id
      `;
      storyId = String(inserted.id);
      outcome = "created";
    }

    await tx`
      INSERT INTO ${schema}.story_sources (story_id, source_id, url, outlet, first_seen_at)
      VALUES (${storyId}, ${sourceId}, ${link}, ${item.outlet ?? null}, ${seenAt})
      ON CONFLICT (story_id, source_id) DO UPDATE SET
        first_seen_at = LEAST(${schema}.story_sources.first_seen_at, EXCLUDED.first_seen_at),
        outlet = COALESCE(${schema}.story_sources.outlet, EXCLUDED.outlet)
    `;

    for (const t of tagged.topics) {
      await tx`
        INSERT INTO ${schema}.story_topics (story_id, topic_id, is_root, matched, via)
        VALUES (${storyId}, ${t.id}, ${t.isRoot}, ${t.matched}, ${t.via})
        ON CONFLICT (story_id, topic_id) DO UPDATE SET
          matched = ARRAY(SELECT DISTINCT unnest(${schema}.story_topics.matched || EXCLUDED.matched)),
          via = COALESCE(${schema}.story_topics.via, EXCLUDED.via)
      `;
    }

    for (const key of keys) {
      await tx`
        INSERT INTO ${schema}.story_keys (key, story_id)
        VALUES (${key}, ${storyId})
        ON CONFLICT (key) DO NOTHING
      `;
    }

    // Recompute deterministic 0–100 significance, 8-marker rigor, hype & formal verification with updated coverage
    const [storyRow] = await tx<{ title: string; summary: string; authors: string; url: string }[]>`
      SELECT title, summary, authors, url FROM ${schema}.stories WHERE id = ${storyId}
    `;
    const covRows = await tx<{ kind: SourceKind }[]>`
      SELECT src.kind
      FROM ${schema}.story_sources ss
      JOIN ${schema}.sources src ON src.id = ss.source_id
      WHERE ss.story_id = ${storyId}
    `;

    const currentTag = tagText(storyRow.title, storyRow.summary);
    const analysis = analyzeStory({
      title: storyRow.title,
      summary: storyRow.summary,
      authors: storyRow.authors,
      url: storyRow.url,
      topics: currentTag.topics,
      sourceKinds: covRows.map((c) => c.kind),
      sourceCount: covRows.length,
    });

    await tx`
      UPDATE ${schema}.stories
      SET
        in_scope = ${currentTag.inScope},
        scope_reason = ${currentTag.scopeReason},
        significance_score = ${analysis.significanceScore},
        rigor_score = ${analysis.rigorScore},
        hype_score = ${analysis.hypeScore},
        credibility_band = ${analysis.paperRigor.credibilityBand},
        formal_rung = ${analysis.paperRigor.formalProof.rungId},
        paper_rigor = ${tx.json(analysis.paperRigor)},
        update_type = ${analysis.updateType.label},
        evidence_level = ${analysis.evidenceLevel.label},
        why_breakdown = ${tx.json(analysis.why)},
        orgs = ${tx.json(currentTag.orgs)},
        benchmarks = ${tx.json(analysis.benchmarks)},
        people = ${tx.json(analysis.people)}
      WHERE id = ${storyId}
    `;

    return { outcome, storyId };
  });

  return txResult;
}

// Prioritizes in-scope high-significance & high-rigor stories BEFORE mere recency so foundational pre-2023
// papers are never starved behind low-signal daily chatter during historical archive backfill.
export async function judgePendingStories(limit = 60): Promise<{ judged: number; failed: number }> {
  await ensureSchema();
  const rows = await sql<
    {
      id: string;
      title: string;
      summary: string;
      url: string;
      significance_score: number;
      sources: string[];
      source_kinds: SourceKind[];
    }[]
  >`
    SELECT
      s.id,
      s.title,
      s.summary,
      s.url,
      s.significance_score,
      COALESCE(
        ARRAY(
          SELECT src.name
          FROM ${S()}.story_sources ss
          JOIN ${S()}.sources src ON src.id = ss.source_id
          WHERE ss.story_id = s.id
          ORDER BY src.name
        ),
        '{}'
      ) AS sources,
      COALESCE(
        ARRAY(
          SELECT DISTINCT src.kind
          FROM ${S()}.story_sources ss
          JOIN ${S()}.sources src ON src.id = ss.source_id
          WHERE ss.story_id = s.id
        ),
        '{}'
      ) AS source_kinds
    FROM ${S()}.stories s
    WHERE s.judged_at IS NULL
    ORDER BY s.in_scope DESC, s.significance_score DESC, s.rigor_score DESC, s.published_at DESC
    LIMIT ${limit}
  `;

  let judged = 0;
  let failed = 0;
  const concurrency = 5;

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const res = await assessStory({
            title: row.title,
            summary: row.summary,
            url: row.url,
            sources: row.sources,
            sourceKinds: row.source_kinds,
            significanceScore: Number(row.significance_score),
          });
          await sql`
            UPDATE ${S()}.stories
            SET
              ai_score = ${res.score},
              ai_reason = ${res.reason},
              ai_model = ${res.model},
              ai_tier = ${res.tier},
              ai_verdict = ${res.verdict},
              ai_confidence = ${res.confidence},
              ai_trail = ${sql.json(res.trail)},
              judged_at = now()
            WHERE id = ${row.id}
          `;
          judged++;
        } catch {
          failed++;
        }
      }),
    );
  }

  return { judged, failed };
}

export type FetchAllSummary = {
  fetched: number;
  failed: number;
  created: number;
  grouped: number;
  judged: number;
};

// Fetches every configured source in parallel; one failing source never stops the others (REQ-008 / AT-06).
export async function fetchAllSources(opts?: {
  fetcher?: (url: string) => Promise<ParsedFeedItem[]>;
  judgeLimit?: number;
}): Promise<FetchAllSummary> {
  await ensureSchema();
  const sourceRows = await sql<{ id: string; feed_url: string }[]>`
    SELECT id, feed_url FROM ${S()}.sources ORDER BY id
  `;
  if (sourceRows.length === 0) {
    await seedDefaultSources();
    return fetchAllSources(opts);
  }

  const runFetch = opts?.fetcher ?? ((u: string) => fetchFeed(u, 30));
  const settled = await Promise.allSettled(sourceRows.map((s) => runFetch(s.feed_url)));

  let fetched = 0;
  let failed = 0;
  let created = 0;
  let grouped = 0;

  for (let i = 0; i < sourceRows.length; i++) {
    const source = sourceRows[i];
    const result = settled[i];

    if (result.status === "rejected") {
      failed++;
      const errMsg = result.reason instanceof Error ? result.reason.message : "Source unreachable";
      await sql`
        UPDATE ${S()}.sources
        SET last_error = ${errMsg.slice(0, 200)}
        WHERE id = ${source.id}
      `;
      continue;
    }

    fetched++;
    for (const item of result.value) {
      try {
        const res = await ingestFeedItem(item, source.id);
        if (res.outcome === "created") created++;
        else if (res.outcome === "grouped") grouped++;
      } catch (err) {
        console.error(`Ingest item error (${source.id}):`, err);
      }
    }

    await sql`
      UPDATE ${S()}.sources
      SET last_ok_at = now(), last_error = NULL
      WHERE id = ${source.id}
    `;
  }

  const { judged } = await judgePendingStories(opts?.judgeLimit ?? 80);
  return { fetched, failed, created, grouped, judged };
}
