# Product roadmap: performance, research usefulness and paid-value discovery

Created November 7, 2026. This is the user's requested planning backlog, **not a shared-spec amendment, partner approval, launch commitment or claim that 200 features exist**.

The [canonical backlog](research/product-backlog.json) contains every idea from the two numbered lists: IDEA-001 through IDEA-100 cover performance/usability; IDEA-101 through IDEA-200 cover potential paid value. IDs are permanent even when scope or priority changes. There are 20 epics, with ten ideas in each. Similar ideas remain individually traceable rather than being silently removed.

## Product hypothesis and boundaries

A useful initial paid-value hypothesis is: a technical researcher or small research team will pay to notice important developments, inspect their evidence, and produce a decision-ready brief with less manual work. This is a hypothesis to test with a concrete pilot, not market validation.

Keep the actual public story feed readable. Preserve the default shared-spec profile, current accounts/votes/saves, the nine-topic ontology, source admission, and existing score explanations. The extended research layer remains optional. Existing proposed specs are not approved by referencing them here. New payments, organizational permissions, private corpora, live notifications, external connectors, source licenses and professional services require explicit scope and human decisions before implementation. No paid calls, new polling, hosted deployment or changed permissions are included in the first slice.

[Shared spec 001](../specs/001-superintelligence-homepage/spec.md), the constitution and existing approval gates remain authoritative. Number collisions are resolved with spec-qualified references such as `002/REQ-031`; no requirements are renumbered. A related REQ in the JSON means a trace pointer, **not coverage of the entire idea**. `existing-scope-refinement` permits only a bounded refinement of an existing behavior; `proposed-needs-human` stays discovery until specified and approved where required.

## Dependency order and definitions of done

| Phase | Depends on | Outcome and exit check |
| --- | --- | --- |
| P0: baseline and trustworthy navigation | — | Capture representative route/task baselines, accessibility/error behavior and current dataset sizes; all shared-spec acceptance checks stay green. |
| P1: monitoring workflow and research reading | P0 | Existing watcher/control-room coverage is understandable; readers trace a result to source and dossier. A local question and cited brief can be tested without pretending a saved monitor exists. |
| P2: structured evidence synthesis | P1 | After scoped approval, evidence rows cite source records, distinguish unknowns and retain review context. A reviewed evaluation set measures extraction accuracy. |
| P3: investigations and decisions | P2 | After scoped approval, complete a pilot investigation with explicit owners, access boundaries and a reviewable decision deliverable. |
| P4: commercial services and integrations | P3 | Establish customer demand, licenses, privacy, operating responsibility and usage costs before introducing billing, new connectors or services. |

These phases express dependencies, not dates. Baseline measurements establish targets before performance improvement is claimed. Product and engineering priorities are separate: the JSON's `priority` field ranks work within the sequence; its `phase` field records the dependency phase.

## First implementation slice: question-guided dossier and cited brief

**Delivered locally:** SLICE-001 is implemented and tested on SQLite and Postgres. All 200 whole ideas remain in Backlog. The isolated existing-page refinement can be validated alongside P0 baseline work; it does not pass the full P1 gate or authorize a persistent monitoring service. P0 performance measurement and the later commercial gates remain open.

Validation: full browser suites each `335 passed, 0 failed`, `page errors: none`; dossier workflow each `16 passed, 0 failed`; project sync each `23 passed, 0 failed`; Product ideas browser each `9 passed, 0 failed`.

**Existing scope:** refine the topic dossier under proposed `002/REQ-031`, with existing trace/navigation behavior under `001/REQ-018`. This is a bounded improvement to existing extended functionality, not a new subscription or saved research-monitor service.

**Linked discovery ideas:** IDEA-101 (research-question monitors), IDEA-121 (living evidence tables), IDEA-151 (evidence-backed decision memos). The first slice implements only local question framing and a copyable, cited evidence brief. It must not mark any of those complete ideas Done.

**User journey:** open a topic dossier → write a specific research question → inspect the dossier's existing evidence and limitations → copy a clearly sourced brief → follow a source pointer back to its record. The question is local context, not evidence that the application answered it or changed the scientific judgment.

**Acceptance checks:**

