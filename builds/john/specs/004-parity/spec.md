# Feature Specification: Feature parity with AI-news and research apps (extended version)

**Feature Branch**: `feature/judge-fidelity-rules` (proposal only; building starts on its own `feature/` branch after approval)

**Created**: 2026-11-07

**Status**: Proposed, **not approved**. Nothing here is in scope until both partners (John and Matt) approve it (constitution, shared documents). It changes only the extended version (`SITE_PROFILE=extended`), each part behind its own profile feature so the `spec` version keeps answering 404 for it. The shared spec (`specs/001-superintelligence-homepage`) is unchanged: where a requirement here builds on a shared REQ (REQ-004, REQ-013, REQ-017, REQ-018), it is an extended-version addition next to that REQ, never a change to it.

**Input**: a public-features survey of 35 AI-news, paper-discovery and feed-reading apps on 33 dimensions (`docs/market/apps.json`, checked 2026-11), with our own column checked against the code and the gaps ranked in [`docs/PARITY.md`](../../docs/PARITY.md). Twelve gaps survived verification and need a new requirement; three more map to existing requirements or wait.

## Overview

The homepage already does what the shared spec asks and much of what the best apps do: grouping, explainable tags and scores, accounts, votes, saves, an admin module and a capability tracker. Checked against the code, its one confirmed absence is personalisation, and its biggest partial gaps are search (substring match only), filtering out what a reader doesn't want, getting stories out of the site (feeds, export, offline), and showing how a story was covered and by what kind of source.

This feature closes those gaps the way the constraints allow:

1. explain every personal pick, and keep personalisation opt-in;
2. index only what is already stored (titles, summaries, tags), never full text (REQ-007);
3. keep reader state in the browser where possible, and otherwise only alongside votes and saves (REQ-012);
4. call outside services only on demand, cache and prune what they return, and never poll (free tiers);
5. no Twitter/X anywhere (REQ-006), and labels describe sources, never people.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader finds what they care about and drops what they don't (Priority: P1)

A signed-in reader searches the feed by word, mutes a word, tag or source they never want, and can turn on a "For you" order that says why each story is there.

**Why this priority**: Search and personal ranking are the two largest gaps in the survey, and mute filters are the cheapest win.

**Independent Test**: On the synthetic fixtures (`test/fixtures`, Sample, test data): search finds a story by a word in its summary or one of its matched words; a muted source's stories disappear from every sort; a reader who voted for three Sample alignment stories sees alignment stories first under "For you", each with its top words.

**Acceptance Scenarios**:

1. **Given** stories whose titles, summaries or matched words contain a term, **When** a reader searches for it, **Then** those stories come back ranked by match, on both SQLite and Postgres, and a word in a stop list or a single character returns a clear message instead of every story.
2. **Given** a muted word, tag or source, **When** any feed sort or the brief is shown to that reader, **Then** no matching story appears, a count says how many were hidden, and one click shows them.
3. **Given** a reader who has turned on "For you" and has at least 5 votes or saves, **When** the feed is sorted that way, **Then** each story shows up to 5 words that raised it, and turning it off deletes the reader's model.
4. **Given** a reader with fewer than 5 votes or saves, **When** they choose "For you", **Then** they get the normal order and a note saying how many more are needed.

### User Story 2 - A reader sees how a story was covered and by whom (Priority: P1)

**Why this priority**: Grouping is already the core of the site; showing the coverage it found is the cheapest way to make it more useful.

**Independent Test**: A Sample story covered by a lab blog, a preprint and a news site shows three rows with their kinds, labels and first-seen times, and a Sample single-source story appears in that week's single-source list.

**Acceptance Scenarios**:

1. **Given** a story group, **When** its page is opened, **Then** a coverage panel lists each source with its kind, its source-type label and when it first saw the story, ordered by first seen, with the lag from the first.
2. **Given** a source in the catalog, **When** it is shown anywhere, **Then** its label says whether it is a primary or secondary source, peer-reviewed, a preprint or neither, and from a vendor or independent, with a link to why; a source with no label says "unlabelled".
3. **Given** a week, **When** the brief is shown, **Then** it lists the significant stories that only one source covered.

### User Story 3 - A reader takes stories with them (Priority: P2)

**Why this priority**: Feeds, export and an installable reading list let people use the site where they already read, without email or paid services.

**Independent Test**: The topic Atom feed validates and lists the newest Sample stories; a reader's export holds exactly their own saves, lists and notes; with the network off, the installed app opens the saved list.

**Acceptance Scenarios**:

