# Bake-off Contract

**Project:** Superintelligence Homepage | **Partners:** Matt Baxter, John Affolter |
**Current version:** 1.2 (draft: both partners approve it at our next check-in, which completes milestone M1)

**Main question:** Is our comparison of the two builds fair?

We are done when a classmate can sign up on the live site, see a grouped, tagged feed of
superintelligence stories from at least 8 sources, and vote on and save stories that are still
there the next time they sign in.

## 1. The two builds

| Build | Owner | Agent tool | Stack | Folder |
|-------|-------|------------|-------|--------|
| Build A | Matt | Claude Code, with Spec Kit | Chosen in Matt's `/speckit-plan`; hosted on Vercel with Neon Postgres | `builds/matt/` |
| Build B | John | v0 | Chosen by John; hosted on Vercel with Neon Postgres | `builds/john/` |

**Question we are testing:** Given the same superintelligence spec, which approach produces the
better Superintelligence Homepage: Claude Code driven by a Spec Kit spec, or v0 starting from
John's earlier work? And why?

## 2. Shared scope

The full requirements, with Given/When/Then scenarios, are in the shared spec,
[`specs/001-superintelligence-homepage/spec.md`](specs/001-superintelligence-homepage/spec.md),
governed by the [constitution](.specify/memory/constitution.md). Both builds must meet every
requirement.

| ID | Required feature | Spec requirements |
|----|------------------|-------------------|
| F1 | A feed of superintelligence stories, fetched on a schedule from at least 8 public sources across at least 5 kinds. General AI news is left out. | REQ-001 to REQ-003 |
| F2 | The same paper or announcement from several sources shows as one story listing every source. | REQ-004 |
| F3 | Each story shows its superintelligence topics and the words that matched. | REQ-005 |
| F4 | No Twitter/X; stories link out to the original; one failing source doesn't break the feed. | REQ-006 to REQ-008 |
| F5 | Users can sign up, sign in and sign out, and stay signed in between visits. Passwords are never readable. | REQ-009 to REQ-012 |
| F6 | Signed-in users can vote on and save stories. Votes and saves are kept per user, survive sign-out and redeploys, and only the owner can change them. | REQ-013 to REQ-016 |
| F7 | Readers can filter by superintelligence topic, on a laptop or a phone. | REQ-017, REQ-018 |
| F8 | Deployed at a public URL and shared with the class at least 2 weeks before the presentation. | REQ-019 |
| F9 | Feed text is shown as plain text; every page says the content is not investment advice; everything works with a keyboard alone. | REQ-021 to REQ-023 |

**Out of scope:** general AI news that isn't about superintelligence, notes, reading lists, a
weekly brief, user-suggested sources, email digests, AI-written summaries, social media
scraping, hosting full article text and real-time chat. Extra features are allowed but earn no
points (see Section 5).

## 3. Fairness rules

| Must stay the same | May differ |
|--------------------|------------|
| Constitution, spec version and required features (F1–F8) | Agent tool and prompts |
| Superintelligence topics and their key phrases (spec, Requirements), which decide what counts as superintelligence | Programming language and framework |
| The same test data for both builds: saved copies of real feeds plus a few hand-made items (including general AI items that should be filtered out), and made-up test users. Test data never reaches the live site. | Architecture, API design and internal database schema |
| Acceptance tests in Section 4 | Visual design and page layout |
| Hosting: Vercel with Neon Postgres, with a separate database for each build; spending: $10 a month total for both builds, free tiers where possible | Which sources each build uses, as long as F1 is met |

- **Starting points differ, and we say so:** John starts from his earlier build (json-render views
  and ontology tagging); Matt starts from the spec. The comparison reports this, and human effort
  is scored on time spent after this contract is approved.
- **Independent work:** we don't copy code or prompts from each other's build until scoring
  starts (milestone M3).
- **Shared questions:** if the spec is unclear, we settle it here, and both builds follow the
  answer.
- **Effort tracking:** each partner logs hours spent, and every time they had to correct or
  redirect an agent goes in [`AGENT_LOG.md`](AGENT_LOG.md).
- **Errors:** every failure the user sees is a sentence a person can act on, and never shows
  internal details.

## 4. Acceptance tests

Each test runs against the deployed app using the shared sample data. For now we run them by hand
at each milestone and record the results in the comparison; running them automatically on every
change is planned for after the Nov 18 class on CI/CD.

| ID | Feature | Starting point and action | Expected result |
|----|---------|---------------------------|-----------------|
| AT-01 | F1 | Sample data from 8 sources across 5 kinds has been fetched; a visitor opens the feed. | Stories from all 8 sources appear, newest first. |
| AT-02 | F1 | The sample data includes an item about a new AI photo-editing app. | That item does not appear in the feed. |
| AT-03 | F2 | The same sample paper appears in three sources. | It appears once, listing all three sources. |
| AT-04 | F3 | A sample story mentions "AGI timelines". | It shows the Forecasting & timelines topic and the matched words "AGI timelines". |
| AT-05 | F4 | A sample source includes a link to Twitter/X. | That item does not appear. |
| AT-06 | F4 | One sample source is unreachable. | The rest of the feed still loads. |
| AT-07 | F5 | A new user signs up with an unused username. | The account is created and the user is signed in. |
| AT-08 | F5 | A user signs up with a username already in use. | Sign-up fails with a clear message, and no duplicate account is created. |
| AT-09 | F5 | A signed-in user closes the browser and returns the next day. | They are still signed in. |
| AT-10 | F6 | User A votes on a story, signs out and signs back in. | The vote is still counted and shown as A's. |
| AT-11 | F6 | Users A and B each save different stories. | Each sees only their own saved stories. |
| AT-12 | F6 | User A sends a request to remove user B's vote, directly to the server. | The request is refused, and B's vote does not change. |
| AT-13 | F7 | A reader filters by Alignment, then opens the site on a phone. | Only Alignment stories appear, with no sideways scrolling. |
| AT-15 | F9 | A sample item's summary contains a script tag and an image tag. | The tags appear as plain text, and nothing runs or loads. |
| AT-16 | F9 | A visitor opens any page. | The page shows the "for information only, not investment advice" notice. |
| AT-17 | F9 | A reader uses only the keyboard to filter by topic, sign in, vote and save. | Every action works, and the reader can always see where they are on the page. |
| AT-14 | F8 | A classmate opens the public URL and signs up. | They can sign up and see the feed in under 2 minutes, with no help. |

