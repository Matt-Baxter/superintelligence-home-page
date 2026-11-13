# Feature Specification: Superintelligence Homepage

**Feature Branch**: `claude/youthful-fermat-iyku15`

**Created**: 2026-11-06

**Status**: Draft (shared bake-off spec; both partners build against it)

**Spec version**: 1.1 (changes are listed in [`CHANGELOG.md`](../../CHANGELOG.md))

**Input**: User description: see `docs/speckit-prompts.md`, sections 2 and 3 (`/speckit-specify`
and the superintelligence amendment).

## Overview

The Superintelligence Homepage is a home page for articles about superintelligence: progress
toward AGI and superintelligence, and the research and policy work on making superintelligence
safe. It gathers superintelligence writing from research papers, frontier AI lab blogs,
alignment and safety research groups, forecasting groups, forums and newsletters. Only
superintelligence-related stories make the feed; general AI news does not. Duplicate coverage is
grouped into one story, each story shows which superintelligence topics it covers and why, and
signed-in readers can vote on and save stories.

**The failure we're preventing:** following the path to superintelligence today means checking
many separate research sites, forums and newsletters, and general AI news sites bury the few
superintelligence stories under product launches and everyday AI news. Existing aggregators also
lean heavily on Twitter/X, so they miss long-form superintelligence writing, show the same paper
many times, and break when one platform changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a superintelligence feed (Priority: P1)

A visitor opens the site and sees a feed of recent superintelligence stories gathered
automatically from many public sources. Each story shows its title, its sources, the
superintelligence topics it covers with the words that matched, and a link to the original.
General AI news that has nothing to do with superintelligence doesn't appear.

**Why this priority**: The superintelligence feed is the product. Without it there is nothing to
vote on or save.

**Independent Test**: Load the site with the synthetic sample sources, which mix
superintelligence items with general AI items, and check that only the superintelligence items
appear, duplicates are grouped, and each story has topics with reasons and a working link.

**Acceptance Scenarios**:

1. **Given** at least 8 superintelligence sources across at least 5 kinds have been fetched,
   **When** a visitor opens the feed, **Then** they see superintelligence stories from at least
   8 different sources, newest first.
2. **Given** a fetched item about an AI alignment technique for superhuman systems, **When** the
   visitor views the feed, **Then** the story appears with an Alignment topic.
3. **Given** a fetched item about a new AI photo-editing app that mentions no superintelligence
   topic, **When** the visitor views the feed, **Then** that item does not appear.
4. **Given** the same superintelligence paper appears in three sources, **When** the visitor
   views the feed, **Then** it appears once, listing all three sources.
5. **Given** a story whose text mentions "AGI timelines", **When** the visitor views it,
   **Then** it shows a Forecasting & Timelines topic and the matched words "AGI timelines".
6. **Given** any story, **When** the visitor selects it, **Then** they are taken to the original
   source page.

---

### User Story 2 - Create an account and stay signed in (Priority: P1)

A visitor creates an account with a username and password, signs in, and stays signed in when
they come back later. They can sign out at any time.

**Why this priority**: Accounts and multi-user persistence are a course requirement, and voting
and saving superintelligence stories depend on them.

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

### User Story 3 - Vote on and save superintelligence stories (Priority: P2)

A signed-in reader votes on the superintelligence stories they think matter most and saves
stories to read later. Their votes and saves are still there the next time they sign in, and
other readers see the vote totals.

**Why this priority**: This turns a read-only superintelligence feed into something a class can
curate together, and it proves per-user persistence.

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

### User Story 4 - Filter by superintelligence topic (Priority: P3)

A reader picks a superintelligence topic, such as Alignment or Governance, and sees only stories
on that topic.

**Why this priority**: Useful once the superintelligence feed is busy, but the app works without it.

**Independent Test**: Choose a topic and check every story shown carries that topic; clear the
filter and check the full feed returns.

**Acceptance Scenarios**:

1. **Given** stories on Alignment and on other topics, **When** the reader filters by Alignment,
   **Then** only Alignment stories are shown.
2. **Given** a topic with no stories, **When** the reader filters by it, **Then** they see a
   "no stories yet" message rather than an empty page.

---

### Edge Cases

- An item mentions "AI" but no superintelligence topic (for example, AI in retail): it is left
  out of the feed.
- An item from a superintelligence-focused source is about something off-topic (for example, a
  hiring announcement): it is left out if it matches no superintelligence topic.
