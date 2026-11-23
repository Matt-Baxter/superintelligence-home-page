# Tasks: Combined Superintelligence Homepage (`builds/combined/`)

**Spec:** `specs/002-combined-superintelligence-homepage/spec.md`  
**Plan:** `specs/002-combined-superintelligence-homepage/plan.md`

---

## Phase 1: Specification & Foundation

- [x] T001 Audit Build A (`builds/matt/`) and Build B (`builds/john/`) + bake-off evidence into `specs/002-combined-superintelligence-homepage/gap-matrix.md` per Constitution I–VI
- [x] T002 Author unified specification, architecture plan, and traceable task list in `specs/002-combined-superintelligence-homepage/{spec.md,plan.md,tasks.md}` per REQ-001..REQ-020, REQ-C01..REQ-C10
- [ ] T003 Scaffold `builds/combined/` (`package.json`, `tsconfig.json`, `next.config.ts` with security headers, `vercel.json`) and install dependencies (`next`, `react`, `react-dom`, `postgres`, `fast-xml-parser`, `zod`, `ai`) per REQ-018, REQ-C09
- [ ] T004 Create isolated Postgres schema `db/schema.sql`, `db/migrate.mjs`, and `lib/db.ts` (`si_combined` default schema) per REQ-009..REQ-016

## Phase 2: Ontology, Scope Disambiguation, Significance & 3-Tier Assessment

- [ ] T005 Implement Zod schemas, URL workspace state, and named presets in `lib/schemas.ts` per REQ-017, REQ-C08
- [ ] T006 Implement unified 9-root + 19-subtopic ontology, organizations, benchmarks, researcher watchlist, and context-disambiguated scope gate in `lib/ontology-data.ts` and `lib/ontology.ts` per REQ-003, REQ-005, REQ-C01 (AT-02, AT-04, AT-C1, AT-C2)
- [ ] T007 Implement plain-text sanitizer, Twitter/X blocker, and canonical identity normalizers (`arxiv`, `doi`, `url`, `title`) in `lib/text.ts` per REQ-004, REQ-006, REQ-007 (AT-03, AT-05, AT-15)
- [ ] T008 Implement deterministic 0–100 explainable significance engine and benchmark score extractor in `lib/analysis.ts` per REQ-C02
- [ ] T009 Implement 3-tier AI SDK 6 + Vercel AI Gateway assessment cascade (`tier 0` rules → `tier 1` fast model → `tier 2` arbiter + `fixtures` mode) in `lib/assess.ts` per REQ-C02

## Phase 3: Multi-Source Ingest, 2023+ Archive Backfill, Auth & Ownership APIs

- [ ] T010 Implement 22-source catalog + provenance labels (`lib/sources-data.ts`), fault-isolated RSS/Atom parser (`lib/feeds.ts`), transactional deduplicating ingest (`lib/ingest.ts`), and resumable 2023+ archive backfill (`lib/history.ts`) per REQ-001..REQ-008, REQ-C04, REQ-C07 (AT-01..AT-06)
- [ ] T011 Implement `scrypt` password hashing, constant-time anti-enumeration login, `SHA-256` session cookies (`lib/auth.ts`), rate-limit/honeypot/reserved guards (`lib/guards.ts`), and strict session-scoped votes/saves with cross-user `403` refusal (`lib/interactions.ts`) per REQ-009..REQ-016, REQ-C09 (AT-07..AT-12)
- [ ] T012 Implement query layer (`lib/stories.ts`) for filtered feed, story provenance detail, weekly brief synthesis, `/review` audit ledger, Atom 1.0, OPML 2.0, and user JSON/CSV export per REQ-002, REQ-014, REQ-017, REQ-C03, REQ-C05..REQ-C08
- [ ] T013 Implement API Route Handlers (`/api/auth/*`, `/api/stories`, `/api/stories/[id]/vote`, `/api/stories/[id]/save`, `/api/brief`, `/api/feed.atom`, `/api/sources.opml`, `/api/export`, `/api/cron/fetch`, `/api/cron/history`) per REQ-001..REQ-017, REQ-C06..REQ-C09

## Phase 4: Tri-Theme Editorial UI & Pages

- [ ] T014 Implement tri-theme CSS (`light` / `dark` / `tactical` subtle-gold) in `app/globals.css` and shared components (`site-header.tsx`, `theme-toggle.tsx`, `feed-toolbar.tsx`, `story-card.tsx`, `auth-form.tsx`) per REQ-002, REQ-005, REQ-017, REQ-018, REQ-C08, REQ-C10
- [ ] T015 Implement App Router pages: `/` (`app/page.tsx`), `/stories/[id]` (`app/stories/[id]/page.tsx`), `/brief` (`app/brief/page.tsx`), `/sources` (`app/sources/page.tsx`), `/review` (`app/review/page.tsx`), `/saved` (`app/saved/page.tsx`), `/signin`, and `/signup` per REQ-002..REQ-018, REQ-C03..REQ-C10

## Phase 5: Verification, Live Data Seed & Browser Audit

- [ ] T016 Write and run unit + Postgres end-to-end contract tests (`AT-01`..`AT-15`, `AT-C1`..`AT-C4`) in `tests/unit/*.test.ts` per Constitution IV & SC-008
- [ ] T017 Migrate `si_combined` on Neon, harvest live superintelligence feeds (with curated fallback if any upstream feed rate-limits), run typecheck + production build check, start preview server, and verify desktop + `390x844` mobile in `agent-browser` per REQ-018, SC-C01..SC-C03
