---
description: "Task list for Build A (Matt) of the Superintelligence Homepage bake-off"
---

# Tasks: Superintelligence Homepage — Build A (Matt)

**Input**: Design documents from `specs/001-superintelligence-homepage/` (spec v1.3, plan, research,
data-model, contracts/build-a-interface.md, quickstart)

**Tests**: Requested. For each user story, the Playwright acceptance tests come first, grouped by
REQ ID (one `test.describe('REQ-0NN: …')` block per requirement) and labelled with the contract's
AT numbers. Write them, confirm they fail, then write the code that makes them pass
(constitution IV).

**Paths**: All application code lives in `builds/matt/`. Paths below are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[US1]–[US4]**: the spec's user stories
- **MANUAL (Matt)**: only a human can do this step (creating databases, Vercel setup, secrets,
  deploying). Agents never handle secrets or deploy (working agreement, Agent rules).
- Every task names the requirement IDs it satisfies (constitution III).

## Milestones

- **M2 (Nov 18): both builds live** → Phases 1–4 plus the deploy checkpoint. Must pass AT-01 to
  AT-09 and AT-15.
- **M3 (Nov 22): both builds complete** → Phases 5–8. All of AT-01 to AT-17 (AT-14 is checked by a
  classmate).

---

## Phase 1: Setup

**Purpose**: An empty Next.js project in `builds/matt/` that builds and runs.

- [X] T001 Create `builds/matt/package.json` with name `si-home-build-a`, `"private": true`, `"engines": { "node": ">=22" }`, dependencies `next@16.4.6`, `react@19.3.1`, `react-dom@19.3.1`, `postgres@4.1.1`, `fast-xml-parser@5.12.0`, dev dependencies `typescript@5.9.3`, `@types/node`, `@types/react`, `@playwright/test@1.65.0`, and scripts `dev`, `build` (`node db/migrate.mjs && next build`, so each Vercel deploy applies the schema), `start`, `db:migrate` (`node db/migrate.mjs`), `test:acceptance` (`playwright test`) (plan, Technical Context)
- [X] T002 [P] Create `builds/matt/tsconfig.json` (strict mode, `@/*` path alias to the project root) and `builds/matt/next.config.ts` with no extra options
- [X] T003 [P] Create `builds/matt/.env.example` listing `DATABASE_URL`, `CRON_SECRET` and `SOURCES` with one-line comments and no values; confirm the repo's `.gitignore` already ignores `.env` and `.env.*` but not `.env.example` (constitution V)
- [X] T004 [P] Create `builds/matt/.gitignore` for `node_modules/`, `.next/`, `test-results/`, `playwright-report/`
- [X] T005 Run `npm install` in `builds/matt/` and commit the resulting `package-lock.json`
- [X] T006 Set up a throwaway local Postgres 16 test database (fake data only) and put its local connection string in `builds/matt/.env.local` as `DATABASE_URL`, with `CRON_SECRET=test-secret`. The live Neon database is created later by Matt (T036). (research §3)

---

## Phase 2: Foundational (blocks every user story)

**Purpose**: Database, shared helpers, topic rules, sources and sample feeds.

