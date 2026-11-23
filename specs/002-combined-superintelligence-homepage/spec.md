# Feature Specification: Combined Superintelligence Homepage (`builds/combined/`)

**Feature Directory:** `specs/002-combined-superintelligence-homepage/`  
**Target Workspace:** `builds/combined/`  
**Created:** 2026-11-23  
**Governing Documents:** `.specify/memory/constitution.md` (v1.2.0), `specs/001-superintelligence-homepage/spec.md`, `CONTRACT.md` (v1.0) — all preserved unchanged.

---

## 1. Overview

`builds/combined/` is the unified Milestone M4 synthesis of **Build A (`builds/matt/`)** and **Build B (`builds/john/`)**. It satisfies 100% of the shared specification (`REQ-001` through `REQ-020` and `AT-01` through `AT-14`) while combining the strongest architectural, ontological, analytical, archival, security, and usability capabilities from both builds and closing every empirical gap found during the head-to-head bake-off evaluation.

---

## 2. Traceability to Shared Core Requirements (`REQ-001`..`REQ-020`)

Every shared requirement from `specs/001-superintelligence-homepage/spec.md` is mandatory and preserved verbatim:

- **REQ-001 (Multi-source scheduled fetch):** Automatically fetches from at least 8 public superintelligence sources across at least 5 source kinds (`papers`, `frontier-lab`, `safety-group`, `research-org`, `forum`, `newsletter`, plus `news` search feeds — 22 curated default sources).
- **REQ-002 (Feed presentation):** Displays superintelligence stories newest-first (default) or ranked by significance/votes/coverage, showing title, covering sources, superintelligence topics, matched words, and direct link to original.
- **REQ-003 (Superintelligence-only scope gate):** Admits only items genuinely relevant to superintelligence using canonical key-phrase matching + hierarchical ontology rollup + context-disambiguated scope gating (filtering out general AI product news, photo-editing apps, retail AI, and narrow applied-ML false positives).
- **REQ-004 (Cross-source deduplication & grouping):** Groups duplicate coverage of the same paper or announcement into a single story via priority identity keys (`arxiv:<id>` > `doi:<id>` > `url:<normalized>` > `title:<normalized>`), listing every covering source with outlet attribution and first-seen lag.
- **REQ-005 (Explainable topic tags):** Displays each matched superintelligence topic alongside the exact words/phrases that triggered it (plus `via <subtopic>` lineage when rolled up from a finer ontology node).
- **REQ-006 (Zero Twitter/X):** Never uses Twitter/X/Nitter as a source, never ingests items linking to or originating from Twitter/X, and rejects Twitter/X URLs across all endpoints.
- **REQ-007 (Link out, no full-text hosting):** Links story titles directly to original public URLs and truncates plain-text summaries to at most 300 characters.
- **REQ-008 (Fault-isolated source fetching):** Fetches sources with `Promise.allSettled` and per-source timeouts; an unreachable or malformed feed logs `last_error` without blocking the rest of the feed.
- **REQ-009..REQ-012 (Safe, minimal accounts):** Unique case-insensitive username (`3–30` chars `[A-Za-z0-9_-]`) + password (`>= 8` chars) hashed with salted `scrypt`, timing-safe anti-enumeration sign-in, 30-day `httpOnly` session cookies backed by `SHA-256` token hashes in Postgres, and zero personal data beyond username and password hash.
- **REQ-013..REQ-016 (Per-user votes & saves with server-enforced ownership):** At most one vote and one save per user per story, toggleable via progressive-enhancement form POST or JSON fetch, surviving sign-out and redeploys, strictly derived from session identity, and explicitly refusing (`403 Forbidden`) any request attempting to mutate another user's vote or save (`AT-12`).
- **REQ-017 & REQ-018 (Topic filtering & responsive mobile layout):** First-class topic filtering across all 9 canonical superintelligence topics on desktop and phone (`390px` viewport) with `0px` horizontal scrolling.
- **REQ-019 & REQ-020 (Public deployment & human-written `AGENT_LOG.md`):** Deployable on Vercel + Neon Postgres within free tiers; `AGENT_LOG.md` remains strictly human-authored.

---

## 3. Combined Synthesis Requirements (`REQ-C01`..`REQ-C10`)

To capture the best capabilities of both builds and close every bake-off gap, `builds/combined/` adds:

