<!-- Sync Impact Report: 1.1.2 → 1.2.0 (MINOR, proposed, not yet in effect). Development Workflow: review is encouraged, not required (John and Matt agreed review is optional); PRs name REQ IDs and the trace in docs/SPEC_TRACE.md. Proposed by John on 2026-11-06; Matt to confirm in CONTRACT.md (v0.6 row). -->
# Superintelligence Homepage Constitution

The Superintelligence Homepage is a home page for articles about superintelligence: progress
toward AGI and superintelligence, and the work on making superintelligence safe and well
governed. It is not a general AI news site.

## Core Principles

### I. Superintelligence Focus

Every story on the site MUST be relevant to superintelligence.

- In scope: progress toward AGI and superintelligence, frontier capabilities, automating AI
  research, recursive self-improvement, alignment and safety of superintelligent systems,
  interpretability, forecasts and timelines, compute and scaling, and governance of frontier AI.
- Out of scope: general AI news, such as product launches, everyday AI apps, and AI applied to a
  particular industry, unless it bears directly on the path to superintelligence.
- Readers MUST be able to see why each story counts as superintelligence-related.
- When in doubt, leave a story out. A smaller, on-topic superintelligence feed beats a larger,
  noisy AI feed.

Rationale: the site's value is that it stays on one subject. Broad AI news is easy to find elsewhere.

### II. Simplicity First

The simplest solution that meets the spec wins.

- Builds MUST NOT add services, abstractions or dependencies that no requirement needs.
- Scope MUST stay small enough for two students to finish within the course timeline.
- When two approaches both meet the spec, choose the one with less code and fewer moving parts.

Rationale: agents make extra scope cheap to write but expensive to review, test and deploy.

### III. Spec First and Traceable

The spec defines what to build before any code is written.

- Every requirement MUST have a stable ID (REQ-001, REQ-002, ...).
- Plans, tasks, code changes and tests MUST name the requirement IDs they satisfy.
- Work that traces to no requirement MUST NOT be built until the spec is updated to include it.

Rationale: traceability is how we prove each build does what the spec says, and nothing else.

### IV. Test What the Spec Says

- Every requirement MUST have at least one acceptance test written as Given / When / Then.
- Tests MUST be grouped by requirement ID so each requirement's coverage is visible.
- Tests MUST use synthetic data only: made-up users and recorded or sample feeds, including
  sample items that are about superintelligence and sample items that are not.
- A change MUST NOT be merged while any acceptance test fails.

Rationale: shared acceptance tests are what make the two bake-off builds comparable.

### V. Accounts and Data Are Safe

- Passwords MUST NOT be stored or logged in plain text.
- Users MUST be able to change or delete only what they created, and the server MUST enforce
  this, not just the user interface.
- Secrets (API keys, database credentials) MUST NOT be committed to the repository or pasted
  into AI prompts; they live in the hosting platform's environment settings.
- The app MUST NOT store personal data beyond what accounts need to work.

Rationale: accounts and multi-user persistence are a course requirement, and classmates will
sign up on the live site.

### VI. Open Sources Only

- Superintelligence content MUST come from public feeds or public pages, and MUST link out to
  the original.
- Twitter/X MUST NOT be used as a source, suggested as a source, or accepted as a submitted link.
- The app MUST NOT host full copies of articles.

Rationale: serious superintelligence writing lives in papers, research blogs and forums, and the
site must not depend on any one platform.

## Bake-off Rules

Project 2 is a platform bake-off: Matt (Claude Code) and John (v0) each build the whole
Superintelligence Homepage from this constitution and the shared spec, then compare the builds
and merge the best parts.

- **Fixed for both builds:** this constitution, the shared spec, its requirement IDs, its
  acceptance tests, the list of required features and the superintelligence topic list.
- **May differ between builds:** platform, AI tools, language, framework, database, hosting,
  internal code structure and visual styling.
- This constitution MUST NOT choose a technology stack; each partner records theirs in their
  own `/speckit-plan`.
- Comparison criteria and how the final version is chosen are recorded in `CONTRACT.md` before
  either build is compared. How well each build keeps the feed on superintelligence is one of
  the criteria.
- **Costs:** use free tiers where possible. Total spending on hosting and AI APIs MUST stay at or
  under $10 a month unless both partners agree to raise it.

## Development Workflow

- Work happens on branches; `main` stays deployable.
- **[Proposed in 1.2.0, Matt to confirm]** Review by the other partner is helpful and encouraged, not required: a partner may merge their own pull request once the automated checks (preflight) pass. Agents never merge to `main`.
- Pull requests name the REQ IDs they serve, and `docs/SPEC_TRACE.md` maps every requirement to the code and tests that meet it.
- Agents MAY read code, run tests, write code on a branch and draft pull requests.
- Agents MUST NOT merge to `main`, deploy, handle real secrets or spend money.
- Each partner keeps an agent log in their own words in `AGENT_LOG.md`: what the agent got wrong, how it was
  caught, and the fix. Partners do not write each other's entries, and entries are not
  AI-generated.

## Governance

- This constitution overrides other project practices where they conflict.
- Changes require approval from both partners and a note in the pull request that makes them.
- Versioning follows MAJOR.MINOR.PATCH: MAJOR for removing or redefining a principle, MINOR for
  adding a principle or section, PATCH for wording fixes.
- Every spec, plan and pull request review checks compliance with these principles, starting
  with the superintelligence focus; any exception must be written down with its reason.

**Version**: 1.1.2 ratified; 1.2.0 proposed (see the Sync Impact Report above) | **Ratified**: 2026-11-06 | **Last Amended**: 2026-11-07