- [X] T007 Create `builds/matt/db/schema.sql` with every table in `data-model.md`, using `CREATE TABLE IF NOT EXISTS`. Quote the rules exactly: `users.username` "3–30 characters: letters, numbers, `_`, `-`; unique ignoring case" (a unique index on `lower(username)`); `sessions.token_hash` "SHA-256 of the cookie's random token"; `sources.kind` "one of: `papers`, `frontier-lab`, `safety-group`, `research-org`, `forum`, `newsletter`" (a CHECK constraint); `stories.summary` "plain text, at most 300 characters"; `votes` and `saves` primary key `(user_id, story_id)`; `story_topics` primary key `(story_id, topic_id)` with `matched text[]`; `story_sources` primary key `(story_id, source_id)`; `story_keys.key` primary key; all foreign keys `ON DELETE CASCADE` (REQ-004, REQ-009, REQ-011 to REQ-016)
- [X] T008 Create `builds/matt/db/migrate.mjs`: reads `DATABASE_URL`, applies `db/schema.sql`, then upserts every source from `lib/sources.ts` (via a small exported JSON or by importing the compiled list) into `sources`; safe to run more than once
- [X] T009 [P] Create `builds/matt/lib/db.ts` exporting a `sql` tagged-template client from the `postgres` package using `process.env.DATABASE_URL` (SSL required when the URL is not local; at most 5 connections); queries must use parameters, never string concatenation
- [X] T010 [P] Create `builds/matt/lib/topics.ts` with the 9 topics and their key phrases copied exactly from the spec table "Superintelligence topics and key phrases", each with an `id` (e.g. `capabilities-agi`, `automating-ai-research`, `recursive-self-improvement`, `alignment`, `interpretability`, `safety-risk`, `forecasting-timelines`, `compute-scaling`, `governance-policy`) and `label`; export `matchTopics(text): { id, label, matched: string[] }[]` that matches key phrases case-insensitively **as whole words** (so "AGI" matches "AGI timelines" but not "magic"; "align" does not match "alignment") (REQ-003, REQ-005)
- [X] T011 [P] Create `builds/matt/lib/text.ts` exporting `htmlToText(html)` (remove tags, decode entities, collapse whitespace), `truncate(text, 300)`, `normalizeUrl(url)` (lowercase host, drop `www.`, drop `utm_*` and other tracking parameters, drop trailing slash), `normalizeTitle(title)` (lowercase, remove punctuation, collapse spaces), `arxivId(url)` (returns e.g. `2411.01234` from abs/pdf links, without version suffix), and `isTwitterUrl(url)` (host is `twitter.com`, `x.com` or `t.co`, including subdomains) (REQ-004, REQ-006, REQ-007, REQ-021)
- [X] T012 [P] Create `builds/matt/lib/sources.ts` with about 10 sources across the 6 kinds in `data-model.md` (`id`, `name`, `kind`, `feedUrl`): arXiv (papers), at least one frontier lab research or safety blog, at least one alignment/safety group (e.g. MIRI), at least one forecasting/research org (e.g. Epoch AI, AI Impacts), the Alignment Forum and LessWrong (forums), and at least one newsletter (e.g. Import AI). When `process.env.SOURCES === 'fixtures'`, export the list from `tests/fixtures/sources.json` instead (REQ-001)
- [X] T013 Check every feed URL in `builds/matt/lib/sources.ts` by fetching it and confirming it returns RSS or Atom with recent items; replace any that fail with another source of the same kind, keeping **at least 8 working sources across at least 5 kinds**; record the result (source, URL, OK or replaced) in a comment block at the top of the file (REQ-001; research §11)
- [X] T014 [P] Create saved sample feeds in `builds/matt/tests/fixtures/feeds/` and the list `builds/matt/tests/fixtures/sources.json` (all URLs on `http://localhost:4100/feeds/…`): 8 on-topic sources across 5 kinds, each with at least one dated superintelligence item; one off-topic item about "a new AI photo-editing app" with no key phrase (AT-02); the same arXiv paper in three sources (AT-03); an item whose summary says "AGI timelines" (AT-04); an item linking to `https://x.com/…` (AT-05); an item whose summary contains `<script>alert(1)</script>` and `<img src="http://localhost:4100/pixel.png">` (AT-15); plus a ninth source whose URL points to a port nothing listens on (AT-06). Label every record "Sample" in its title (constitution IV)
- [X] T015 [P] Create `builds/matt/tests/fixtures/serve.mjs`: a tiny Node `http` static server for `tests/fixtures/` on port 4100 that also logs any request for `/pixel.png` to a file `tests/fixtures/pixel-hits.log` (used to prove nothing loads in AT-15)
- [X] T016 Create `builds/matt/playwright.config.ts`: one Chromium project, `baseURL` from `BASE_URL` or `http://localhost:3000`; when `BASE_URL` is not set, two `webServer` entries: `node tests/fixtures/serve.mjs` and `next dev` with `SOURCES=fixtures` and `CRON_SECRET=test-secret`
- [X] T017 Create `builds/matt/tests/acceptance/helpers.ts` exporting `resetDatabase()` (truncates every table, including `sources` so no real sources linger in the test database, then reloads the sample sources), `runFetch(request)` (calls `GET /api/cron/fetch` with `Authorization: Bearer test-secret`), and `signUp(page, username, password)`; tests use only made-up usernames
- [X] T018 Create `builds/matt/app/layout.tsx` (HTML shell, site title "Superintelligence Homepage", a `<header>` and `<main>`) and `builds/matt/app/globals.css` (readable mobile-first base styles, no UI framework) (REQ-018)