1. **Given** a topic or the weekly brief, **When** a feed reader asks for its Atom feed, **Then** it gets titles, links, topics and the significance score (no full text), served with cache headers so repeat requests don't wake the server.
2. **Given** a reader returns after a visit, **When** the feed loads, **Then** stories newer than their last visit are marked, using a time kept in their browser only.
3. **Given** a signed-in reader, **When** they export, **Then** they get their saves, lists and notes as JSON or CSV, and nothing about any other reader.
4. **Given** anyone, **When** they ask for the source list, **Then** they get the active sources as OPML.
5. **Given** a reader who installed the site, **When** they are offline, **Then** the saved list's cards (title, source, link, topics, score) open from the cache, and signing out clears it.

### User Story 4 - A researcher follows a paper's code and neighbours (Priority: P2)

**Why this priority**: Code links filled the gap a discontinued index left; the citation neighbourhood places a paper among its prior and later work.

**Independent Test**: A Sample paper whose abstract links a code repository shows a "code available" badge; with the citation service replaced by a fixture, its page lists prior and derivative Sample papers, and a second visit makes no new call.

**Acceptance Scenarios**:

1. **Given** a paper whose abstract or public paper page links code, a model or a dataset, **When** it is stored, **Then** the links are kept (URLs only), shown as badges, and offered to the Lab; a Twitter/X link is never kept.
2. **Given** a paper with an arXiv id or DOI, **When** a reader opens its neighbourhood, **Then** up to 10 prior and 10 derivative papers appear (title, year, link), fetched once from a free API and cached for 30 days; if the API fails or rate-limits, the page says so and the rest of the page still loads.

### User Story 5 - Anyone can see how the rules and moderation changed (Priority: P3)

**Why this priority**: The site's claim is explainability; a public log makes it checkable over time.

**Independent Test**: Changing a Sample rule version and hiding a Sample story each add a row to the public change log, and the row shows no admin username.

**Acceptance Scenarios**:

1. **Given** a change to the scoring rules or the ontology, **When** it ships, **Then** the public change log shows the new version, the date and what changed, and older entries are never edited.
2. **Given** a moderation action (story hidden, source paused), **When** it is logged, **Then** the public log shows the action, the target and the reason, not who did it.

### User Story 6 - Votes resist gaming and say more (Priority: P3)

**Why this priority**: Useful once there are more readers; today's one vote per story already meets REQ-013.

**Independent Test**: A Sample account created an hour ago votes; its vote is counted in the total but weighs less in rank, and the story's explanation says so; the 101st vote in a day is refused.

**Acceptance Scenarios**:

1. **Given** a reader over the daily vote cap, **When** they vote, **Then** the vote is refused with a clear message, and un-voting is always allowed.
2. **Given** a story, **When** its rank explanation is shown, **Then** it lists the votes' contribution, including any lower weight for new accounts.
3. **Given** a story, **When** a reader marks "agree" or "disagree" with its main claim, **Then** that is shown apart from the importance vote and never feeds rank; each reader has at most one importance vote and one agreement mark per story.

### Edge Cases

