# Implementation Plan: Feature parity with AI-news and research apps

**Spec**: [spec.md](spec.md) (REQ-041..REQ-052, proposed) · **Tasks**: [tasks.md](tasks.md) · **Survey and gap ranking**: [`docs/PARITY.md`](../../docs/PARITY.md), data in [`docs/market/apps.json`](../../docs/market/apps.json)

## Where it lives today

| Gap | Code now | What changes |
| --- | --- | --- |
| Personalisation (REQ-041) | `storyRows` in `server.js` sorts by top, new, votes or signal; `GET /api/knowledge/similar` ranks by a typed query | New `sort=foryou`: per-reader logistic regression over TF-IDF of stored titles and summaries (`lib/personal.js`), trained from that reader's votes and saves on request (capped at the newest 2,000 stories) or in the daily job; reasons = top-weighted words present in the story. Opt-in flag on the account; opting out deletes the weights. |
| Search (REQ-042) | `q` on `GET /api/stories`: `LOWER(title) LIKE ? OR LOWER(summary) LIKE ?` | `stories_fts` (SQLite FTS5) and a generated `tsvector` column with a GIN index (Postgres) behind `db.search()` in `lib/db.js`; indexed text = title + summary + topic labels + matched words; LIKE kept as fallback. Rebuilt on re-tag. |
| Coverage (REQ-043) | `public/story.html` "covered by" table (name, kind, link); `story_links.seen_at` stored, not returned | Return `seen_at` per link in `shapeStory`; panel ordered by first seen with lag; brief block "single-source stories" (`views/specs.mjs`). |
| Source labels (REQ-044) | `kind` per source; `EVIDENCE` in `lib/analysis.js` maps kind to an evidence level | `label: {role, review, independence, why}` in `lib/sources.json` and `lib/source-catalog.json`; shown on cards (`public/js/api.js`) and the panel. A scoring use is a separate `[rules]` task. |
| Feeds out (REQ-045) | `GET /api/learn/feed.xml` (Learn posts only); `GET /api/brief` (in-app JSON) | `GET /feeds/topic/:id.atom` and `GET /feeds/brief.atom` with `Cache-Control: public, s-maxage=3600`; "since last visit" from `localStorage` in `public/index.html`. |
| Mute (REQ-046) | filters only include (`topic`, `kind`, `org`, `tag`, `days`, `min`) | `user_mutes (user_id, kind, value)` table, `GET/POST/DELETE /api/mutes`, applied as `NOT IN` / `NOT LIKE` clauses in the feed and brief queries; hidden count returned. |
| Code links (REQ-047) | `parseHfDaily` in `lib/feeds.js` keeps title, summary, date | Extract code, model and dataset URLs from abstracts and from the HF entry's repository fields where the public API returns them; `story_entities` kind `artifact` (URL only); badge; offered to `modules/lab/papers.js`. |
| Citation neighbourhood (REQ-048) | `semantic-scholar` format is a search feed | `GET /api/papers/:id/neighbours` in a module, one outside call per paper per 30 days, `paper_neighbours` cache table pruned by the harvester's prune hook. |
| Export (REQ-049) | `GET /api/admin/opml` (admin only), `GET /api/knowledge/export.jsonld` | `GET /api/me/export?format=json|csv`; `GET /sources.opml` public (active sources only). |
| Offline (REQ-050) | phone layout (`public/css/app.css`) | `public/manifest.webmanifest`, `public/sw.js` caching the shell and `/api/stories?saved=1` cards; cleared on logout. |
| Change log (REQ-051) | `admin_audit` + `GET /api/admin/audit` (admin only) | `rules_changes` (version, date, summary) written when `lib/rules/*.json` or `lib/ontology.json` versions change; public `GET /api/changes` and page; moderation rows copied without `admin_id`; prune after a year. |
| Votes (REQ-052) | `votes (user_id, story_id)`, no rate limit; rank `votes × 3` | Daily cap (100) on `POST /api/stories/:id/vote`; new-account weight 0.5 in `storyRows` rank, listed in the explanation (`[rules]`); separate `agreements (user_id, story_id, value)` table, never read by rank. |

Every new route, table and response shape is logged in `docs/INTERFACES.md` when it is built (change-the-contract skill), and every feature is a profile feature in `modules/profiles.json` (extended only), so the spec version keeps answering 404.

## Constraints, per gap

- **Free tiers**: no polling of outside services; the citation API is called only when a reader asks, then cached; the reader model trains on request or in the existing daily job; Atom feeds are edge-cached; new tables are pruned (`harvester.addPrune`).
- **REQ-007**: search, offline cache, feeds and exports hold titles, summaries (already capped), links and scores only.
- **REQ-012**: "since last visit" stays in the browser; mute rules and the reader model are preferences kept with the account like votes and saves, deleted with it; exports contain only the reader's own rows; the public change log never names an admin.
- **REQ-006**: artifact links, imported OPML and feeds go through the same Twitter/X refusal as `addItem`.
- **People**: source labels describe a source's type; a person's blog gets a type label ("personal blog, secondary"), never a judgement.

## Order

1. Approval (T000) and the open decisions (T001, T002).
2. Cheap, no scoring change: search index (REQ-042), mute (REQ-046), coverage panel (REQ-043), labels on display (REQ-044), Atom feeds and "since last visit" (REQ-045).
3. Readers' data out: export and public OPML (REQ-049), offline list (REQ-050).
4. Research layer: code links (REQ-047), then the citation neighbourhood (REQ-048) after the API terms are checked.
5. Personalisation (REQ-041), measured on a synthetic reader set first.
6. Rules changes, each only when a person asks: labels in the score (REQ-044), vote weight and caps (REQ-052), measured by `npm run bench`.
7. Public change log (REQ-051), so step 6's changes are the first entries.

## Measures

A synthetic search set and a synthetic reader set go into `bench/` (Sample, test data) with metrics `parity.search_recall`, `parity.foryou_precision_at_10` and `parity.mute_leak` (must stay 0), ratcheted by `npm run bench` (REQ-029). `docs/PARITY.md` is regenerated from `docs/market/apps.json` when a gap closes.