- The dossier works without entering a question; existing scores, topic counts, verdicts and publication gates do not change.
- The brief labels its question, topic, evidence snapshot and limitations; every evidence pointer resolves to an existing record visible to the current user.
- No-evidence cases state that no usable evidence is available; they do not manufacture conclusions, references or confidence.
- Entered text is treated as text, including markup-like input. Copy failure is recoverable and does not discard the draft question.
- State scope is explicit: no claim of a saved monitor, background alert, personalized search or live research answer.
- Desktop, phone and keyboard use are checked, along with stale-response/error cases where applicable.
- The default spec profile does not gain extended dossier routes or navigation. Synthetic fixtures remain labelled.

**Follow-on prerequisite:** define the research-question matching contract and review source coverage before implementing saved monitors. Define a reviewed extraction schema before claiming a living evidence table. Define decision ownership and review before claiming decision recommendations.

## Initial priority decisions

| Candidate | Reason to prioritize | Evidence needed before expansion |
| --- | --- | --- |
| IDEA-001/002: performance measurement and budgets | Prevent speculative optimization and detect regressions | Representative route traces and measured interaction baselines |
| IDEA-022/041/042: trace strip and understandable graph | Research is useful only when readers can inspect its connections | Task completion for locating a source and explaining an edge |
| IDEA-061/062/091/092: accessibility and adversarial role tests | Shared components must remain operable and private states protected | Keyboard, screen-reader, role and delayed-response checks |
| IDEA-106: honest coverage status | A monitor is misleading if failed sources look checked | Source-level last attempt, success/failure and stale-data fixtures |
| IDEA-101/102: question monitoring and change briefs | Test whether monitoring saves recurring work | User-reviewed relevant/missed matches and a recurring-use pilot |
| IDEA-121/151: evidence table and cited memo | Creates an inspectable deliverable with a recognizable buyer | Accuracy review and a buyer completing a real scoped decision task |

No claim of guaranteed source coverage, scientific validity, quantified time savings or willingness to pay follows from a passing synthetic test.

## Epic index

| Ideas | Epic | Likely user / buyer | Phase |
| --- | --- | --- | --- |
| 001–010 | Performance and loading | All readers | P0 |
| 011–020 | Feed and discovery | Readers | P0 |
| 021–030 | Navigation and orientation | All readers | P0 |
| 031–040 | Learn explanations | Learners and researchers | P1 |
| 041–050 | Knowledge graph visualization | Researchers | P1 |
| 051–060 | Research quality and provenance | Researchers and analysts | P2 |
| 061–070 | Mobile and accessibility | All readers | P0 |
| 071–080 | Interaction and consistency | All readers | P0 |
| 081–090 | CMS, accounts and testing | Editors and administrators | P1 |
| 091–100 | Reliability and continuous quality | Maintainers | P0 |
| 101–110 | Personal intelligence | Researchers and technical leaders | P1 |
| 111–120 | Technical diligence | Applied research and engineering teams | P3 |
| 121–130 | Research synthesis | Analysts and literature-review teams | P2 |
| 131–140 | Reproducibility | Applied research teams | P3 |
| 141–150 | Team research operations | Labs and engineering organizations | P3 |
| 151–160 | Decision support | Product and strategy leaders | P3 |
| 161–170 | Specialist intelligence | Focused professional audiences | P4 |
| 171–180 | Learning and development | Individuals and employers | P4 |
| 181–190 | Data and workflow integrations | Organizations embedding research workflows | P4 |
| 191–200 | Institutional services | Institutional customers | P4 |

## Project tracker contract

Mirror each idea with one stable `product-idea:<three-digit number>` sync key. Use `product-backlog`, `phase:<id>` and `epic:<id>` labels with spec-qualified related requirement pointers in the source context. Keep human titles, priorities, ownership, comments and status intact on re-sync; source context and labels can refresh. A plan import must never turn an item Done because a related feature already exists or a partial slice was implemented.

The initial source status is `backlog` for all 200. Track implementation slices separately and link their idea IDs. An implementation issue is complete only with a defined scope, reviewed patch and exact validation evidence. An approval issue remains separate from implementation. Never create fake users, assignees, customer endorsements or approval receipts.

Use the actual configured local tracker database for the user's preview only after the sync's behavior has been checked on a throwaway fixture. Verify a second sync creates no duplicates, human notes and status survive, and the UI exposes the imported ideas. The canonical JSON is versioned; the live tracker is not assumed to have been updated merely because this file exists.

## Pilot validation and commercial gate

Choose one initial customer segment and one recurring task before packaging tiers. Observe the current workflow, measure time and errors, give the customer a real sourced deliverable, and ask for a paid pilot with a defined outcome. Preserve the public feed. Any proposed paid boundary should charge for repeatable work and controlled workflows rather than hide provenance or essential corrections.

