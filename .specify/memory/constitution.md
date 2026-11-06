# Superintelligence Homepage Constitution

## Core Principles

### I. Simplicity First

The simplest solution that meets the spec wins.

- Builds MUST NOT add services, abstractions or dependencies that no requirement needs.
- Scope MUST stay small enough for two students to finish within the course timeline.
- When two approaches both meet the spec, choose the one with less code and fewer moving parts.

Rationale: agents make extra scope cheap to write but expensive to review, test and deploy.

### II. Spec First and Traceable

The spec defines what to build before any code is written.

- Every requirement MUST have a stable ID (REQ-001, REQ-002, ...).
- Plans, tasks, code changes and tests MUST name the requirement IDs they satisfy.
- Work that traces to no requirement MUST NOT be built until the spec is updated to include it.

Rationale: traceability is how we prove each build does what the spec says, and nothing else.

### III. Test What the Spec Says

- Every requirement MUST have at least one acceptance test written as Given / When / Then.
- Tests MUST be grouped by requirement ID so each requirement's coverage is visible.
- Tests MUST use synthetic data only: made-up users and recorded or sample feeds.
- A change MUST NOT be merged while any acceptance test fails.

Rationale: shared acceptance tests are what make the two bake-off builds comparable.

### IV. Accounts and Data Are Safe

- Passwords MUST NOT be stored or logged in plain text.
- Users MUST be able to change or delete only what they created, and the server MUST enforce
  this, not just the user interface.
- Secrets (API keys, database credentials) MUST NOT be committed to the repository or pasted
  into AI prompts; they live in the hosting platform's environment settings.
- The app MUST NOT store personal data beyond what accounts need to work.

Rationale: accounts and multi-user persistence are a course requirement, and classmates will
sign up on the live site.

### V. Open Sources Only

- Content MUST come from public feeds or public pages, and MUST link out to the original.
- Twitter/X MUST NOT be used as a source, suggested as a source, or accepted as a submitted link.
- The app MUST NOT host full copies of articles.

Rationale: the point of the site is broad, platform-independent coverage of AI progress.

## Bake-off Rules

Project 2 is a platform bake-off: Matt (Claude Code) and John (v0) each build the whole app from
this constitution and the shared spec, then compare the builds and merge the best parts.

- **Fixed for both builds:** this constitution, the shared spec, its requirement IDs, its
  acceptance tests and the list of required features.
- **May differ between builds:** platform, AI tools, language, framework, database, hosting,
  internal code structure and visual styling.
- This constitution MUST NOT choose a technology stack; each partner records theirs in their
  own `/speckit-plan`.
- Comparison criteria and how the final version is chosen are recorded in `CONTRACT.md` before
  either build is compared.
- **Costs:** use free tiers where possible. Total spending on hosting and AI APIs MUST stay at or
  under $10 a month unless both partners agree to raise it.

## Development Workflow

- Work happens on branches; `main` stays deployable.
- The other partner reviews every pull request, and a human reviews every merge to `main`.
- Agents MAY read code, run tests, write code on a branch and draft pull requests.
- Agents MUST NOT merge to `main`, deploy, handle real secrets or spend money.
- Each partner keeps an agent log in their own words: what the agent got wrong, how it was
  caught, and the fix. Partners do not write each other's entries, and entries are not
  AI-generated.

## Governance

- This constitution overrides other project practices where they conflict.
- Changes require approval from both partners and a note in the pull request that makes them.
- Versioning follows MAJOR.MINOR.PATCH: MAJOR for removing or redefining a principle, MINOR for
  adding a principle or section, PATCH for wording fixes.
- Every spec, plan and pull request review checks compliance with these principles; any
  exception must be written down with its reason.

**Version**: 1.0.0 | **Ratified**: 2026-11-06 | **Last Amended**: 2026-11-06
