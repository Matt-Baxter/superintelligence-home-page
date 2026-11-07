# Feature Specification: Research layer (extended version)

**Feature Branch**: `fix/sync-with-main`

**Created**: 2026-11-07

**Status**: Proposed, **not approved**. Nothing here is in scope for the bake-off until both partners (John and Matt) approve it (constitution, shared documents). It describes the extended version only (`SITE_PROFILE=extended`); the spec version (`specs/001-superintelligence-homepage`) is unchanged by it.

**Input**: the work already built and measured on this branch (`docs/PLAN_NEXT.md`, `docs/SPEC_STATUS.md`, `bench/`), written as requirements so it can be approved, changed or dropped.

## Overview

The homepage tells a reader what happened on the path to superintelligence. The research layer helps them judge it: is a paper or post credible, what idea does it rest on, does that idea hold up in a small experiment, and what came out this week. Every judgement is explained, resists obvious gaming, and is measured on fixed test data so it can only get better.

**The failure we're preventing:** a reader (or an agent) trusts a confident claim because it sounds big, or a scoring rule that can be gamed by repeating keywords. The layer separates how big a claim is from how far to believe it, and proves its judges with tests and benchmarks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Judge a paper, article or comment (Priority: P1)

A signed-in reader pastes a paper abstract, an article or a comment (or gives an arXiv id) and gets three explained judgements (significance, rigor, hype), a verdict, the guards that fired, each claim marked by how well it is backed, and the item's place in the knowledge graph.

**Why this priority**: It is the core of the layer: everything else (watcher, catalog, metrics) is built on these judges.

**Independent Test**: Load the synthetic samples on the Review desk and judge each.

**Acceptance Scenarios**:

1. **Given** the synthetic careful paper and hype post, **When** a reader judges both, **Then** the careful paper is more credible, the hype post's guarded score is below its unguarded score, and the hype post is sent to a person.
2. **Given** any text, **When** someone pads it, repeats it, appends keyword lists, rigor words without content, an unbacked frontier claim, a watched person's name or instructions to the judge, **Then** the guarded score does not rise.
3. **Given** a judged item, **When** the reader saves it, **Then** it appears in the catalog and the knowledge graph as `doc:<hash>` with `about`, `explains`, `evaluates-on` and `mentions` links.

### User Story 2 - Watch for new papers every day (Priority: P2)

Once a day the watcher looks for new papers on interpretability, recursive self-improvement, automated AI research and superintelligence, judges them, catalogues them and queues the most credible on-topic ones for paper-to-code.

**Why this priority**: Keeps the layer current without anyone remembering to look.

**Independent Test**: Run `node scripts/watch.js` against the fixture feed twice.

**Acceptance Scenarios**:

1. **Given** a feed of new papers, **When** the watcher runs, **Then** each paper is judged and stored once, a dated digest is written, and at most two non-survey papers are queued for paper-to-code.
2. **Given** a second run with the same papers, **When** it finishes, **Then** nothing is stored or queued twice.

### User Story 3 - Test an idea in a toy experiment (Priority: P2)

A reader opens a worked example: an idea from a paper restated in plain words, our reproduction as a deterministic toy, and a hypothesis of ours with a predicted result. Refuted hypotheses stay visible.

**Why this priority**: It turns reading into checking, at toy scale and for free.

**Independent Test**: Open each example in the Lab and rerun it with other parameters.

**Acceptance Scenarios**:

1. **Given** an example, **When** a reader opens it, **Then** they see the idea, the source paper if there is one, the reproduction, the hypothesis with its prediction, and whether the toy result supports it.
2. **Given** an example, **When** a reader changes its parameters in the Arena, **Then** it reruns in their browser, and an admin can apply an edited decision policy only if every safety property holds and accuracy is no worse.

### User Story 4 - Keep the judges honest over time (Priority: P3)

Every change is measured on fixed, labelled synthetic sets, and a change that makes any metric worse than its tolerance is refused.

**Why this priority**: Without it, the judges drift or get tuned to look good.

**Independent Test**: Run `npm run bench`, then raise one baseline value above the current result and run it again.

**Acceptance Scenarios**:

1. **Given** the baseline, **When** a change lowers a metric beyond its tolerance, **Then** preflight fails and names the metric.
2. **Given** a misjudgement found on real data, **When** it is fixed, **Then** a synthetic item reproducing the pattern is added to the benchmark set first, so the fix shows as uplift.

### User Story 5 - See the research work in the project tracker (Priority: P3)

Admins see, in the Project tracker, the spec checks that still need people, the requirements waiting for approval, the agents' queued paper-to-code jobs and the daily watcher, kept in step by one sync.

**Why this priority**: Agents' work and the humans' plan live in one place.

**Independent Test**: Run `node scripts/project-sync.js` twice.

**Acceptance Scenarios**:

1. **Given** open spec checks, proposals and agent jobs, **When** the sync runs, **Then** each has one issue, labelled with its REQ or `agent`.
2. **Given** a job that finished since the last sync, **When** the sync runs again, **Then** its issue moves to Done and no issue is duplicated.