- An item's text contains a word close to a key phrase but not the phrase itself (for example
  "align" instead of "alignment"): it does not match. Only the exact key phrases count, so both
  builds make the same call.
- A source is unreachable or returns bad data: the rest of the feed still loads, and that
  source's stories are simply missing until the next successful fetch.
- A source publishes a link to Twitter/X: the item is not shown.
- The same story arrives again on a later fetch: it is not duplicated.
- No superintelligence stories have been fetched yet (fresh install): the feed shows a friendly
  empty message.
- Two users vote on the same story at the same moment: both votes count.

## Requirements *(mandatory)*

### Functional Requirements

**Superintelligence feed and sources**

- **REQ-001**: The system MUST fetch items automatically, on a schedule, from at least 8 public
  sources that regularly cover superintelligence, across at least 5 kinds: research papers,
  frontier AI lab blogs, alignment and safety research groups, forecasting and research
  organizations, forums, and newsletters.
- **REQ-002**: The system MUST show a feed of superintelligence stories, newest first, where each
  story shows its title, the sources that covered it, its superintelligence topics and a link to
  the original.
- **REQ-003**: The system MUST include only items relevant to superintelligence, meaning items
  that match at least one superintelligence topic, and MUST leave all other items out of the feed.
  An item matches a topic when its title or summary contains at least one of that topic's key
  phrases (see Superintelligence topics and key phrases, below), ignoring capital letters.
- **REQ-004**: The system MUST show the same paper or announcement from several sources as one
  story listing every source.
- **REQ-005**: The system MUST tag each story with the superintelligence topics it matches and
  MUST show the words that caused each tag, so readers can see why the story is on a
  superintelligence home page.
- **REQ-006**: The system MUST NOT use Twitter/X as a source and MUST NOT show or accept links to it.
- **REQ-007**: The system MUST link out to the original source and MUST NOT host full article text.
- **REQ-008**: A failing source MUST NOT stop the rest of the feed from loading.

**Accounts**

- **REQ-009**: Visitors MUST be able to create an account with a unique username and a password.
- **REQ-010**: Users MUST be able to sign in and sign out, and MUST stay signed in between visits
  until they sign out.
- **REQ-011**: The system MUST NOT store or display passwords in readable form.
- **REQ-012**: The system MUST NOT collect personal data beyond a username and password.

**Votes and saves**

- **REQ-013**: Signed-in users MUST be able to vote on a story, at most once per story, and
  remove their vote.
- **REQ-014**: Signed-in users MUST be able to save and unsave stories and view their saved list.
- **REQ-015**: Votes and saves MUST be kept per user and still be there after signing out and
  after the site is redeployed.
- **REQ-016**: Users MUST only be able to change their own votes and saves, and this MUST be
  enforced by the system, not only hidden in the interface.

**Browsing**

- **REQ-017**: Readers MUST be able to filter the feed by superintelligence topic.
- **REQ-018**: The feed MUST be usable on a laptop and a phone without sideways scrolling.

**Safety and access**

- **REQ-021**: The system MUST show text from fetched items as plain text, so nothing in a feed
  can run as code or change the page in a reader's browser. *(Risk R4)*
- **REQ-022**: Every page MUST show a short notice that the content is for information only and
  is not investment advice. *(Risk R11)*
- **REQ-023**: Every action (reading, filtering, signing in, voting, saving) MUST be possible
  with a keyboard alone. *(Risk R6)*

**Delivery**

- **REQ-019**: The Superintelligence Homepage MUST be live at a public URL and shared with the
  class at least 2 weeks before our presentation.
- **REQ-020**: Each partner MUST keep a human-written agent log in the repository
  (`AGENT_LOG.md`) answering "What did the agent get wrong & how did you catch it?". The agent log
  is not a feature of the app.

### Clarifications

- 2026-11-07: Q: Should the agent log be a page inside the app or a Markdown file in the repo?
  A: A Markdown file in the repo (`AGENT_LOG.md`), written by the partners, not by AI.

### Superintelligence topics and key phrases

Fixed for both builds (constitution, Bake-off Rules). Changes need both partners' approval and a
changelog entry.