**Checkpoint**: `npm run db:migrate` and `npm run dev` work; the home page renders an empty shell.

---

## Phase 3: User Story 1 — Read a superintelligence feed (P1) 🎯 MVP

**Goal**: Visitors see a newest-first feed of superintelligence stories only, grouped across
sources, each with topics, matched words and a link to the original.

**Independent Test**: With `SOURCES=fixtures`, run a fetch and open `/`: only on-topic sample
items appear, the duplicate paper is one story with three sources, each story shows topics and
matched words, and nothing from the script-tag item runs.

### Tests for User Story 1 (write first; they must fail)

- [X] T019 [US1] Create `builds/matt/tests/acceptance/us1-feed.spec.ts` with `beforeEach` calling `resetDatabase()` and `runFetch()`, and these blocks: `REQ-001 / REQ-002 (AT-01)` stories from all 8 working sample sources appear, newest first; `REQ-003 (AT-02)` the AI photo-editing item is absent; `REQ-004 (AT-03)` the shared arXiv paper appears once listing three sources; `REQ-005 (AT-04)` the "AGI timelines" story shows "Forecasting & timelines" and the matched words "AGI timelines"; `REQ-006 (AT-05)` the Twitter/X item is absent; `REQ-007` every story title links to its original URL and no summary exceeds 300 characters; `REQ-008 (AT-06)` the feed loads although the ninth source is unreachable; `REQ-021 (AT-15)` no dialog opens, `pixel-hits.log` stays empty, and the summary reads as plain text with no `<script>` or `<img>` elements in the story; plus the empty-feed message when no fetch has run (Edge Cases)

### Implementation for User Story 1

- [X] T020 [US1] Create `builds/matt/lib/feeds.ts` exporting `fetchFeed(url)`: fetches with a 10-second timeout, parses RSS 2.0 and Atom with `fast-xml-parser`, and returns items as `{ title, link, summary, published }`; throws a short, readable error on failure (REQ-001, REQ-008)
- [X] T021 [US1] Create `builds/matt/lib/ingest.ts` exporting `ingestItem(item, sourceId)`: drop if `isTwitterUrl(link)` (REQ-006); `summary = truncate(htmlToText(summary), 300)` and `title = htmlToText(title)` (REQ-007, REQ-021); `matchTopics(title + ' ' + summary)`, dropping the item if it matches nothing (REQ-003); build keys `arxiv:<id>`, `url:<normalized>`, `title:<normalized>` and, if any key exists in `story_keys`, add a `story_sources` row to that story, otherwise insert the story, its `story_topics` (with `matched`) and its keys (REQ-004, REQ-005)
- [X] T022 [US1] In `builds/matt/lib/ingest.ts`, export `fetchAll()`: fetch every source in parallel with `Promise.allSettled`, call `ingestItem` for each item, set `sources.last_ok_at` on success or `sources.last_error` (short message) on failure, and return `{ fetched, failed, stories }`; one failing source never stops the others (REQ-001, REQ-008)
- [X] T023 [US1] Create `builds/matt/app/api/cron/fetch/route.ts`: `GET` returns 401 unless the `Authorization` header equals `Bearer ${process.env.CRON_SECRET}`, otherwise runs `fetchAll()` and returns its JSON (contract: Scheduled endpoint; REQ-001)
- [X] T024 [P] [US1] Create `builds/matt/vercel.json` with one cron entry calling `/api/cron/fetch` once a day (e.g. `0 6 * * *`) (REQ-001; research §2)
- [X] T025 [US1] Create `builds/matt/lib/stories.ts` exporting `listStories({ page })`: newest first by `published_at`, 40 per page, each story with title, url, summary, sources (name, kind, url) and topics (label, matched) (REQ-002, REQ-004, REQ-005)
- [X] T026 [US1] Create `builds/matt/app/page.tsx` (server component) rendering `listStories()`: title as a link to the original, summary as text only (never `dangerouslySetInnerHTML`), the list of sources, and each topic with "matched: …"; show "No superintelligence stories yet. Check back soon." when empty (REQ-002, REQ-005, REQ-007, REQ-021)
- [X] T027 [US1] Run `npm run test:acceptance -- us1-feed` and fix until every US1 test passes