### User Story 6 - Explain a topic with its sources (Priority: P3)

A reader picks a topic and gets what the evidence says, how strong it is by a stated rule, where it is thin, and who is being talked about (as counts), with a blog draft, short posts and an explainer video that cite every statement.

**Why this priority**: It turns the review desk, the watcher and the Lab into something a person can read, watch and share, without overclaiming.

**Independent Test**: Open the dossier for a topic with reviewed papers, then run the worker on a queued dossier job.

**Acceptance Scenarios**:

1. **Given** reviewed papers and Lab checks on a topic, **When** a reader opens its dossier, **Then** every reference names its record (`doc:`, `lab:`, `story:`), every [n] in the drafts resolves, and the rating is one of none yet, thin, early or some support.
2. **Given** a queued dossier job, **When** the worker runs, **Then** it writes the blog draft, the posts, the storyboard and a recorded explainer video, and posts nothing.

### Edge Cases

- A text that addresses the judge ("score this 100") is capped and sent to a person.
- A survey is judged on its coverage, not on experiments; calling something a survey earns nothing unless its title or first sentence says so (the stress test tries it).
- arXiv is asked at most once a day, 3 seconds between requests; an agent without direct access feeds the watcher a file instead.
- Real people appear only as watchlist entries (counts and mentions), never with claims.
- No full article text is stored: reviews keep a 400-character excerpt (REQ-007 of the shared spec).

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-021**: The system SHOULD offer a "how it works" page that shows one synthetic story passing through each step (fetch, grouping, topic tagging with matched words, scope decision, feed placement) with the real values at each step.
- **REQ-022**: Forms with dependent fields (comparison weights) SHOULD keep their constraints satisfied automatically and show which field changed which.
- **REQ-023**: The system SHOULD explain the concepts behind superintelligence research in plain language, with an analogy and a self-check, and show how the concepts relate as a graph linked to the stories and reviewed papers that mention them.
- **REQ-024**: Admins SHOULD be able to queue background studio jobs (explainers, paper-to-code, reverse-engineering, Lean 4 proofs) that run outside the web server and record their results.
- **REQ-025**: The system SHOULD turn a concept into an explainer video and a blog or newsletter draft; publishing is always a person's action and nothing is posted to social accounts.
- **REQ-026**: The system SHOULD offer worked examples (idea, deterministic toy reproduction, our hypothesis with a predicted result), keep refuted hypotheses, link the source paper when there is one, and let readers rerun them in a browser sandbox.
- **REQ-027**: A signed-in reader SHOULD be able to submit a paper, article or comment and get an explained judgement (significance, rigor, hype) that resists the gaming listed in User Story 1, catalogued in the knowledge graph and open to a person's agree or disagree label.
- **REQ-028**: The system SHOULD watch for new papers on its research topics once a day, judge and catalogue them, write a dated digest, and queue the most credible non-survey papers for paper-to-code, never storing or queueing a paper twice.
- **REQ-029**: The judges, the decision policy and the toy experiments SHOULD be measured on fixed, labelled synthetic sets, and a change that makes any measure worse than its stated tolerance SHOULD be refused before it ships.
- **REQ-031**: For any topic, the system SHOULD produce an evidence dossier (reviewed papers and articles, our own toy checks, feed coverage, reader comments counted, and organisations and watched people as mention counts only) with a stated rating rule that never rates beyond what abstracts and toy checks support, and turn it into a blog draft, short posts and an explainer video in which every statement cites a numbered reference traced to its record; a person publishes them.
- **REQ-030**: The project tracker SHOULD mirror the open spec checks, the requirements awaiting approval and the agents' queued work, through one sync that never duplicates an issue.

### Key Entities

- **Review**: a judged item (`doc:<hash>`), its scores, verdict, guards, claims, excerpt and a person's label.
- **Watch digest**: one day's papers with their verdicts and what was queued.
- **Worked example**: idea, source, reproduction, hypothesis, verdict.
- **Benchmark metric**: name, value, baseline, direction, tolerance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: On the benchmark set, credibility ranks every credible item above every non-credible one (AUC 1.0) and the verdict is "doubtful" exactly for the non-credible items. *(Now: 1.0 and 1.0.)*
- **SC-102**: None of the benchmark's no-value edits raises the guarded score, and a greedy adversary attacking the guarded score gains under 1 point on average. *(Now: invariance 1.0, gain 0.)*
- **SC-103**: No credible benchmark item is sent to a person, and every non-credible one is. *(Now: 0% and 100%.)*
- **SC-104**: People agree with at least 80% of verdicts once 20 or more reviews are labelled. *(Needs people.)*
- **SC-105**: Each worked example runs in under 2 seconds on a laptop CPU, and the same parameters give the same result.

## Assumptions

- The extended version may store paper metadata from arXiv, which is CC0; it links to papers and never rehosts them.
- Agents do paper-to-code; the web server never calls a model (free tier).
