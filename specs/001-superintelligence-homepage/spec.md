# Feature Specification: Superintelligence Homepage

**Feature Branch**: `claude/youthful-fermat-iyku15`

**Created**: 2026-11-06

**Status**: Draft (shared bake-off spec; both partners build against it)

**Input**: User description: see `docs/speckit-prompts.md`, section 2 (`/speckit-specify`).

## Overview

One place to follow progress toward advanced AI, drawn from papers, AI lab blogs, research
organizations, forums and newsletters instead of a single social platform. Duplicate coverage is
grouped into one story, every story is tagged by topic with a visible reason, and signed-in
readers can vote on and save stories.

**The failure we're preventing:** following AI progress today means checking many separate sites.
Existing aggregators lean heavily on Twitter/X, so they miss long-form sources, show the same
paper many times, and break when one platform changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a grouped, tagged feed (Priority: P1)

A visitor opens the site and sees a feed of recent AI-progress stories gathered automatically
from many public sources. Each story shows its title, its sources, its topic tags and a link to
the original.

**Why this priority**: The feed is the product. Without it there is nothing to vote on or save.

**Independent Test**: Load the site with the synthetic sample sources and check that stories
appear, duplicates are grouped, and each story has tags with reasons and a working link.

**Acceptance Scenarios**:

1. **Given** at least 8 sources across at least 5 kinds have been fetched, **When** a visitor
   opens the feed, **Then** they see stories from at least 8 different sources, newest first.
2. **Given** the same paper appears in three sources, **When** the visitor views the feed,
   **Then** it appears once, listing all three sources.
3. **Given** a story whose text mentions "chain of thought", **When** the visitor views it,
   **Then** it shows a Reasoning tag and the matched words "chain of thought".
4. **Given** a story that matches no topic, **When** the visitor views it, **Then** it is marked
   "Untagged" rather than hidden.
5. **Given** any story, **When** the visitor selects it, **Then** they are taken to the original
   source page.

---

### User Story 2 - Create an account and stay signed in (Priority: P1)

A visitor creates an account with a username and password, signs in, and stays signed in when
they come back later. They can sign out at any time.

**Why this priority**: Accounts and multi-user persistence are a course requirement, and voting
and saving depend on them.

**Independent Test**: Sign up as a new user, close the browser, return and confirm the user is
still signed in; then sign out and confirm they are not.

**Acceptance Scenarios**:

1. **Given** an unused username, **When** a visitor signs up with it and a password, **Then**
   they are signed in and see their username.
2. **Given** a taken username, **When** a visitor tries to sign up with it, **Then** sign-up is
   refused with a message saying the name is taken.
3. **Given** a signed-in user, **When** they close the browser and return the next day,
   **Then** they are still signed in.
4. **Given** a wrong password, **When** a user tries to sign in, **Then** sign-in is refused
   without revealing whether the username exists.
5. **Given** a signed-in user, **When** they sign out, **Then** vote and save actions ask them to
   sign in again.

---

### User Story 3 - Vote on and save stories (Priority: P2)

A signed-in reader votes on stories they think matter and saves stories to read later. Their
votes and saves are still there the next time they sign in, and other readers see the vote totals.

**Why this priority**: This is what turns a read-only feed into something a class can curate
together, and it proves per-user persistence.

**Independent Test**: With two test users, vote and save as each, sign out and back in, and check
each user sees only their own saves while vote totals count both.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they vote on a story, **Then** its vote count goes up by
   one and the story shows as voted for them.
2. **Given** a user who has already voted on a story, **When** they vote again, **Then** their
   vote is removed (one vote per user per story).
3. **Given** a user who saved two stories, **When** they sign out, sign back in and open their
   saved list, **Then** both stories are there.
4. **Given** users A and B, **When** A saves a story, **Then** it does not appear in B's saved list.
5. **Given** a visitor who is not signed in, **When** they try to vote or save, **Then** they are
   asked to sign in and nothing is recorded.
6. **Given** user A, **When** A tries to change or remove user B's vote or save by any means,
   **Then** the request is refused.

---

### User Story 4 - Filter the feed by topic (Priority: P3)

A reader picks a topic, such as Safety, and sees only stories tagged with it.

**Why this priority**: Useful once the feed is busy, but the app works without it.

**Independent Test**: Choose a topic and check every story shown carries that tag; clear the
filter and check the full feed returns.

**Acceptance Scenarios**:

1. **Given** stories tagged Safety and others not, **When** the reader filters by Safety,
   **Then** only Safety-tagged stories are shown.