- **REQ-C01 (Hierarchical Ontology with Context Disambiguation):** Unifies Build A's exact spec key phrases with Build B's 28-topic hierarchy, 23 frontier organizations, 24 benchmarks (with nearby numeric/horizon score extraction), and 37 watched researchers—paired with negative context guards that block geometric/modality `"alignment"`, non-AI `"safety"`/`"governance"`, and narrow domain-application noise.
- **REQ-C02 (Dual-Layer Explainable Significance & 3-Tier AI Cascade):** Computes a free, deterministic 0–100 point-by-point significance score (`Evidence`, `Coverage`, `Update Type`, `Benchmarks`, `Frontier Signals`, `Capability Areas`, `Researcher Watchlist`) for every story, AND supports an optional 3-tier assessment cascade (`Tier 0` deterministic rules → `Tier 1` fast AI Gateway model → `Tier 2` frontier arbiter via Vercel AI Gateway, plus `fixtures` test mode) producing a 1.0–10.0 AI significance rating and one-sentence rationale.
- **REQ-C03 (Story Provenance & Breakdown Page `/stories/[id]`):** Provides an internal provenance view for every story displaying its full coverage timeline (each source, kind, provenance badge, first-seen timestamp, and lag from earliest report), point-by-point significance breakdown, ontology lineage (`matched` terms + `via` child rollups), extracted benchmarks/orgs, and AI assessment trail—while keeping the main `<h2>` card title linked directly to the external source (`REQ-007`).
- **REQ-C04 (Resumable 2023–Present Historical Archive Backfill):** Carries forward Build A's cursorable, rate-limit-aware archive tasks (`history_progress` table) across arXiv monthly windows, Alignment Forum / LessWrong GraphQL monthly top posts, Substack archives, paged feeds, and full lab feeds.
- **REQ-C05 (Public Audit Ledger `/review`):** Carries forward Build A's "How stories are chosen" transparency page showing total ingested stories, shown vs. daily-capped vs. below-threshold counts, score distribution bands, archive backfill completion, and searchable story audit rows.
- **REQ-C06 (Executive Weekly Brief `/brief`):** Carries forward Build B's structured Weekly Intelligence Brief summarizing top landmark stories, 7-day vs. prior-7-day topic velocity, single-source high-significance finds, and benchmark mentions—exposed both as an interactive page and a validated JSON view spec (`/api/brief`).
- **REQ-C07 (Sources Health & Provenance Directory `/sources`):** Displays all active sources grouped by kind with static source-type labels (`primary`/`secondary`, `peer-reviewed`/`preprint`/`lab`/`forum`/`newsletter`/`news`), fetch health (`last_ok_at`, `last_error`), story counts, and one-click OPML download (`/api/sources.opml`).
- **REQ-C08 (Stateless URL Workspace, Named Presets & Machine-Readable Twins):** Encodes active feed filters (`topic`, `q`, `sort`, `window`, `preset`, `curation`, `page`) in URL search params validated by Zod with `.catch()` fallbacks, provides one-click named presets (`All Superintelligence`, `Alignment & Control`, `Frontier Capabilities & RSI`, `Forecasts, Compute & Policy`), `Reset` + `Copy link`, plus JSON (`/api/stories`), Atom 1.0 (`/api/feed.atom`), OPML (`/api/sources.opml`), and authenticated user saves export (`/api/export?format=json|csv`).
- **REQ-C09 (Defense-in-Depth Security & Plain-Text Sanitization):** Enforces HTML/script/image stripping on all ingested titles and summaries (`REQ-021` / `AT-15`), `next.config.ts` security headers, per-IP auth rate limiting, bot honeypot validation, reserved username checks, safe same-origin `returnTo` redirects, and explicit `403` rejection when a request attempts to target another user's `userId`.
- **REQ-C10 (Tri-Theme Editorial Research Aesthetic):** Supports `light`, `dark`, and `tactical` (Anduril/Palantir-inspired monochrome with subtle `#C8973A` house gold reserved strictly for brand mark and primary CTAs) with accessible contrast and `44px` mobile hit targets.

---

## 4. Acceptance Scenarios (Given / When / Then)

All 14 contract acceptance tests (`AT-01`..`AT-14`) plus XSS safety (`AT-15`) and combined precision gates (`AT-C1`..`AT-C4`):

