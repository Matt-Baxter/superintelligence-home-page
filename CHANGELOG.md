# Changelog

Project-wide log of changes to the Superintelligence Homepage repo: the working agreement, spec,
constitution, contract, agent log and builds. Newest first. Each entry lists the commit(s) that
made the change. The contract also keeps its own version history in
[`CONTRACT.md`](CONTRACT.md#8-changelog).

**Adding an entry:** commit your change first, then add a row here with that commit's short hash
(`git log --oneline -1`).

| Date | Person | Change | Commit(s) |
|------|--------|--------|-----------|
| 2026-11-14 | Matt (with Claude Code) | Build A User Story 1 (tasks T019–T027): the superintelligence feed. Fetching, filtering, grouping and the feed page; all 11 acceptance tests pass (AT-01 to AT-06, AT-15). | `4451d93` |
| 2026-11-14 | Matt (with Claude Code) | Added singular and plural forms of key phrases (spec v1.4), since whole-word matching meant "frontier model" missed "frontier models". Shared rule: John's build should use the same list. | `17c1ddb` |
| 2026-11-13 | Matt (with Claude Code) | Build A setup and foundation (tasks T001–T018): Next.js project in `builds/matt/`, database schema, topic matching, 11 checked sources across 6 kinds, sample feeds and test setup. | `06f89d9` |
| 2026-11-13 | Matt (with Claude Code) | Build A plan: tests use a throwaway local database with fake data; the live Neon database is added from Vercel's Storage tab at deploy time; database package changed to `postgres` so one codebase works with both. | `2a57749` |
| 2026-11-13 | Matt (with Claude Code) | Task list for Build A via `/speckit-tasks`: 60 tasks in 8 phases, tests first for each user story, ordered so the app is live by M2 (Nov 18); manual steps marked for Matt. | `07e7153` |
| 2026-11-13 | Matt (with Claude Code) | Clarifications from planning: key phrases match as whole words, so "AGI" doesn't match "magic" (spec v1.3, REQ-003); AT-15 now expects nothing to run and the summary to read as plain text (contract v1.4). Build A fetches feeds once a day, the Vercel free plan's limit. | `55ee438` |
| 2026-11-13 | Matt (with Claude Code) | Implementation plan for Build A (Matt's Next.js build) via `/speckit-plan`: plan, research, data model, interface contract and quickstart. | `a470b5d` |
| 2026-11-13 | Matt (with Claude Code) | Set milestone dates from our Dec 9 presentation date: M1 Nov 16, M2 Nov 18, M3 Nov 22, M4 Nov 25 (contract v1.3, spec v1.2). | `5a0a612` |
| 2026-11-13 | Matt (with Claude Code) | Revised spec (v1.1) and contract (v1.2) from peer review: key phrases define what counts as superintelligence; new REQ-021 to REQ-023 (plain-text feed content, not-investment-advice notice, keyboard access) with tests AT-15 to AT-17; new risks R12 to R14; R2 deferred; RLS recommended, not required; blind relevance judging and a maintainability rubric. | `3088688` |
| 2026-11-12 | Matt (with Claude Code) | Risks & Governance updates from class discussion: row-level security (RLS) added as a mitigation for R3; R5 rewritten around superintelligence being a subjective domain with ambiguous definitions; new risks R10 (fearmongering) and R11 (not investment advice). | `68402e5` |
| 2026-11-12 | Matt (with Claude Code) | Added a **Risks & Governance** section to the spec: 9 risks across Data, People, Decisions, Code, Agents, Security and Failure, each with likelihood, impact, mitigation, owner and status. Added this changelog. | `9b32204` |
| 2026-11-11 | Matt (with Claude Code) | Contract v1.1: removed the `shared/sample-data/` folder requirement and described the test data in plain terms. | `3b59b8b` |
| 2026-11-11 | Matt | Working agreement signed by John. | `be957e9` |
| 2026-11-10 | Matt (with Claude Code) | Added Matt's first two agent log entries (written by Matt). | `f4afee1` |
| 2026-11-10 | Matt (with Claude Code) | Contract rewritten as a full bake-off contract (v1.0), following the course's Example B. | `2b318ea` |
| 2026-11-10 | Matt (with Claude Code) | Working agreement filled in from Matt's notes and John's plan doc, then gaps filled: how the final version is picked, build folders, falling behind, review rules. Constitution v1.2.0. | `a0e375b`, `44e5ba9` |
| 2026-11-09 | Matt | Working agreement signed by Matt. | `9881282` |
| 2026-11-07 | Matt (with Claude Code) | Agent log added as a human-written `AGENT_LOG.md`; added automating AI research and recursive self-improvement to the constitution's scope. | `856486f`, `3d24937` |
| 2026-11-06 | Matt | Added automating AI research and recursive self-improvement to the spec's topic list. | `2fe7240` |
| 2026-11-06 | Matt (with Claude Code) | Set up Spec Kit; wrote the constitution and shared spec; refocused both on superintelligence specifically. | `94ebc85`, `43dfd45`, `d4c0386` |
| 2026-11-05 | Matt (with Claude Code) | Added working agreement and contract templates; chose the bake-off option. | `41271ae`, `ce62849` |
| 2026-11-04 | John | First build of the app: multi-source feed, ontology tags, curation, weekly brief, agent log page. | `5d469e6` |