| Topic | Key phrases |
|-------|-------------|
| Capabilities & AGI progress | AGI, artificial general intelligence, superintelligence, superintelligent, frontier model, human-level AI |
| Automating AI research | automated AI research, AI scientist, automating AI research, AI research agent |
| Recursive self improvement | recursive self-improvement, self-improving AI, intelligence explosion |
| Alignment | alignment, aligned AI, misalignment, reward hacking, scalable oversight, superalignment |
| Interpretability | interpretability, mechanistic interpretability, sparse autoencoder |
| Safety & risk | AI safety, existential risk, x-risk, catastrophic risk, loss of control, deceptive alignment |
| Forecasting & timelines | AGI timelines, forecasting AI, AI forecast, transformative AI |
| Compute & scaling | scaling laws, compute scaling, training compute, scaling hypothesis |
| Governance & policy | AI governance, frontier AI regulation, compute governance, AI policy, frontier AI safety |

### Key Entities

- **User**: someone with an account; has a unique username and a password (stored unreadably).
- **Source**: a public feed that regularly covers superintelligence; has a name, a kind (papers,
  frontier lab, alignment/safety group, forecasting/research org, forum, newsletter) and whether
  its last fetch worked.
- **Story**: one superintelligence paper, post or announcement; has a title, a link to the
  original, a publish date, the sources that covered it and its superintelligence topics.
- **Superintelligence topic**: one subject from the fixed topic list (see Superintelligence topics
  and key phrases), attached to a story with the key phrases that matched.
- **Vote**: one user's vote on one story.
- **Save**: one user's saved story.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A classmate can sign up on the live site and see the superintelligence feed in
  under 2 minutes, with no help.
- **SC-002**: The feed shows superintelligence stories from at least 8 sources across at least
  5 kinds.
- **SC-003**: In the synthetic test data, 100% of items labelled "not about superintelligence"
  are left out of the feed, and 100% of items labelled "about superintelligence" appear.
- **SC-004**: On the live site, at least 9 of every 10 stories in a sample of 20 are judged by
  both partners to be about superintelligence.
- **SC-005**: In the synthetic test data, 100% of known duplicate papers appear as one story.
- **SC-006**: 100% of stories show the words that made them superintelligence-related.
- **SC-007**: After signing out and back in, and after a redeploy, 100% of a user's votes and
  saves are still there.
- **SC-008**: Every requirement above has at least one passing acceptance test in each
  partner's build.

## Risks & Governance

Areas follow the course's risk map: Data, People, Decisions, Code, Agents, Security and Failure.
Status is one of: **Open** (no mitigation yet), **Planned** (mitigation is a requirement or rule,
not yet built), **In place** (already done), **Deferred** (accepted risk for now, revisited at a
named milestone).

