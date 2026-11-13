# Research: Build A (Matt) — Superintelligence Homepage

Phase 0 output of `/speckit-plan`. Each decision resolves an open question in the plan's
Technical Context. Versions were checked against the npm registry on 2026-11-13.

## 1. Framework and language

- **Decision:** Next.js 16 (App Router) with React 19 and TypeScript 5.9, in `builds/matt/`.
- **Rationale:** Matt's chosen stack. Next.js is Vercel's native framework, so a monorepo
  subfolder deploys by setting the Vercel project's Root Directory to `builds/matt`. Server
  components render the feed on the server, so pages work without client JavaScript, which
  also helps keyboard and screen-reader access (REQ-023).
- **Alternatives considered:** TypeScript 7 is the newest major release, but Next.js tooling is
  proven on 5.x; 5.9 avoids an early-adopter risk for no benefit (constitution II).

## 2. Scheduled fetching on the free plan

- **Finding:** Vercel's free Hobby plan only allows cron jobs that run **once per day**. A
  30-minute schedule (`*/30 * * * *`) fails at deploy time ("Hobby accounts are limited to daily
  cron jobs"). Source: Vercel docs, Cron Jobs → Usage & Pricing.
- **Decision:** Two triggers, one fetch routine:
  1. A **daily** Vercel Cron Job calls `GET /api/cron/fetch` (meets REQ-001's "on a schedule").
  2. **Refresh on visit:** when the feed page loads and the last successful fetch is more than
     30 minutes old, the page starts a fetch in the background after the response is sent
     (Next.js `after()`), so readers see fresh stories without waiting.
- **Rationale:** keeps the 30-minute freshness Matt asked for while staying on the free tier
  (constitution, Bake-off Rules: $10 cap, free tiers). A simple lock (a `fetch_runs` row) stops
  two visits from fetching at once.
- **Alternatives considered:** Vercel Pro ($20/month, breaks the $10 cap); an outside cron
  service such as GitHub Actions (another moving part and a secret to manage).

## 3. Database access

- **Decision:** Neon Postgres via `@neondatabase/serverless` 1.2 (HTTP driver), with plain SQL
  queries. Schema lives in one `schema.sql` file applied by a small `npm run db:migrate` script.
  Build A gets its own Neon database (contract, Section 3; risk R13).
- **Rationale:** one dependency, no ORM, works in Vercel Functions without connection pooling
  setup (constitution II).
- **Alternatives considered:** Prisma or Drizzle (extra tooling and a generate step); `pg`
  (needs connection pooling in serverless).

## 4. Ownership and row-level security (R3)

- **Decision:** Enforce ownership in every write query: the user ID always comes from the
  session, never from the request body (`DELETE FROM votes WHERE user_id = $sessionUser AND
  story_id = $story`). No RLS for now.
- **Rationale:** the spec makes RLS recommended, not required (R3). The app connects to Neon as
  a single database role, so RLS would need per-request role switching for little gain on a
  class site. REQ-016 is still enforced on the server and checked by AT-12.
- **Alternatives considered:** Postgres RLS with `SET LOCAL app.user_id` per transaction
  (revisit after M2 if time allows).

## 5. Sign-in

- **Decision:** Passwords hashed with Node's built-in `crypto.scrypt` (random 16-byte salt).
  Sessions are random 32-byte tokens; only a SHA-256 hash of the token is stored. The cookie is
  `httpOnly`, `Secure`, `SameSite=Lax`, and lasts 30 days (REQ-010).
- **Rationale:** no auth library or third-party service (Matt's direction); built-in crypto
  covers REQ-011 with zero dependencies.
- **Rules:** usernames 3–30 characters (letters, numbers, `_`, `-`), unique ignoring case;
  passwords at least 8 characters. Sign-in errors never say whether the username exists (User
  Story 2, scenario 4). Slowing repeated failed sign-ins is deferred (R2).

## 6. Feed parsing

- **Decision:** `fast-xml-parser` 5.12 to read RSS 2.0 and Atom. Each fetch has a 10-second
  timeout, and sources are fetched in parallel; a failing source is recorded and skipped
  (REQ-008).
- **Rationale:** one small dependency with no native code; handles both feed formats.
- **Alternatives considered:** `rss-parser` (pulls in more dependencies).

## 7. Deciding what counts as superintelligence (REQ-003, REQ-005)

- **Decision:** The topic and key phrase table in the spec is copied into one TypeScript file
  (`lib/topics.ts`). An item's title and summary are lowercased, and a key phrase matches only as
  **whole words** (for example, "AGI" matches "AGI timelines" but not "magic"). Items that match
  no topic are dropped before they're stored.
- **Open point for the spec:** REQ-003 says an item "contains" a key phrase. Plain substring
  matching would let "AGI" match "magic" and "Imagine", flooding the feed. Whole-word matching
  is the sensible reading, but both builds must make the same call, so this should be written
  into the spec (a clarification both partners approve).

## 8. Plain-text feed content (REQ-021) and article text (REQ-007)

- **Decision:** At ingest, summaries are converted from HTML to plain text (tags removed,
  entities decoded) and cut to 300 characters. Pages render all feed text through React's
  default text escaping; `dangerouslySetInnerHTML` is never used.
- **Open point for the contract:** AT-15 expects script and image tags to "appear as plain
  text." Stripping tags at ingest means they don't appear at all, though nothing runs or loads.
  Showing raw tags would make every real summary (most contain HTML) unreadable. Suggest
  rewording AT-15's expected result to: "Nothing runs or loads, and the summary shows as
  readable text."

## 9. Grouping duplicates (REQ-004)

- **Decision:** Each item gets up to three keys, checked in order: an arXiv ID found in its link
  (`arxiv:2411.01234`), its normalized URL (lowercased host, no `www.`, no tracking parameters, no
  trailing slash), and its normalized title (lowercase, punctuation removed). If any key already
  belongs to a story, the item joins that story as another source.

## 10. Twitter/X (REQ-006)

- **Decision:** Drop any item whose link host is `twitter.com`, `x.com` or `t.co` (including
  subdomains). Summaries are plain text, so any Twitter/X URL inside them is never a clickable link.

## 11. Sources (REQ-001)

- **Decision:** Start with about 10 sources across 6 kinds, listed in `lib/sources.ts`:
  research papers (arXiv), frontier lab blogs, alignment and safety groups, forecasting and
  research organizations, forums (Alignment Forum, LessWrong), and newsletters.
- **Note:** Each feed URL is checked during implementation (a task), and any that don't work are
  swapped for another source of the same kind. At least 8 working sources across 5 kinds is the
  bar (AT-01).

## 12. Testing

- **Decision:** Playwright 1.65 acceptance tests in `builds/matt/tests/acceptance/`, one file per
  user story, with a `describe` block per requirement ID (constitution III–IV). Tests run against
  `next dev` with a local static server for the saved sample feeds in `tests/fixtures/`
  (including an off-topic item, a Twitter/X item, a script-tag item, and one source that never
  answers). A separate Neon test database keeps test data off the live site.
- **Note:** At milestones the same tests run against the deployed URL (`BASE_URL`). Running them
  automatically on every change is deferred until after the Nov 18 CI/CD class (contract,
  Section 4).

## 13. Styling and accessibility (REQ-018, REQ-023)

- **Decision:** One plain CSS file, mobile-first, no UI framework. Every control is a real link,
  button or form field, so it works with the keyboard; focus outlines stay visible. The "not
  investment advice" notice (REQ-022) lives in the shared page layout so it appears on every page.
