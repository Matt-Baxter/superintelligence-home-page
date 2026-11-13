# Implementation Plan: Superintelligence Homepage — Build A (Matt)

**Branch**: `claude/youthful-fermat-iyku15` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md) (v1.3)

**Input**: Feature specification from `specs/001-superintelligence-homepage/spec.md`

**Scope of this plan**: Build A of the bake-off, owned by Matt and built with Claude Code. John's
Build B (v0) is planned separately and does not use this file. All application code lives in
`builds/matt/` (working agreement, Repo workflow).

The prompt that produced this plan is recorded in [`docs/speckit-prompts.md`](../../docs/speckit-prompts.md), section 4.

## Summary

A small Next.js app on Vercel that pulls items from about 10 public superintelligence sources,
keeps only items whose title or summary contains one of the spec's key phrases, groups
duplicates into one story, and shows a newest-first feed with each story's topics and matched
words. Users sign up with a username and password, then vote on and save stories, which are
stored per user in Neon Postgres. Feeds are fetched once a day by a Vercel Cron Job, the most often
Vercel's free plan allows ([research §2](research.md#2-scheduled-fetching-on-the-free-plan)).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22 (Vercel runtime)

**Primary Dependencies**: Next.js 16 (App Router), React 19, `postgres` 4.1,
`fast-xml-parser` 5.12. Dev only: `@playwright/test` 1.65, `typescript`, `@types/node`,
`@types/react`. Password hashing and session tokens use Node's built-in `crypto`.

**Storage**: Neon Postgres for the live site, a separate database for Build A; a throwaway local
Postgres 16 database for development and tests ([data-model.md](data-model.md), [research §3](research.md#3-database-access))

**Testing**: Playwright acceptance tests organized by requirement ID, against saved sample feeds
served locally ([research §12](research.md#12-testing))

**Target Platform**: Vercel (Hobby, free tier); modern desktop and mobile browsers

**Project Type**: Web application (one Next.js project: server-rendered pages plus a few route
handlers)

**Performance Goals**: Feed page loads in under 2 seconds on a normal connection (supports
SC-001); a full fetch of all sources finishes within 30 seconds

**Constraints**: Free tiers only, within the shared $10/month cap; daily cron limit on Vercel
Hobby; no third-party auth; no UI framework; feed text shown as plain text only (REQ-021)

**Scale/Scope**: A class-sized audience (tens of users), about 10 sources, a few hundred stories;
5 pages and 6 endpoints ([contracts/build-a-interface.md](contracts/build-a-interface.md))

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How this plan complies | Status |
|-----------|------------------------|--------|
| I. Superintelligence Focus | Items are kept only if they match a key phrase from the spec's fixed topic list (REQ-003); each story shows its matched words (REQ-005); weak or off-topic items are dropped before storage. | Pass |
| II. Simplicity First | One Next.js project; 4 runtime dependencies; plain SQL instead of an ORM; built-in crypto instead of an auth library; HTML forms instead of a client-side API layer; no RLS (recommended, not required; research §4). | Pass |
| III. Spec First and Traceable | Every page and endpoint in the interface contract lists its REQ IDs; tasks and tests will name REQ IDs. | Pass |
| IV. Test What the Spec Says | Playwright tests grouped by REQ ID, mapped to contract tests AT-01 to AT-17, using synthetic sample feeds and made-up users. | Pass |
| V. Accounts and Data Are Safe | scrypt password hashes; hashed session tokens in httpOnly cookies; user always taken from the session (REQ-016); only a username stored; secrets only in Vercel settings and git-ignored `.env.local`. | Pass |
| VI. Open Sources Only | Public feeds only; Twitter/X items dropped (REQ-006); summaries cut to 300 characters and every story links out (REQ-007). | Pass |
| Bake-off Rules | Build A's own folder, Vercel project and Neon database; stack recorded here, not in the constitution; free tiers only. | Pass |

**Re-check after Phase 1 design**: Pass. The design adds no services or dependencies beyond those
above. Two wording clarifications came up during research and have been made (see Decisions made during planning).

## Decisions made during planning

1. **Whole-word matching.** REQ-003 now says key phrases match as whole words, so "AGI" doesn't
   match "magic" (spec v1.3). ([research §7](research.md#7-deciding-what-counts-as-superintelligence-req-003-req-005))
2. **AT-15 wording.** Build A strips HTML from summaries, so AT-15 now expects that nothing runs
   or loads and the summary shows as readable text (contract v1.4).
   ([research §8](research.md#8-plain-text-feed-content-req-021-and-article-text-req-007))
3. **Fetch timing.** Vercel's free plan only allows a daily cron job, so Build A fetches once a
   day, which Matt approved. John's build will hit the same limit.

## Project Structure

### Documentation (this feature)

```text
specs/001-superintelligence-homepage/
├── spec.md              # Shared bake-off spec (both builds)
├── plan.md              # This file: Build A plan (/speckit-plan)
├── research.md          # Build A Phase 0 decisions
├── data-model.md        # Build A Phase 1 schema
├── quickstart.md        # Build A run and validation guide
├── contracts/
│   └── build-a-interface.md   # Build A pages and endpoints
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Build A tasks (/speckit-tasks; not created yet)
```

### Source Code

```text
builds/matt/
├── app/
│   ├── layout.tsx                 # Header, sign-in state, investment notice (REQ-022)
│   ├── page.tsx                   # Feed and topic filter (REQ-002, REQ-017)
│   ├── saved/page.tsx             # Saved stories (REQ-014)
│   ├── signin/page.tsx
│   ├── signup/page.tsx
│   ├── globals.css                # Plain, mobile-first CSS (REQ-018, REQ-023)
│   └── api/
│       ├── auth/signup/route.ts
│       ├── auth/signin/route.ts
│       ├── auth/signout/route.ts
│       ├── stories/[id]/vote/route.ts
│       ├── stories/[id]/save/route.ts
│       └── cron/fetch/route.ts
├── lib/
│   ├── db.ts                      # Postgres client (Neon live, local for tests)
│   ├── auth.ts                    # scrypt hashing, sessions, current user
│   ├── sources.ts                 # Source list (REQ-001)
│   ├── topics.ts                  # Topics and key phrases from the spec (REQ-003, REQ-005)
│   ├── ingest.ts                  # Fetch, parse, filter, group, store (REQ-001 to REQ-008, REQ-021)
│   └── text.ts                    # HTML to plain text, URL and title normalizing
├── db/
│   ├── schema.sql
│   └── migrate.mjs
├── tests/
│   ├── fixtures/                  # Saved sample feeds and sources list for SOURCES=fixtures
│   └── acceptance/                # One file per user story, describe() per REQ ID
├── vercel.json                    # Daily cron for /api/cron/fetch
├── playwright.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

**Structure Decision**: One Next.js project in `builds/matt/`, since pages and endpoints deploy
together on Vercel and the app is small. The Vercel project's Root Directory is `builds/matt`, so
nothing outside that folder is deployed for Build A.

## Complexity Tracking

No constitution violations and no extra moving parts to justify.