| # | Area | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|---|------|------|------------|--------|------------|-------|--------|
| R1 | Data | Account data leaks. The only personal data is a username and password, stored in the app's database and seen only by the account owner. A leak would expose passwords people may reuse elsewhere. | Low | High | Passwords are never stored or shown in readable form (REQ-011); nothing beyond a username and password is collected (REQ-012); database credentials live only in the host's settings, never in the repo. | Each build's owner | Planned |
| R2 | Security | Someone abuses sign-in, for example guessing passwords or creating many fake accounts to inflate votes. | Medium | Medium | Sign-in errors don't reveal whether a username exists (User Story 2, scenario 4); one vote per user per story (REQ-013). Slowing down repeated failed sign-ins is deferred to after milestone M2: the site holds no sensitive data and the class is small. | Each build's owner | Deferred |
| R3 | Security | A user changes or removes another user's votes or saves by sending requests directly to the server. | Medium | Medium | Ownership is enforced by the system, not just hidden in the interface (REQ-016): where a build's database supports it, row-level security (RLS) stops a user from changing other users' vote and save rows. RLS is recommended, not required, because each build designs its own database. Checked by acceptance test AT-12 in the contract. | Each build's owner | Planned |
| R4 | Security | Harmful input: a fetched feed item contains scripts or misleading links that run or show in readers' browsers. The app has no uploads, so input comes from feeds and sign-up forms. | Medium | High | Feed text is shown as plain text, never as active page content (REQ-021); only links to the original source are shown; Twitter/X links are dropped (REQ-006). | Each build's owner | Planned |
| R5 | Decisions | Superintelligence is a subjective domain with ambiguous definitions. It's unclear which articles or developments actually move the path to superintelligence forward and which don't, so the app's decisions about what counts could hide important work or fill the feed with off-topic or one-sided stories. | High | Medium | A fixed, written topic list defines what's in scope (spec Assumptions; constitution principle I), reviewed by both partners; every story shows the words that made it relevant (REQ-005), so readers can judge for themselves; tags say a story is *related to* a topic, not that it advances superintelligence; when in doubt, a story is left out; both partners spot-check 20 live stories (SC-004). | Both | Planned |
| R10 | People | Fearmongering: alarming headlines about superintelligence risk, shown without context, could scare or mislead readers, or make the site look like it's pushing one view. | Medium | Medium | Show each story's own title and source without adding labels like "breaking" or "dangerous"; include sources from different viewpoints (safety research, capabilities, forecasting, policy); link to the original so readers get the full context. | Both | Open |
| R11 | People | Readers treat stories about AI labs, compute or chips as investment advice. | Medium | Medium | A notice on every page says the content is for information only and is not investment advice (REQ-022); no stock tickers, price data or buy/sell language. | Both | Planned |
| R6 | People | Readers with disabilities can't use the site, for example people using a screen reader or a keyboard instead of a mouse. | Medium | Medium | Every action works with a keyboard alone (REQ-023); text has enough contrast; both builds are checked with a screen reader before milestone M2. | Each build's owner | Planned |
| R7 | Code | Agent-written or reused code carries a license we can't use, or copies someone else's work. Article text from sources is also copyrighted. | Medium | Low | Use only dependencies with permissive licenses and check them before M3; note where reused code came from (John's earlier projects); link out instead of hosting article text (REQ-007). | Both | Open |
| R8 | Agents | An agent pushes, deploys or spends money without a human noticing. | Low | High | Agents push to `main` only when a partner says so, never deploy, never handle real secrets and never spend money; a $10/month cap with hard limits in each provider's dashboard (working agreement, Agent rules and Data and costs). | Both | In place |
| R12 | Failure | Schedule: two complete builds, every milestone date still unset, and a running app expected by Nov 18. One or both builds may not be ready. | High | High | Set milestone dates as soon as Paul confirms the presentation date; required features only until M2; the falling-behind rule (contract, Section 6) makes the further-along build the base. | Both | Open |
| R13 | Failure | Shared infrastructure: both builds run on John's Vercel account and one $10 budget. If they also shared a database, one build could break the other's data, and one account problem would take down both. | Medium | High | Each build gets its own database (contract, Section 3); spending limits set in each provider's dashboard; Matt has access to the Vercel project as a backup. | John | Open |
| R14 | Failure | Sources change their feed format, rate-limit us or block us, so stories quietly stop arriving. | Medium | Medium | Each source's last successful fetch is recorded and visible; at least 8 sources so one loss doesn't break REQ-001; fetch no more often than every 30 minutes. | Each build's owner | Open |
| R9 | Failure | A source or the whole site goes down, or the feed silently stops updating. | Medium | Medium | One failing source doesn't break the feed (REQ-008); each source's last successful fetch is recorded; the hosting platform emails John when a deploy fails, and he tells Matt by text the same day; recovery is to roll back to the last working deploy within 24 hours. | John (hosting), both builds' owners | Open |

## Assumptions

- **Superintelligence topics**: the fixed list in Superintelligence topics and key phrases, under
  Requirements. It can grow later with both partners' approval.
- Example sources that regularly cover superintelligence: arXiv (AI safety and frontier
  capability papers), the Alignment Forum, LessWrong (AI tag), frontier lab research and safety
  blogs, Epoch AI, AI Impacts, MIRI and Import AI. Each partner may pick the exact list, as long
  as it meets REQ-001.
- Deciding whether an item is about superintelligence is based on the key phrases in its title and
  summary (REQ-003); no paid service is needed.
- Users have a modern web browser and an internet connection.
- The chosen sources offer public feeds that don't need paid access.
- A username and password is enough for sign-in; email verification and password reset are not
  needed for a class project.
- Tests use synthetic data: made-up users and recorded sample feeds containing both
  superintelligence items and general AI items.
- English-language sources only.

## Out of Scope

- General AI news that isn't about superintelligence (product launches, everyday AI apps, AI in
  specific industries)
- Notes on stories, reading lists, a weekly brief, user-suggested sources, email digests and
  AI-written summaries (possible later additions, not required for the bake-off)
- Social media scraping, including Twitter/X
- Hosting full article text
- Real-time chat or comments
- Admin tools beyond what's needed to run the site
- An agent log page inside the app (the agent log is `AGENT_LOG.md` in the repo)