**Checkpoint**: User Story 1 works on its own (AT-01 to AT-06, AT-15).

---

## Phase 4: User Story 2 — Create an account and stay signed in (P1)

**Goal**: Visitors sign up with a username and password, stay signed in between visits, and can
sign out.

**Independent Test**: Sign up, close the browser, reopen, still signed in; sign out; a duplicate
username is refused; a wrong password gives the same message whether or not the user exists.

### Tests for User Story 2 (write first; they must fail)

- [ ] T028 [US2] Create `builds/matt/tests/acceptance/us2-accounts.spec.ts` with blocks: `REQ-009 (AT-07)` signing up with an unused username signs the user in and shows the username; `REQ-009 (AT-08)` a taken username (any letter case) shows "That username is taken." and no second account exists; `REQ-009` invalid usernames (under 3 or over 30 characters, or other characters) and passwords under 8 characters show a message naming the field; `REQ-010 (AT-09)` a new browser context restored from the saved cookies is still signed in, and the cookie expires about 30 days out; `REQ-010` sign-out ends the session; `US2 scenario 4` wrong password and unknown username both show "Username or password is incorrect."; `REQ-011` the stored `password_hash` is not the password and the password never appears in any page; `REQ-012` the `users` table has no columns besides id, username, password_hash, created_at

### Implementation for User Story 2

- [ ] T029 [US2] Create `builds/matt/lib/auth.ts`: `hashPassword` and `verifyPassword` with Node `crypto.scrypt` and a random 16-byte salt (timing-safe compare); `validateUsername` ("3–30 characters: letters, numbers, `_`, `-`") and `validatePassword` (at least 8 characters); `createSession(userId)` (random 32-byte token, store SHA-256 hash in `sessions` with `expires_at` 30 days ahead, set cookie `session` with `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` 30 days); `getCurrentUser()` (reads cookie, looks up unexpired session); `destroySession()` (REQ-009 to REQ-012)
- [ ] T030 [US2] Create `builds/matt/app/api/auth/signup/route.ts`: `POST` form with `username`, `password`; validate; insert user (case-insensitive uniqueness); on success create a session and 303 to `/`; on error 303 back to `/signup?error=…` with "That username is taken." or a message naming the invalid field; never create an account on error (REQ-009, contract: Form endpoints)
- [ ] T031 [US2] Create `builds/matt/app/api/auth/signin/route.ts`: `POST` form; on success create a session and 303 to `/`; otherwise 303 to `/signin?error=` with "Username or password is incorrect." for both unknown user and wrong password (REQ-010; US2 scenario 4)
- [ ] T032 [P] [US2] Create `builds/matt/app/api/auth/signout/route.ts`: `POST` destroys the session, clears the cookie, 303 to `/` (REQ-010)
- [ ] T033 [P] [US2] Create `builds/matt/app/signup/page.tsx` and `builds/matt/app/signin/page.tsx`: labelled username and password fields, a submit button, and the `error` message from the query string shown as text (REQ-009, REQ-010)
- [ ] T034 [US2] Update `builds/matt/app/layout.tsx` header: when signed in show the username, a "Saved" link and a sign-out form button; otherwise "Sign in" and "Sign up" links (REQ-010)
- [ ] T035 [US2] Run `npm run test:acceptance -- us2-accounts` and fix until every US2 test passes

**Checkpoint**: User Stories 1 and 2 both work (AT-01 to AT-09, AT-15). Ready for M2.

---

## M2 deploy checkpoint (Nov 18) — MANUAL (Matt)