2. **Given** a topic with no stories, **When** the reader filters by it, **Then** they see a
   "no stories yet" message rather than an empty page.

---

### Edge Cases

- A source is unreachable or returns bad data: the rest of the feed still loads, and that
  source's stories are simply missing until the next successful fetch.
- A source publishes a link to Twitter/X: the item is not shown.
- The same story arrives again on a later fetch: it is not duplicated.
- No stories have been fetched yet (fresh install): the feed shows a friendly empty message.
- Two users vote on the same story at the same moment: both votes count.

## Requirements *(mandatory)*

### Functional Requirements

**Feed and sources**

- **REQ-001**: The system MUST fetch stories automatically, on a schedule, from at least 8 public
  sources covering at least 5 kinds: papers, AI lab blogs, research organizations, forums and
  newsletters.
- **REQ-002**: The system MUST show a feed of stories, newest first, where each story shows its
  title, the sources that covered it, its topic tags and a link to the original.
- **REQ-003**: The system MUST show the same paper or announcement from several sources as one
  story listing every source.
- **REQ-004**: The system MUST tag each story with one or more topics, or mark it "Untagged",
  and MUST show the words that caused each tag.
- **REQ-005**: The system MUST NOT use Twitter/X as a source and MUST NOT show or accept links to it.
- **REQ-006**: The system MUST link out to the original source and MUST NOT host full article text.
- **REQ-007**: A failing source MUST NOT stop the rest of the feed from loading.

**Accounts**

- **REQ-008**: Visitors MUST be able to create an account with a unique username and a password.
- **REQ-009**: Users MUST be able to sign in and sign out, and MUST stay signed in between visits
  until they sign out.
- **REQ-010**: The system MUST NOT store or display passwords in readable form.
- **REQ-011**: The system MUST NOT collect personal data beyond a username and password.

**Votes and saves**

- **REQ-012**: Signed-in users MUST be able to vote on a story, at most once per story, and
  remove their vote.
- **REQ-013**: Signed-in users MUST be able to save and unsave stories and view their saved list.
- **REQ-014**: Votes and saves MUST be kept per user and still be there after signing out and
  after the site is redeployed.
- **REQ-015**: Users MUST only be able to change their own votes and saves, and this MUST be
  enforced by the system, not only hidden in the interface.

**Browsing**

- **REQ-016**: Readers MUST be able to filter the feed by topic.
- **REQ-017**: The feed MUST be usable on a laptop and a phone without sideways scrolling.

**Delivery**

- **REQ-018**: The app MUST be live at a public URL and shared with the class at least 2 weeks
  before our presentation.
- **REQ-019**: [NEEDS CLARIFICATION: Should the agent log be a page inside the app (as in John's
  first build), or a Markdown file in the repo? The course requires an agent log either way.]

### Key Entities

- **User**: someone with an account; has a unique username and a password (stored unreadably).
- **Source**: a public feed the app reads; has a name, a kind (papers, lab, research org, forum,
  newsletter) and whether its last fetch worked.
- **Story**: one paper or announcement; has a title, a link to the original, a publish date,
  the sources that covered it and its topic tags.
- **Topic tag**: a topic attached to a story, with the words that matched.
- **Vote**: one user's vote on one story.
- **Save**: one user's saved story.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A classmate can sign up on the live site and see the feed in under 2 minutes, with
  no help.
- **SC-002**: The feed shows stories from at least 8 sources across at least 5 kinds.
- **SC-003**: In the synthetic test data, 100% of known duplicate papers appear as one story.
- **SC-004**: 100% of tagged stories show the words that caused each tag.
- **SC-005**: After signing out and back in, and after a redeploy, 100% of a user's votes and
  saves are still there.
- **SC-006**: Every requirement above has at least one passing acceptance test in each
  partner's build.

## Assumptions

- Users have a modern web browser and an internet connection.
- The chosen sources offer public feeds that don't need paid access.
- A username and password is enough for sign-in; email verification and password reset are not
  needed for a class project.
- Topics come from a small fixed list both partners agree on (for example reasoning, agents,
  safety, interpretability, compute, policy); the list can grow later.
- Tests use synthetic data: made-up users and recorded sample feeds.
- English-language sources only.

## Out of Scope

- Notes on stories, reading lists, a weekly brief, user-suggested sources, email digests and
  AI-written summaries (possible later additions, not required for the bake-off)
- Social media scraping, including Twitter/X
- Hosting full article text
- Real-time chat or comments
- Admin tools beyond what's needed to run the site
