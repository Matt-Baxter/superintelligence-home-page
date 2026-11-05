# Contract

_What we're building against._

**Team:** Matt Baxter & John Affolter
**Current version:** 0.2
**Date:** _YYYY-MM-DD_
**Option:** Bake-off (Option B: partners build from the same spec on different platforms, then compare and merge the best parts)

## Change log

Both partners approve every change, and every change gets logged here.

| Version | Date | Change | Approved by |
|---------|------|--------|-------------|
| 0.1 | _YYYY-MM-DD_ | Initial draft | _Matt, John_ |
| 0.2 | 2026-11-05 | Chose the bake-off option; removed the split section; drafted required features from the current build | _Matt, John_ |

## Bake-off

### Purpose

Keeps the comparison fair.

- **Partner 1 platform:** _Matt: ..._
- **Partner 2 platform:** _John: ..._

### Core content: One shared spec

_Link to the shared spec (SpecKit), plus a summary here._

#### Required features

_Draft, based on what's in John's first build (see README). Confirm or cut together._

1. **Accounts:** sign up, log in, log out
2. **Multi-user persistence:** each user's votes, saves, notes and reading lists are saved and kept separate per user
3. **Multi-source feed:** pulls from multiple AI research sources (papers, lab blogs, forums, newsletters); no Twitter/X
4. **Story grouping:** the same paper or announcement from several sources shows as one story
5. **Topic tags:** stories are tagged by topic and organization, and show why a tag was applied
6. **Curation:** votes, saves, notes, reading lists, submitted links
7. **Weekly brief:** top stories and per-topic activity compared with last week
8. **Sources page:** lists feeds and their status; users can suggest new feeds
9. **Agent log:** each partner records what the agent got wrong and how they caught it
10. **Deployed:** publicly reachable URL shared with the class 1–2 weeks before the presentation

#### Acceptance tests

| # | Feature | Given / When / Then | Matt's build | John's build |
|---|---------|---------------------|--------------|--------------|
| 1 | _Sign up_ | _Given a new email, when I sign up, then I'm logged in_ | ☐ | ☐ |
| 2 | _..._ | _..._ | ☐ | ☐ |

### Rules

- **Can differ between builds:** _e.g. platform, agent/AI tools, UI styling, internal code structure_
- **Stays fixed:** _e.g. required features, acceptance tests, data model, synthetic data set, time box_

### Decision point

#### Comparison criteria

| Criterion | Weight | Matt's build | John's build |
|-----------|--------|--------------|--------------|
| _Acceptance tests passed_ | _..._ | | |
| _Ease of deployment_ | _..._ | | |
| _Code quality / maintainability_ | _..._ | | |
| _Cost_ | _..._ | | |
| _UX_ | _..._ | | |

#### How we'll choose or merge the final version

_e.g. score both builds, pick the winning base, then port the best parts of the other build._

### Changes

Both partners approve and log them (see [Change log](#change-log)).
