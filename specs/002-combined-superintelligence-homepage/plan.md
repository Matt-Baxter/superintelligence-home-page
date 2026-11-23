# Technical Implementation Plan: Combined Superintelligence Homepage (`builds/combined/`)

**Spec:** `specs/002-combined-superintelligence-homepage/spec.md`  
**Gap Matrix:** `specs/002-combined-superintelligence-homepage/gap-matrix.md`  
**Date:** 2026-11-23

---

## 1. Stack & Architectural Decisions

1. **Framework:** Next.js 16.4+ App Router (`builds/combined/`) with React 19.2+ Server Components, progressive-enhancement Route Handlers, and TypeScript 5.9 (`strict: true`).
2. **Ontological & Schema Validation:** Zod 4 (`lib/schemas.ts`) is the single source of truth for:
   - Ontology definitions (`TopicNodeSchema`, `OrganizationSchema`, `BenchmarkSchema`, `ResearcherSchema`, `ScopeConfigSchema`)
   - URL filter/workspace state (`FeedQuerySchema` with per-field `.catch()` defaults)
   - Story, Coverage, Significance Breakdown, Assessment Trail, and Brief view specs
   - Auth & interaction payloads
3. **Database & Multi-Build Isolation (`lib/db.ts`, `db/schema.sql`):**
   - Uses `postgres` (`postgres.js`) connected to `DATABASE_URL` (Neon Postgres).
   - Scopes all tables inside a dedicated Postgres schema (`process.env.DB_SCHEMA || "si_combined"`, validated against `/^[a-z_][a-z0-9_]{1,40}$/`) via connection `connection: { search_path: schema }` and idempotent bootstrap (`CREATE SCHEMA IF NOT EXISTS ...`).
   - Guarantees **zero interference** with Build A (`public` or separate DB) and Build B (`public` tables on this chat's Neon DB).
4. **Dual-Layer Significance + 3-Tier AI Gateway Cascade (`lib/analysis.ts`, `lib/assess.ts`):**
   - **Layer 1 (Always-on, $0, deterministic):** `analyzeStory()` computes a `0–100` significance score with itemized factor points (`Evidence`, `Coverage`, `Kind of update`, `Benchmarks`, `Frontier signals`, `Capability areas`, `Watched researchers`) plus `inScope` boolean and human-readable `scopeReason`.
   - **Layer 2 (3-Tier Assessment Cascade via AI SDK 6 + Vercel AI Gateway):**
     - `JUDGE=off`: relies on deterministic `inScope` + `significance` (mapped to `1.0–10.0` baseline when needed) so the site works at full strength with zero external model calls.
     - `JUDGE=fixtures`: deterministic test judge for reproducible CI/acceptance runs.
     - `JUDGE=gateway` (default when `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is present):
       - `Tier 0`: deterministic ontology + scope check settles clear high-confidence stories (`>= 2` grounded spec topics + strong signal, or hard reject) for $0.
       - `Tier 1`: `google/gemini-2.5-flash-lite` via AI SDK 6 `generateText` + `Output.object` for borderline/single-topic items.
       - `Tier 2`: `openai/gpt-5.4-mini` via AI SDK 6 `generateText` + `Output.object` only when Tier 1 confidence `< 0.75` or disagrees with grounded topics.
5. **Security & Ownership Hardening (`lib/auth.ts`, `lib/guards.ts`, `next.config.ts`):**
   - Passwords hashed with `scrypt` (`N=16384, r=8, p=1`, 16-byte random salt, `timingSafeEqual`).
   - Unknown-username sign-in executes a dummy `hashPassword` to prevent timing enumeration.
   - Session tokens are 32-byte CSPRNG values stored only as `SHA-256` hex digests in `sessions.token_hash`.
   - Vote/save endpoints inspect `formData` / JSON body for any foreign `userId` parameter: if present and `!== session.user.id`, they immediately return `403 Forbidden` (`AT-12` explicit refusal); otherwise they toggle strictly on `session.user.id`.
   - Per-IP sliding-window rate limiter + honeypot check on `/api/auth/*`, safe relative `returnTo` validation, and baseline response security headers in `next.config.ts`.
6. **UI Architecture (`app/` & `components/`):**
   - Tri-theme (`light` / `dark` / `tactical`) persisted via cookie/localStorage with CSS custom properties (`app/globals.css`) and subtle house gold (`#C8973A` dark/tactical, `#9A6F18` light) reserved strictly for brand mark and primary CTAs.
   - Shared `SiteShell` header (Brand, Feed, Brief, Sources, How Chosen `/review`, Saved, Theme cycle, Sign in / Sign up).
   - `FeedToolbar` with URL-synced Topic Pills (all 9 canonical spec topics with story counts), Search input, Sort selector (`Newest`, `Significance`, `Most Covered`, `Most Voted`), Curation mode (`Curated Top`, `All In-Scope`), 4 one-click Named Presets, `Reset`, `Copy link`, and `JSON / Atom` links.
   - Semantic `<article class="story" data-story-id="..." data-published="...">` cards preserving exact class hooks (`.topics li`, `.matched`, `.sources li`, `.summary`, `h2 a`) so both human readers and automated bake-off / Playwright suites inspect them cleanly.

---

## 2. File Map (`builds/combined/`)

```text
builds/combined/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.json
├── db/
│   ├── schema.sql
│   ├── migrate.mjs
│   └── seed-curated.mjs
├── lib/
│   ├── schemas.ts          # Zod 4 domain schemas, URL state & presets
│   ├── ontology-data.ts    # Unified 9 spec roots + 19 subtopics + orgs + benchmarks + people + disambiguation rules
│   ├── ontology.ts         # Matcher, child->parent rollup, context-aware scope gate, query expansion
│   ├── analysis.ts         # Deterministic 0-100 significance engine + benchmark score extraction
│   ├── assess.ts           # 3-tier AI SDK 6 + Vercel AI Gateway judge cascade + fixture mode
│   ├── text.ts             # HTML->plain text sanitizer, URL/title/arXiv/DOI normalizers, Twitter/X blocker
│   ├── sources-data.ts     # 22 curated public sources across 7 kinds + provenance metadata
│   ├── feeds.ts            # Fault-isolated RSS/Atom/JSON/GraphQL parser + outlet extraction
│   ├── db.ts               # Neon Postgres client scoped to isolated `si_combined` schema
│   ├── ingest.ts           # Transactional deduplication (`arxiv:` > `doi:` > `url:` > `title:`) + tagging + scoring
│   ├── history.ts          # Resumable 2023-present archive backfill tasks (`history_progress`)
│   ├── auth.ts             # scrypt, timing-safe login, SHA-256 session cookies
│   ├── guards.ts           # Rate limiter, honeypot check, reserved usernames, safe redirects
│   ├── interactions.ts     # Strict session-owned votes & saves + explicit cross-user 403 refusal
│   ├── stories.ts          # Feed queries, story detail provenance, weekly brief, review ledger, exports
│   └── sample-seed.ts      # Synthetic sample dataset ("Sample" labelled) + curated realistic bootstrap
├── components/
│   ├── site-header.tsx
│   ├── theme-toggle.tsx
│   ├── feed-toolbar.tsx
│   ├── story-card.tsx
│   └── auth-form.tsx
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                        # Main Superintelligence Feed + Topic Filters + Presets
│   ├── stories/[id]/page.tsx           # Story Provenance, Coverage Lag & Significance Trail
│   ├── brief/page.tsx                  # Executive Weekly Intelligence Brief
│   ├── sources/page.tsx                # Source Health, Provenance Badges & OPML
│   ├── review/page.tsx                 # Public Judge & Scope Audit Ledger + 2023 History Progress
│   ├── saved/page.tsx                  # Signed-in User's Saved Stories + JSON/CSV Export
│   ├── signin/page.tsx                 # Sign In
│   ├── signup/page.tsx                 # Sign Up
│   └── api/
│       ├── auth/signup/route.ts
│       ├── auth/signin/route.ts
│       ├── auth/signout/route.ts
│       ├── stories/route.ts            # Machine-readable JSON twin of filtered feed
│       ├── stories/[id]/vote/route.ts  # Form + JSON vote toggle with cross-user 403 guard
│       ├── stories/[id]/save/route.ts  # Form + JSON save toggle with cross-user 403 guard
│       ├── brief/route.ts              # Validated JSON brief spec
│       ├── feed.atom/route.ts          # Atom 1.0 syndication feed (per topic or full)
│       ├── sources.opml/route.ts       # OPML 2.0 export of active sources
│       ├── export/route.ts             # Authenticated user saves export (JSON / CSV)
│       └── cron/
│           ├── fetch/route.ts          # Scheduled multi-source harvest + tier assessment
│           └── history/route.ts        # Resumable 2023-present archive backfill step
└── tests/
    └── unit/
        ├── ontology-and-scope.test.ts  # Canonical phrases, rollup, and false-positive disambiguation
        ├── analysis-and-text.test.ts   # 0-100 significance, benchmark scores, XSS stripping, Twitter/X block
        ├── feeds-and-dedup.test.ts     # RSS/Atom parsing, arXiv/DOI/URL/title grouping
        └── db-e2e-contract.test.ts     # Full AT-01..AT-15 + AT-C1..AT-C4 against isolated Postgres test schema
```
