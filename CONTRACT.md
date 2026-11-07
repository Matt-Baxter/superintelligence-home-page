# Contract

_What we're building against._

**Team:** Matt Baxter & John Affolter
**Current version:** 0.5
**Date:** _YYYY-MM-DD_
**Option:** Bake-off (Option B: partners build from the same spec on different platforms, then compare and merge the best parts)

## Change log

Both partners approve every change, and every change gets logged here.

| Version | Date | Change | Approved by |
|---------|------|--------|-------------|
| 0.1 | _YYYY-MM-DD_ | Initial draft | _Matt, John_ |
| 0.2 | 2026-11-05 | Chose the bake-off option; removed the split section; drafted required features from the current build | _Matt, John_ |
| 0.3 | 2026-11-06 | Shared spec created with Spec Kit; required features now point to its REQ IDs | _Matt, John_ |
| 0.4 | 2026-11-06 | Site focuses on superintelligence specifically, not AI in general; only superintelligence stories in the feed (new REQ-003); requirements renumbered | _Matt, John_ |
| 0.5 | 2026-11-07 | Agent log is a human-written Markdown file in the repo (`AGENT_LOG.md`), not an app page | _Matt, John_ |

## Bake-off

### Purpose

Keeps the comparison fair.

- **Partner 1 platform:** Matt: Claude Code
- **Partner 2 platform:** John: v0

### Core content: One shared spec

The shared spec is [`specs/001-superintelligence-homepage/spec.md`](specs/001-superintelligence-homepage/spec.md),
governed by the [constitution](.specify/memory/constitution.md). It is the source of truth; the
list below is a summary. Both builds must meet every REQ in the spec.

#### Required features

| Area | Requirements |
|------|--------------|
| Superintelligence feed: 8+ superintelligence sources across 5+ kinds, only superintelligence stories, grouping, topics with reasons, no Twitter/X | REQ-001 to REQ-008 |
| Accounts: sign up, sign in/out, stay signed in, passwords never readable | REQ-009 to REQ-012 |
| Votes and saves, kept per user, enforced by the system | REQ-013 to REQ-016 |
| Filter by superintelligence topic; works on laptop and phone | REQ-017, REQ-018 |
| Live at a public URL 2+ weeks before the presentation | REQ-019 |
| Agent log: human-written `AGENT_LOG.md` in the repo | REQ-020 |

#### Acceptance tests

The acceptance scenarios (Given / When / Then) are in the spec, grouped by user story. Each
build tracks its results here:

| User story | Requirements | Matt's build | John's build |
|------------|--------------|--------------|--------------|
| 1. Read a superintelligence feed | REQ-001 to REQ-008 | ☐ | ☐ |
| 2. Create an account and stay signed in | REQ-009 to REQ-012 | ☐ | ☐ |
| 3. Vote on and save superintelligence stories | REQ-013 to REQ-016 | ☐ | ☐ |
| 4. Filter by superintelligence topic | REQ-017, REQ-018 | ☐ | ☐ |

### Rules

- **Can differ between builds:** platform, AI tools, language, framework, database, hosting, internal code structure, visual styling
- **Stays fixed:** the constitution, the shared spec and its REQ IDs, the acceptance scenarios, the synthetic test data, the deadline

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