1. **AT-01 (Multi-source newest-first):** Given sample feeds from 8+ working sources across 5+ kinds are fetched, When a visitor opens `/`, Then stories from all 8 working sources appear sorted newest-first.
2. **AT-02 (General AI excluded):** Given sample data contains an AI photo-editing app release, When a visitor views `/`, Then that item does not appear.
3. **AT-03 (Duplicate paper grouped):** Given the same arXiv paper appears across three sources, When a visitor views `/`, Then it appears once listing all three sources.
4. **AT-04 (Explainable topic & matched words):** Given a story mentions `"AGI timelines"`, When a visitor views it on `/` or `/stories/[id]`, Then it displays `Forecasting & timelines` and `(matched: AGI timelines)`.
5. **AT-05 (No Twitter/X):** Given a feed contains a link to `x.com` or `twitter.com`, When ingested and viewed, Then the item is skipped and zero Twitter/X links exist on the page.
6. **AT-06 (Fault isolation):** Given one sample source is unreachable, When `/api/cron/fetch` runs, Then `failed === 1`, `sources.last_error` is recorded, and all other sources' stories load normally.
7. **AT-07 (Sign-up):** Given an unused username on `/signup`, When submitted with an 8+ char password, Then the account is created and the header shows `Signed in as <username>`.
8. **AT-08 (Duplicate username refused):** Given an existing username (any casing), When submitted on `/signup`, Then sign-up is refused with a clear message and no duplicate row is created.
9. **AT-09 (Persistent session):** Given a signed-in user, When they return with their 30-day `httpOnly` session cookie, Then they remain signed in.
10. **AT-10 (Vote persistence):** Given User A votes on a story, signs out, and signs back in, Then the vote count and `Remove vote` (`aria-pressed="true"`) state persist.
11. **AT-11 (Private per-user saves):** Given User A and User B save different stories, When each opens `/saved`, Then each sees only their own saved stories.
12. **AT-12 (Cross-user tamper refusal):** Given User A sends a POST to `/api/stories/[id]/vote` or `/save` attempting to specify `userId=<User B's id>`, Then the server returns `403` and User B's vote/save state is unchanged.
13. **AT-13 (Topic filter + 390px phone layout):** Given stories across multiple topics, When a reader selects `Alignment` (`/?topic=alignment`) at `390x844` mobile viewport, Then only Alignment stories appear and `documentElement.scrollWidth <= window.innerWidth` (`0px` sideways overflow).
14. **AT-14 (Sub-2-minute onboarding):** Given a new visitor opens `/`, Then the feed is immediately readable and `/signup` is 1 click away in the top header.
15. **AT-15 (XSS / HTML stripping):** Given a feed item summary contains `<script>` or `<img src="...">`, When rendered, Then tags are stripped to plain text and zero scripts/images execute.
16. **AT-C1 (False-positive disambiguation):** Given papers titled `"Cross-Modal Visual Alignment for Video Generation"` or `"Self-Improving Neural Networks for Medical Image Segmentation"`, When evaluated by the ontology scope gate, Then they are rejected as applied/geometric false positives and do not pollute `?topic=alignment` or `/`.
17. **AT-C2 (Sub-topic lineage rollup):** Given a paper about `"Mechanistic circuits and chain-of-thought monitoring in frontier models"`, When tagged, Then `Chain-of-thought monitoring` rolls up to `Interpretability` with both direct matched words and `via` lineage preserved.
18. **AT-C3 (Story provenance & Weekly Brief):** Given multi-source stories exist, When a reader opens `/stories/[id]` or `/brief`, Then coverage lag, significance factor points, and weekly topic velocity render accurately.
19. **AT-C4 (Audit ledger `/review` & portability):** Given ingested stories and a signed-in user with saved items, When visiting `/review`, `/api/feed.atom`, `/api/sources.opml`, or `/api/export?format=json`, Then each returns valid, user-scoped or public data with zero leakage.

---

## 5. Success Criteria

- **SC-001..SC-008:** All shared measurable outcomes satisfied at 100% on synthetic fixtures.
- **SC-C01:** 100% precision and 100% recall on the combined gold-set of 30 superintelligence vs. general/applied-AI edge-case titles (including all false positives caught in the Build A/B bake-off).
- **SC-C02:** `0px` horizontal overflow across `/`, `/?topic=alignment`, `/stories/[id]`, `/brief`, `/sources`, `/review`, `/saved`, `/signin`, and `/signup` at `390x844` phone viewport.
- **SC-C03:** Zero TypeScript errors (`tsc --noEmit`), clean unit & integration test suite, and live Neon Postgres verification.
