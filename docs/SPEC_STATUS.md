# Spec status

Measured on 2026-11-07 by `scripts/spec-status.js`, from the spec acceptance suite (`test/spec-acceptance.js --browser`, 47 of 47 checks passing) against the **spec version** of the site with labelled synthetic sources. Regenerate with `npm run spec:status`.

## Summary

| Part of the spec | Automated and passing | Needs people | Open or failing |
| --- | --- | --- | --- |
| Functional requirements (20) | 18 (90%) | 2 | 0 |
| Acceptance scenarios (19) | 19 (100%) | 0 | 0 |
| Success criteria (8) | 5 (63%) | 3 | 0 |

**What's left is delivery, not building:** REQ-019, REQ-020, SC-001, SC-004, SC-008 can only be confirmed by people on the live site. That needs this branch merged, deployed and shared with the class. Everything else in the spec passes an automated check.

## Requirements

| REQ | Status | Checks | Requirement |
| --- | --- | --- | --- |
| REQ-001 | Pass | 2 | The system MUST fetch items automatically, on a schedule, from at least 8 public sources that regularly cover superintelligence, across at l… |
| REQ-002 | Pass | 2 | The system MUST show a feed of superintelligence stories, newest first, where each story shows its title, the sources that covered it, its s… |
| REQ-003 | Pass | 2 | The system MUST include only items relevant to superintelligence, meaning items that match at least one superintelligence topic, and MUST le… |
| REQ-004 | Pass | 1 | The system MUST show the same paper or announcement from several sources as one story listing every source. |
| REQ-005 | Pass | 3 | The system MUST tag each story with the superintelligence topics it matches and MUST show the words that caused each tag, so readers can see… |
| REQ-006 | Pass | 3 | The system MUST NOT use Twitter/X as a source and MUST NOT show or accept links to it. |
| REQ-007 | Pass | 2 | The system MUST link out to the original source and MUST NOT host full article text. |
| REQ-008 | Pass | 1 | A failing source MUST NOT stop the rest of the feed from loading. |
| REQ-009 | Pass | 2 | Visitors MUST be able to create an account with a unique username and a password. |
| REQ-010 | Pass | 3 | Users MUST be able to sign in and sign out, and MUST stay signed in between visits until they sign out. |
| REQ-011 | Pass | 1 | The system MUST NOT store or display passwords in readable form. |
| REQ-012 | Pass | 2 | The system MUST NOT collect personal data beyond a username and password. |
| REQ-013 | Pass | 3 | Signed-in users MUST be able to vote on a story, at most once per story, and remove their vote. |
| REQ-014 | Pass | 4 | Signed-in users MUST be able to save and unsave stories and view their saved list. |
| REQ-015 | Pass | 1 | Votes and saves MUST be kept per user and still be there after signing out and after the site is redeployed. |
| REQ-016 | Pass | 1 | Users MUST only be able to change their own votes and saves, and this MUST be enforced by the system, not only hidden in the interface. |
| REQ-017 | Pass | 5 | Readers MUST be able to filter the feed by superintelligence topic. |
| REQ-018 | Pass | 4 | The feed MUST be usable on a laptop and a phone without sideways scrolling. |
| REQ-019 | People check | — | The Superintelligence Homepage MUST be live at a public URL and shared with the class at least 2 weeks before our presentation. *(Live at a public URL, shared with the class 2 weeks before the presentation: a deployment fact (merge, deploy, share the link).)* |
| REQ-020 | People check | 1 | Each partner MUST keep a human-written agent log in the repository (`AGENT_LOG.md`) answering "What did the agent get wrong & how did you ca… *(Each partner keeps a human-written agent log in AGENT_LOG.md: the file exists (the automated check), but it has no entries yet. Only Matt and John can write them; agents must not.)* |

## Acceptance scenarios

| Scenario | Status | Story |
| --- | --- | --- |
| US1-1 | Pass | Read a superintelligence feed |
| US1-2 | Pass | Read a superintelligence feed |
| US1-3 | Pass | Read a superintelligence feed |
| US1-4 | Pass | Read a superintelligence feed |
| US1-5 | Pass | Read a superintelligence feed |
| US1-6 | Pass | Read a superintelligence feed |
| US2-1 | Pass | Create an account and stay signed in |
| US2-2 | Pass | Create an account and stay signed in |
| US2-3 | Pass | Create an account and stay signed in |
| US2-4 | Pass | Create an account and stay signed in |
| US2-5 | Pass | Create an account and stay signed in |
| US3-1 | Pass | Vote on and save superintelligence stories |
| US3-2 | Pass | Vote on and save superintelligence stories |
| US3-3 | Pass | Vote on and save superintelligence stories |
| US3-4 | Pass | Vote on and save superintelligence stories |
| US3-5 | Pass | Vote on and save superintelligence stories |
| US3-6 | Pass | Vote on and save superintelligence stories |
| US4-1 | Pass | Filter by superintelligence topic |
| US4-2 | Pass | Filter by superintelligence topic |

## Success criteria

| SC | Status | Criterion |
| --- | --- | --- |
| SC-001 | People check | A classmate can sign up on the live site and see the superintelligence feed in under 2 minutes, with no help. *(A classmate signs up and sees the feed in under 2 minutes: time it with a real classmate on the live site.)* |
| SC-002 | Pass | The feed shows superintelligence stories from at least 8 sources across at least 5 kinds. |
| SC-003 | Pass | In the synthetic test data, 100% of items labelled "not about superintelligence" are left out of the feed, and 100% of items labelled "about superinte |
| SC-004 | People check | On the live site, at least 9 of every 10 stories in a sample of 20 are judged by both partners to be about superintelligence. *(9 of every 10 stories in a live sample of 20 judged on-topic by both partners: do it on the live feed.)* |
| SC-005 | Pass | In the synthetic test data, 100% of known duplicate papers appear as one story. |
| SC-006 | Pass | 100% of stories show the words that made them superintelligence-related. |
| SC-007 | Pass | After signing out and back in, and after a redeploy, 100% of a user's votes and saves are still there. |
| SC-008 | People check | Every requirement above has at least one passing acceptance test in each partner's build. *(Each partner's build has a passing test for every requirement: this build does (every testable REQ above); run the same suite against Matt's build.)* |

## Beyond the spec

The extended version (`SITE_PROFILE=extended`) adds work that serves no REQ. It is listed with proposed requirements in `docs/PLAN_NEXT.md` and `docs/FUTURE_IDEAS.md`, and none of it is needed for the bake-off.