## 5. Comparison criteria

We agree on these criteria and weights before either of us starts building (milestone M1).

| Criterion | Weight | How we measure it |
|-----------|--------|-------------------|
| Acceptance tests | 30 | Percentage of AT-01 through AT-17 passed on the deployed app |
| Superintelligence relevance | 20 | The same three classmates who test usability each judge 20 stories from each live feed, without being told which build is which; score is the share judged to be about superintelligence (spec SC-004 asks for at least 9 in 10) |
| Security | 15 | Each partner tests the other's build for sign-in, password and ownership issues (REQ-011, REQ-016); score based on the number and severity of issues |
| Maintainability | 15 | Each partner adds one small agreed change to the other's build. Score: 5 points each for finishing in under an hour, all acceptance tests still passing afterwards, and needing no help from the build's owner |
| Human effort | 10 | Hours spent and number of agent corrections, from each partner's log |
| Usability | 10 | Three classmates complete the same task on each build; score based on success rate and feedback |
| **Total** | **100** | |

## 6. Choosing the final version

Dates are set once Paul confirms our presentation date.

| # | Milestone | What must be true | Decision |
|---|-----------|-------------------|----------|
| M1 | Contract approved | Both partners approve this contract, including the criteria and weights | Freeze scope and criteria; building starts |
| M2 | Both builds live | Both builds are deployed and pass AT-01 through AT-09 and AT-15 | Cut extras if either build is behind |
| M3 | Both builds complete | Both builds are feature-complete; code and prompts are shared for scoring | Scoring starts; criteria and weights are locked |
| M4 | Final version chosen and shared | Scores are final; the merged version is deployed and shared with the class at least 2 weeks before the presentation | Open to the class |

- **How we pick:** a decision model (CLEF or JEV) scores both builds against Section 5 and
  recommends one build as the base, or a merge. We both sign off or override, and the decision,
  its scores and our reason go in the changelog as a new version.
- **Tiebreaker:** if the totals are within 5 points, the higher Superintelligence relevance score
  decides.
- **Merging:** we may move up to two features or fixes from the other build into the base, then
  rerun all acceptance tests.
- **Falling behind:** if one build is still missing required features at a milestone where the
  other build has them, the further-along build becomes the base, and the partner who's behind
  switches to adding features and tests to it.
- The final report includes both sets of scores and explains what the comparison did and did not
  show.

## 7. How this contract changes

- Either partner proposes a change; the other must approve it, including any change drafted by an
  agent. Each change gets a row in the changelog.
- Any change to the scope or tests applies to both builds, with an agreed date for updating them.
- Criteria and weights cannot change after scoring begins at M3.
- Major changes, which remove or redefine a required feature or test, increase the first version
  number (1.0 to 2.0). Smaller additions or clarifications increase the second (1.0 to 1.1).

## 8. Changelog

| Version | Date | Person | Change(s) |
|---------|------|--------|-----------|
| 0.1 | Nov 4, 2026 | John | First draft in our shared plan doc: data models, API, auth, rules and milestones. Project choice was a mix of split and bake-off. |
| 0.2 | Nov 5, 2026 | Matt | Chose a pure bake-off; drafted required features from John's first build. |
| 0.3 | Nov 6, 2026 | Matt | Shared spec written with Spec Kit; required features point to its requirement IDs. |
| 0.4 | Nov 6, 2026 | Matt | Site focuses on superintelligence specifically, not AI in general; only superintelligence stories appear in the feed. |
| 0.5 | Nov 7, 2026 | Matt | Agent log is a human-written file in the repo (`AGENT_LOG.md`), not an app page. |
| 0.6 | Nov 11, 2026 | Matt | Final version chosen by a decision model (CLEF or JEV) plus both partners' sign-off; each build in its own folder. |
| 1.0 | Nov 11, 2026 | Matt | Rewrote as a full bake-off contract following the course's Example B: the two builds, shared scope, fairness rules, acceptance tests AT-01 to AT-14, weighted comparison criteria, milestones and tiebreaker. Dropped the split-only parts of John's draft (shared API and data models), since in a bake-off each build designs its own. |
| 1.1 | Nov 11, 2026 | Matt | Removed the `shared/sample-data/` folder requirement; described the test data in plain terms. |
| 1.2 | Nov 13, 2026 | Matt | Changes from peer review: key phrases now decide what counts as superintelligence and are fixed for both builds; new feature F9 (plain-text feed content, not-investment-advice notice, keyboard access) with tests AT-15 to AT-17; a separate database per build; relevance judged by three classmates who don't know which build is which; a points rubric for maintainability; note that tests are run by hand until after the CI/CD class. |