Before paid release: humans decide product scope, pricing, terms, licenses, private-data rules, support responsibility and deployment. This roadmap authorizes planning and existing-scope improvements, not those external actions.

## First delivery estimates and observable success measures

Estimates indicate relative implementation effort after inspection, not delivery dates: **small** is a bounded existing-page refinement; **medium** spans a persistent workflow and its tests; **large** adds access, extraction or operational contracts.

| Delivery candidate | Effort | Success measure | Validation task |
| --- | --- | --- | --- |
| Local question-guided dossier / cited brief (partial 101/121/151) | Small | A reader copies a brief whose question is preserved and whose source IDs all resolve; unknowns stay explicit | Synthetic dossier with normal, empty and markup-like input; clipboard failure; phone and keyboard walkthrough; existing dossier tests remain green |
| Honest coverage states (106) | Small–medium | Each source fixture shows the correct successful, failed, stale or never-checked state; no false checked-coverage count | Inject the four states, compare displayed timestamps/counts with database records and verify default-profile boundaries |
| Saved question monitor (101, after scope approval) | Medium | Reviewed fixture matches meet the customer-agreed inclusion rule; rerun duplicates = 0; cross-user access = 0 | Human-label a bounded fixture, measure precision and missed relevant items, run twice and test two users |
| Change brief (102, after monitor contract) | Medium | Brief source list matches the defined snapshot delta; unchanged periods produce a clear no-change result | Replay two dated snapshots, source failure and withdrawal; inspect every reference and timestamp |
| Living evidence table (121, after schema approval) | Large | Field-level extraction accuracy and citation resolution reported against a human-reviewed evaluation set | Double-review a bounded set of papers, record disagreements, test missing data and correction propagation |
| Decision memo (151, after evidence workflow) | Medium–large | A pilot user can review cited alternatives and assumptions and record their own decision; unsupported statements are flagged | Complete one scoped customer task; audit citations and assumptions; compare task time/errors with their observed baseline |

Commercial success is not established by those engineering checks. The pilot must additionally show recurring use and an explicit paid commitment from an identified buyer; do not substitute page views, generated-word counts or synthetic task timings for that evidence.

## Simplicity constraint

Every delivery keeps one primary action visible, uses short plain-language copy, and moves secondary controls into optional details. Preserve source access and visible uncertainty. Refine existing workflows before adding navigation items or settings. The dossier keeps source links visible while grouping secondary section jumps; the roadmap uses a concise current-task link.

## Backend vocabulary delivery (SLICE-002 — in review)

The implementation joins the existing canonical knowledge schema, namespace grammar and controlled vocabulary in [DATA_DICTIONARY.md](DATA_DICTIONARY.md). It aligns existing document/event/outlet/lab identities, preserves stored IDs and protobuf wire numbers, validates tagger outputs, and checks reference drift in preflight. Graph and chunk lookups preserve complete IDs rather than silently truncating long outlet hostnames. Static membership and database-record existence remain separate checks.

This is a partial foundation for IDEA-093/187, not an organizational ontology workspace. Coverage is41 existing knowledge-layer fields,160 controlled entries and213 declared relationships; it does not claim every database/CMS field is standardized. Local checks are complete; public exposure and deployment remain pending the established approval process. No public UI or navigation was added.

## Entity resolution delivery (SLICE-003 — in review)

The backend recognizes complete arXiv/DOI resolver paths, emits canonical source links and standardized identity provenance, and returns ambiguous vocabulary aliases as multiple qualified candidates. `npm run resolve -- vocabulary aime` demonstrates an ambiguous benchmark/topic alias with separate graph pointers; `npm run resolve -- publication <URL>` inspects a syntactic publication identity without fetching it. No author identity is inferred from names.

Grouping admission protects conflicting recognized IDs, preserves exact stored-URL replays and serializes PostgreSQL ingestion decisions. Reader-submitted URL variants share one coverage class. Tests cover positive version/mirror matches, negative host/path/ID cases, real SQL and concurrent writes, canonical HTTP story links and explanation-point sums. Existing title-only associations remain heuristic; old merged records and cached scores require a separate reviewed maintenance plan. The reviewed legacy subject-qualifier normalization is deliberately limited; unknown forms stay generic URLs. No automatic historic merge/split, public UI or rollout is included.