- [ ] T036 **MANUAL (Matt)**: In Vercel, create a project for Build A from this repo with **Root Directory** `builds/matt`; in its **Storage** tab add a Neon database (separate from John's; this sets `DATABASE_URL`), and add a random `CRON_SECRET` in the environment settings (quickstart, Deploy; REQ-019)
- [ ] T037 **MANUAL (Matt)**: Deploy (the build applies the schema automatically); call `/api/cron/fetch` once with the secret to load stories (REQ-019)
- [ ] T038 **MANUAL (Matt)**: Run `BASE_URL=<live URL> npm run test:acceptance -- us1-feed us2-accounts` (the fixture-dependent checks AT-02 to AT-06 and AT-15 stay local-only); record the results for the contract's AT table and note the live URL in `builds/matt/README.md`

---

## Phase 5: User Story 3 — Vote on and save stories (P2)

**Goal**: Signed-in readers vote (once per story) and save stories; both persist per user and
only the owner can change them.

**Independent Test**: Two test users vote and save, sign out and back in; each sees only their
own saves, vote totals count both, and a hand-crafted request can't change the other user's data.

### Tests for User Story 3 (write first; they must fail)

- [ ] T039 [US3] Create `builds/matt/tests/acceptance/us3-votes-saves.spec.ts` with blocks: `REQ-013` voting raises the count by one and shows "voted"; voting again removes it; `REQ-013 / REQ-015 (AT-10)` user A's vote survives sign-out and sign-in; `REQ-014 / REQ-015 (AT-11)` users A and B each see only their own saved stories on `/saved`; `REQ-016 (AT-12)` signed in as A, a direct `POST` to B's voted story with an added `userId` field for B leaves B's vote unchanged; signed-out vote or save redirects to `/signin` and records nothing (US3 scenario 5); `REQ-015` votes and saves remain after the app restarts

### Implementation for User Story 3

- [ ] T040 [US3] Create `builds/matt/app/api/stories/[id]/vote/route.ts`: `POST`; if not signed in, 303 to `/signin`; if the story doesn't exist, 404; otherwise toggle the row in `votes` for `(currentUser.id, storyId)` only, ignoring any other form fields; 303 to `returnTo` if it is a path on this site (starts with `/` and not `//`), else `/` (REQ-013, REQ-015, REQ-016)
- [ ] T041 [P] [US3] Create `builds/matt/app/api/stories/[id]/save/route.ts` with the same rules for `saves` (REQ-014, REQ-015, REQ-016)
- [ ] T042 [US3] Extend `listStories` in `builds/matt/lib/stories.ts` to return each story's vote count and, for a signed-in user, `voted` and `saved` flags; add `listSavedStories(userId)` (REQ-013, REQ-014)
- [ ] T043 [US3] Update `builds/matt/app/page.tsx`: each story gets a "Vote" / "Remove vote" form button with the count, and a "Save" / "Unsave" form button, each posting with `returnTo` set to the current page (REQ-013, REQ-014)
- [ ] T044 [US3] Create `builds/matt/app/saved/page.tsx`: signed-out visitors are redirected to `/signin`; otherwise list the user's saved stories with the same story layout, or "You haven't saved any stories yet." (REQ-014)
- [ ] T045 [US3] Run `npm run test:acceptance -- us3-votes-saves` and fix until every US3 test passes

**Checkpoint**: User Stories 1–3 work (AT-01 to AT-12, AT-15).

---

## Phase 6: User Story 4 — Filter by superintelligence topic (P3)

**Goal**: Readers pick a topic and see only stories on it, on a laptop or a phone.

**Independent Test**: Choose Alignment; every story shown has the Alignment topic; clear the
filter; the full feed returns; at phone width nothing scrolls sideways.

### Tests for User Story 4 (write first; they must fail)

- [ ] T046 [US4] Create `builds/matt/tests/acceptance/us4-filter.spec.ts` with blocks: `REQ-017 (AT-13)` filtering by Alignment shows only Alignment stories and "All topics" clears it; `REQ-017` a topic with no stories shows "No stories yet for this topic."; `REQ-018 (AT-13)` at a 375-pixel-wide viewport the page's scroll width is not larger than its client width

### Implementation for User Story 4

- [ ] T047 [US4] Extend `listStories` in `builds/matt/lib/stories.ts` with an optional `topic` filter (must be one of the IDs in `lib/topics.ts`; unknown values are ignored) (REQ-017)
- [ ] T048 [US4] Update `builds/matt/app/page.tsx`: a row of topic links (`/?topic=<id>`) plus "All topics", the current one marked with `aria-current="page"`, and the "No stories yet for this topic." message (REQ-017)
- [ ] T049 [US4] Update `builds/matt/app/globals.css` so the header, topic links and story cards wrap at narrow widths and long words or URLs break instead of overflowing (REQ-018)
- [ ] T050 [US4] Run `npm run test:acceptance -- us4-filter` and fix until every US4 test passes

**Checkpoint**: All four user stories work (AT-01 to AT-13, AT-15).

---

## Phase 7: Investment notice and keyboard access (REQ-022, REQ-023)

**Purpose**: Requirements that apply to every page rather than one user story.

- [ ] T051 Create `builds/matt/tests/acceptance/notice-keyboard.spec.ts` (write first; must fail) with blocks: `REQ-022 (AT-16)` `/`, `/saved`, `/signin` and `/signup` each show "For information only. Not investment advice."; `REQ-023 (AT-17)` using only `keyboard.press('Tab')` and `Enter`, a user can choose a topic filter, sign in, vote and save, and the focused element always has a visible outline
- [ ] T052 Add a `<footer>` to `builds/matt/app/layout.tsx` with the text "For information only. Not investment advice." (REQ-022; R11)
- [ ] T053 Update `builds/matt/app/globals.css` with a clearly visible `:focus-visible` outline on links, buttons and inputs, and text colors with enough contrast against the background (REQ-023; R6)
- [ ] T054 Run `npm run test:acceptance -- notice-keyboard` and fix until both tests pass

---

## Phase 8: Polish and M3 (Nov 22)

- [ ] T055 [P] Create `builds/matt/app/error.tsx` showing "Something went wrong. Please try again." with no internal details, and make every route handler log errors on the server and return the same message (contract, Section 3)
- [ ] T056 [P] Create `builds/matt/README.md`: what Build A is, how to run and test it (link to `specs/001-superintelligence-homepage/quickstart.md`), and the live URL
- [ ] T057 Run the full suite `npm run test:acceptance` locally; every test passes
- [ ] T058 **MANUAL (Matt)**: Redeploy, run the suite against the live URL, record AT-01 to AT-17 results in the contract's acceptance test table, and screen-reader check the live site (R6)
- [ ] T059 **MANUAL (Matt)**: Ask a classmate to open the live URL and sign up without help, timing it (AT-14, SC-001)
- [ ] T060 **MANUAL (Matt)**: Add your own entries to `AGENT_LOG.md` for anything the agent got wrong during the build (REQ-020; must be human-written)

---

## Dependencies and execution order

- **Phase 1 → Phase 2 → user stories.** T006 (local test database) must be done before T008 runs.
- **US1 (Phase 3)** and **US2 (Phase 4)** depend only on Phase 2 and could be built in either
  order; US1 comes first because it's the product.
- **M2 deploy checkpoint** needs Phases 3 and 4.
- **US3 (Phase 5)** needs US1 (stories to vote on) and US2 (signed-in users).
- **US4 (Phase 6)** needs US1 only.
- **Phase 7** needs US2 and US3 (the keyboard test signs in, votes and saves) and US4 (filter).
- **Phase 8** comes last.

```text
Setup → Foundational → US1 ─┬─→ US3 ─┐
                     → US2 ─┘        ├─→ Notice & keyboard → Polish
                       US1 ──→ US4 ──┘
```

## Parallel opportunities

- **Phase 1:** T002, T003, T004 together after T001.
- **Phase 2:** T009, T010, T011, T012, T014, T015 are separate files and can run together; T013
  waits for T012, and T016–T017 wait for T014–T015.
- **US1:** T024 (`vercel.json`) alongside T020–T023.
- **US2:** T032 and T033 together once T029 exists.
- **US3:** T041 alongside T040.
- **Phase 8:** T055 and T056 together.

## Implementation strategy

1. **MVP = User Story 1** (Phases 1–3): a live, filtered, grouped superintelligence feed.
2. **M2 (Nov 18)** = MVP + User Story 2, deployed (T036–T038).
3. **M3 (Nov 22)** = add User Story 3, User Story 4, the notice and keyboard work, and polish.
4. Stop after each phase, run that phase's tests, and review before moving on (Matt's direction:
   one reviewable step at a time).