- A search for a phrase in quotes, a hyphenated term ("chain-of-thought"), an accented word, or a term only in a matched word.
- Mute rules that hide every story, overlap each other, or name a source that was later deleted.
- A reader with only saves, only votes, or votes that cancel out; a reader who turns personalisation off and on again.
- A story first seen by a source whose clock or published date is wrong (first-seen uses `seen_at`, not the feed's date).
- A source whose kind and label disagree (a lab's preprint server); a personal blog (labelled as a kind of source, never as a judgement of the person).
- An Atom request for an unknown topic; a brief week with no stories; a feed reader that ignores cache headers.
- A paper page that links several repositories, a dead link, or a Twitter/X link.
- The citation API returning nothing, a different paper, or a rate-limit error.
- Two tabs installing the service worker; a reader signing out while offline.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-041**: In the extended version, a signed-in reader SHOULD be able to turn on a "For you" order computed from their own votes and saves by a small model over the stored titles and summaries (no paid API, no full text), each pick showing the words that raised it; it SHOULD be off by default, need at least 5 votes or saves, and turning it off SHOULD delete the reader's model.
- **REQ-042**: In the extended version, search SHOULD use a full-text index (SQLite FTS5, Postgres `tsvector`) over titles, summaries, topic labels and matched words, rank by match, behave the same on both databases, and fall back to today's substring match where the index is missing.
- **REQ-043**: In the extended version, each story page SHOULD show a coverage panel: every source with its kind, its source-type label and its first-seen time, ordered by first seen with the lag from the first; and the weekly brief SHOULD list significant stories covered by a single source.
- **REQ-044**: In the extended version, each catalog source SHOULD carry a static source-type label (primary or secondary; peer-reviewed, preprint or neither; vendor or independent) with a short reason, shown on cards and the coverage panel; labels describe sources, never people, and using a label in the significance score is a separate rules change that keeps every point explained.
- **REQ-045**: In the extended version, the site SHOULD publish Atom feeds per topic and for the weekly brief (titles, links, topics, score; no full text), with cache headers that keep repeat requests off the server, and SHOULD mark stories newer than a reader's last visit using a time kept only in the browser; no email is sent.
- **REQ-046**: In the extended version, a signed-in reader SHOULD be able to mute words, tags and sources (at most 50 rules), applied to every feed sort and the brief, with a count of hidden stories and a way to show them.
- **REQ-047**: In the extended version, when a paper is stored, the system SHOULD keep the code, model and dataset links found in its abstract or its public paper page (URLs only, never Twitter/X), show them as badges and offer them to the Lab.
- **REQ-048**: In the extended version, a paper SHOULD be able to show its citation neighbourhood (up to 10 prior and 10 derivative papers: title, year, link) from a free scholarly API, fetched only when a reader asks, cached for 30 days and pruned, with failures reported on the page without breaking it.
- **REQ-049**: In the extended version, a signed-in reader SHOULD be able to export their own saves, lists and notes as JSON or CSV, and anyone SHOULD be able to download the active source list as OPML.
- **REQ-050**: In the extended version, the site SHOULD be installable (web app manifest) and SHOULD cache the app shell and the reader's saved-list cards (metadata and link only, REQ-007) for offline reading, clearing the cache on sign-out.
- **REQ-051**: In the extended version, the system SHOULD keep a public, append-only change log of scoring-rule and ontology versions (what changed, when) and of moderation actions (action, target, reason, without the admin's name), pruned to a year.
- **REQ-052**: In the extended version, votes SHOULD have a daily cap per reader and a lower rank weight for accounts under a day old, both shown in the rank explanation; a separate, optional agree/disagree mark SHOULD be shown apart from the importance vote and never feed rank. REQ-013's one vote per story is unchanged.

### Key Entities

- **Search index**: the full-text index over a story's title, summary, topic labels and matched words, rebuilt when a story is re-tagged.
- **Mute rule**: a reader's word, tag or source to hide; kept with the account like saves.
- **Reader model**: an opted-in reader's word weights, derived from their votes and saves, deleted when they opt out.
- **Source label**: a source's role, review status and independence, with a reason.
- **Coverage row**: one source's link to a story group with its first-seen time.
- **Paper links**: a paper's code, model and dataset URLs.
- **Neighbourhood cache**: prior and derivative paper ids, titles, years and links for one paper, with its fetch time.
- **Change-log entry**: a rules or ontology version, or a moderation action, with its date and reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-401**: On the synthetic search set, every story that contains the query in its title, summary or matched words is found, on SQLite and on Postgres, with the same top 10.
- **SC-402**: A muted word, tag or source hides 100% of matching stories in every sort and the brief, checked on the fixtures.
- **SC-403**: On a synthetic reader set, "For you" puts at least 7 of the reader's preferred-topic stories in the top 10, and every pick shows at least one reason word.
- **SC-404**: The Atom feeds validate as Atom 1.0, and repeat requests within the cache window reach the server at most once per window.
- **SC-405**: No new feature stores a full article, and no new column holds personal data beyond what REQ-012 allows (checked by a preflight rule on new tables).
- **SC-406**: The parity matrix (`docs/PARITY.md`) is refreshed when a gap closes, and the count of "missing" and "partial" dimensions only goes down.

## Assumptions

- Mute rules and an opted-in reader model are reader preferences kept like votes and saves, not personal data beyond REQ-012; both partners confirm this at approval (task T000).
- The Semantic Scholar Graph API (or OpenAlex) stays free for low, on-demand volumes without a key; its terms are checked before building (task T080).
- Hugging Face paper pages are public, and reading a linked repository URL from them is allowed; only the URL is stored.
- Atom feeds of titles and links are public; whether they need a per-reader token is a decision for the partners (task T001).

## Out of Scope

- Changing the shared spec's REQ-001..REQ-020.
- Email digests (the shared spec lists them out of scope), paid model calls, and full-text storage or highlights on publishers' text.
- Any Twitter/X data or links.
- Labels, scores or claims about named people.
- A "claims to watch" scorecard and highlights on summaries (listed as gaps 14 and 15 in `docs/PARITY.md`; each would need its own proposal).
