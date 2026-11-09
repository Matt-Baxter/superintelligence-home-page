# End-to-end logic and readiness audit, 2026-11-07

Scope: shared spec 001, the implemented research layer, and the work-tracking path. This audit does not approve proposed requirements or claim that every optional feature is complete.

## Findings and corrections

| Requirement | Trigger and prior behavior | Correction | Evidence |
| --- | --- | --- | --- |
| REQ-003 | Legacy stories with NULL scope passed the feed filter, including rows beyond a boot backfill batch | Only an explicit positive scope decision admits a story | `test/scope-admission.js`: real feed and detail APIs on SQLite and PostgreSQL |
| REQ-015, SC-007 | Acceptance covered a second sign-in but did not restart the application | Restart the fixture server against the same database and check existing sessions, votes and saves | `test/spec-acceptance.js`: process-restart scenario |
| REQ-010 | Signing in from a workspace fragment returned to its default page instead | Preserve the full local return path and validate its origin | Browser deep-link and return-path checks |
| Proposed 002/REQ-030 | A passing result could mask a failing result for the same requirement; status prose always claimed only delivery remained | Failed evidence takes precedence; uncovered and malformed evidence fails the command; prose distinguishes local checks from production facts | `test/spec-status-unit.js` |
| Proposed 002/REQ-030 | Generated issue descriptions and scope labels went stale; substring sync-key lookup could confuse identifiers | Exact identity matching, duplicate/ambiguity rejection, source-owned context refresh and notes preservation | `test/sync-source-unit.js`, `test/project-sync-unit.js` |
| Proposed 002/REQ-030 | Spec 004 tasks appeared as open work despite its explicit T000 approval prerequisite | Specs view and mirrored task context show the actual approval gate; completed work and people decisions remain separate | `test/project-specs-unit.js`, browser Specs scenarios |

## One source for each question

[START_HERE.md](START_HERE.md) is the navigation entry point. Requirements stay in specs; implementation/check links stay in [SPEC_TRACE.md](SPEC_TRACE.md); measured status stays in [SPEC_STATUS.md](SPEC_STATUS.md); build-specific shapes stay in [INTERFACES.md](INTERFACES.md). The app reads those sources for `/m/project#/specs`; sync mirrors their context into issues without granting approval. Historical handoffs are snapshots, not completion evidence.

## Human and deployment gates

- Shared REQ-019 (live delivery), REQ-020 (human-written log), and live-site SC-001/004/007/008 still need the partners. No deployment or agent-log entry was performed.
- Existing `vercel.json` declares four daily cron slots. Deployment settings must be reviewed against the repository's daily-only/free-tier rules before delivery. This audit did not change platform settings or deployment configuration.
- Proposed requirements remain proposed, and the REQ-032..035 numbering collision needs both partners. Spec 004 explicitly blocks implementation until T000 is resolved.
- Live model panel/advisor behavior, human calibration, full-text paper evidence and compiler-checked Lean proofs remain unverified. Two judge edge cases and two generated property gaps remain tracked by their existing suites.

## Validation

| Check | Result |
| --- | --- |
| Preflight | `Preflight passed.` |
| Shared acceptance, with browser and process restart | 48 passed, 0 failed; 18/20 requirements automated, 2 need people; 19/19 scenarios |
| Full browser, SQLite | `219 passed, 0 failed`; `page errors: none` |
| Full browser, PostgreSQL | `219 passed, 0 failed`; `page errors: none` |
| Scope-admission HTTP regression, SQLite / PostgreSQL | 4 passed, 0 failed on each |
| Tracker-sync integration, SQLite / PostgreSQL | 11 passed, 0 failed on each |
| Status-report regressions | 9 passed, 0 failed |
| Source-block regressions | 6 passed, 0 failed |
| Specs parser and approval gates | 25 passed, 0 failed |

 Synthetic fixture checks verify local code paths and database behavior; they do not prove live-source quality, production deployment, all provider failures or every possible concurrent execution.

## Shared performance and analysis pass — 2026-11-07

This pass serves REQ-002/003/005 and fixes existing research dossier/source behavior (REQ-031/033 in spec 002). It does not approve proposed specifications or deploy anything.

### Implemented

- Newest, votes and significance order/page in the database; only the requested page is transferred to the application. Stable timestamp/ID tie breaks prevent arbitrary page overlap. Top still uses the original time-decay calculation over all matching rows. Source links are grouped once instead of repeatedly scanning the whole link list for every story. Guest reads skip personal vote/save/note subqueries.
- Public feed metadata and ontology requests start together; sign-in entry avoids an ontology request. Knowledge graph and passage requests run together, render as one selection and reject stale responses.
- A validated, indexed topic hierarchy supplies every ancestor to tagging, scope-root lookup and dossier descendants. Missing parents, duplicate IDs and cycles fail fast; existing nine top-level topics and terms are unchanged.
- Attention values are finite, nonnegative integer counts within the shared database range. Invalid values cannot create negative or non-finite significance factors. Rising counters on an already linked item now rescore the story. This remains a bounded attention signal, never research evidence.
- Venue names or generic “science” text alone no longer imply the existing peer-review upgrade. Explicit submission/rejection/negation, including contractions, blocks that upgrade. Affirmative acceptance wording remains a heuristic cue, not verified peer-review status. Coverage says linked sources, not independently owned sources.
- Buzz uses valid UTC calendar dates, rejects missing/invalid/future dates and excludes invalid hype values from the mean. Dossiers keep canonical feed scores, preserve zero, exclude unclassified/hidden stories and count source identities rather than names. Uncatalogued links remain represented without a fabricated reader attribution.
- Knowledge text reads enforce current story admission. Rebuilds refresh metadata changes on unchanged text, replace derived edges transactionally, retain forecast edges and purge ineligible chunks. Scheduled pruning also rebuilds co-occurrence from remaining admitted passages, preserving other edge kinds. Stale co-occurrence is withheld pending refresh. Participating Postgres story rows are share-locked during finalization so concurrent moderation cannot invalidate the selected inputs mid-replacement.
- Node diagrams use spaced rows rather than overlapping radial labels, preserve full identifiers in titles/text alternatives, support keyboard exploration and keep chart panning inside its own region on phones.

### Evidence and interpretation

`test/pipeline-quality-unit.js` covers the new hierarchy, scalar, date, evidence, buzz and canonical-score cases. `test/story-page-unit.js` runs real HTTP/database checks on both engines: stable order, bounded row transfer, private state, admission, attention rescore, knowledge reads, stale graph withholding, metadata refresh and forecast-edge preservation. The fixture contains 240 admitted matches plus hidden and unclassified rows. Each new/votes/significance page materializes exactly 40 story rows in the application. This is a verified reduction in row transfer, not a claim of a measured production latency multiplier.

The accepted 25-metric benchmark has no regressions. New targeted regressions demonstrate the additional defects; they are not a new statistically representative paper-quality evaluation. All data in these checks is synthetic.

### Remaining limits

- Top ranking is not yet pushed into portable SQL; large-result-set Top requests still need profiling and a separate design.
- Unicode token-boundary parity remains a known follow-up across Node/Python/Rust. For example, embedded Unicode-letter acronym cases need coordinated portable-operator/vector changes, not a tagger-only patch.
- Existing stored story tags/scores require the normal admin re-tag operation after a future rollout; the Knowledge index must then be rebuilt. This pass did not mutate hosted data or run live harvesting. Old malformed publication metadata needs a separately reviewed backfill; new ingestion is normalized.
- Analysis uses stored titles/summaries and reviewed excerpts under existing rules; it does not independently verify every paper, outlet or community comment. Full-text storage and new source-label vocabulary remain subject to their existing agreements.
- Lab timings and fixture row counts are not field Core Web Vitals or real-device accessibility certification. Broader bundle budgets, production profiling and the remaining research ideas stay tracked separately.

### Verification of this pass

- Pipeline quality: `37 passed, 0 failed`.
- Isolated HTTP/database regression: `17 passed, 0 failed` on SQLite and PostgreSQL, including passage-prune graph cleanup.
- Full SQLite and PostgreSQL browser suites: each `330 passed, 0 failed`; `page errors: none`. The extended profile bundle was rebuilt before the Postgres suite; the default preflight bundle intentionally contains no extended blocks.
- Preflight: `Preflight passed.`
- Local demo emulations: `24 passed, 0 failed`; guest, reader and admin; 390/1280 pixels; light/dark; `page errors: none`.
- Benchmark: `25 metrics, 0 uplift, 0 regressions` against the accepted baseline.
- Phone graph screenshot: [synthetic Knowledge fixture](../shots/optimization-knowledge-phone.png).

## Connected navigation and content management — 2026-11-07

The Content desk previews imported research records, traces source coverage and harvest history, and reversibly moderates visibility with an atomic audit receipt. It never rewrites publisher titles, summaries or relevance outcomes. Shared breadcrumbs and a searchable directory derive from the active role-filtered navigation; story records link directly to their explanation, topic feed, dossier, graph node and admin record. Qualified graph references resolve the exact saved review rather than dropping readers at an unrelated catalog.

Original publishing lives in its own extended-only Editorial CMS. Admins create drafts, preview plain text, save revisions, restore retained versions, publish a specific snapshot and unpublish it. Draft edits/restores leave the live snapshot unchanged. Expected-revision comparisons reject stale concurrent edits; every successful mutation includes the post, retained revision and admin audit receipt in one transaction. Public APIs return only published snapshots. Guest and reader access to authoring APIs is denied.

Limits: 200 original posts, 20 retained revisions per post, 20,000 body characters, plain text only. No automatic publishing, rich HTML, imported full articles, media uploads, collaborative live editing, scheduled releases, hosted deployment or external CMS integration is claimed. Existing proposed requirements remain proposed; no shared specification or approval gate was changed.

### Validation of connected content workflows

- Full browser suite: SQLite and PostgreSQL each `334 passed, 0 failed`; `page errors: none`.
- Content desk HTTP/database regression: SQLite and PostgreSQL each `14 passed, 0 failed`, including atomic moderation/audit rollback and stale-visibility rejection.
- Editorial HTTP/database regression: SQLite and PostgreSQL each `18 passed, 0 failed`, including serialized near-cap creation, concurrent revisions, live/draft separation, unpublish, revision retention, audit rollback and spec-profile exclusion.
- Dedicated CMS browser journey: SQLite and PostgreSQL each `32 passed, 0 failed`; `CMS page errors: none` (`npm run test:cms` after the full fixture suite): private draft, safe preview, explicit publication, preserved live text during edits, restore, unpublish, exact graph-to-review navigation, protected authoring APIs, and 390/1280-pixel light/dark layouts. Every record used is synthetic.

The independent review found and corrected a pending-save data-loss risk: inputs are now disabled with `aria-busy` while a save or restore is pending. A held-request browser regression verifies that newer keystrokes cannot be silently overwritten. The first browser run also caught short-viewport feed geometry; root navigation now shares the existing results row instead of adding another row above the first story.

The module validation command in the extended profile still reports pre-existing review/research cross-module imports and missing README files. The new editorial module uses kernel extension points without those imports. Default-profile preflight and both full browser suites remain the reported checks; this pass does not claim all extended architectural boundaries were repaired.

Final review also identified and corrected a concurrent-create quota race. Postgres now holds a database-local advisory transaction lock while checking and admitting original posts; the near-cap test accepts exactly one of two simultaneous creates at 199 records and verifies the 200-record limit.

Final checks: `Preflight passed.`; demo role emulations `24 passed, 0 failed`; `page errors: none`. The local demo includes one clearly labeled, unpublished sample draft for trying the editor. [Editor screenshot](../shots/cms-editorial-demo.png).

## Sourced definitions and reading pointers — 2026-11-07

Collected a 22-entry registry of terms, notation and functions, grounded in the original attention paper, the Deep Learning textbook and Stanford probability/linear-algebra teaching references. Each entry links its source, related concept, related definitions, notation and stated caveats. The glossary is not an automatic interpretation of a paper: θ and σ remain context-dependent, and capital Σ is distinct from lowercase σ.

The extended Learn adapter records qualified `term:` mentions and curated graph links, without changing research scores. The existing Knowledge rebuild refreshes metadata even when passage hashes stay unchanged. Reading-only decoration preserves text and existing links, skips editors/code/controls/navigation, and is bounded to 60 pointers and 2,000 text nodes per scan. Dynamic content is observed with deferred scans, not polling.

Softmax and sigmoid use the same bounded implementation in Node and browser. Generated-vector checks cover normalized weights, constant-shift invariance, finite ranges, sigmoid monotonicity and symmetry. This is deterministic numerical regression coverage, not a formal proof or a calibration claim. Learn-related story lookup now excludes hidden and unclassified records just as the feed does.

Sources: [Feedforward networks](https://www.deeplearningbook.org/contents/mlp.html), [probability and information](https://www.deeplearningbook.org/contents/prob.html), [Stanford probability review](https://cs229.stanford.edu/section/cs229-prob.pdf), [Stanford linear algebra](https://cs229.stanford.edu/section/cs229-linalg.pdf), [original attention paper](https://arxiv.org/abs/1706.03762). No live harvesting, full-paper verification, hosted re-tagging or automatic publication is claimed.

Validation: `Term properties: 1206 passed, 0 failed` (600 generated vectors per function); full SQLite and Postgres browser suites each `335 passed, 0 failed`, `page errors: none`; focused term browser suites each `28 passed, 0 failed`, `term page errors: none`; isolated HTTP/database suites each `22 passed, 0 failed`. Canonical schema checks pass in zod, Pydantic, Arrow, protobuf/gRPC and Rust, including the new glossary tag example. Python checks used an isolated temporary Python 3.12 environment; system Python was unchanged.

Remaining limits: first mentions are bounded for readability, so not every repeated token is linked. Entries cover selected conventions and never determine an author’s intended notation or verify full papers. Hosted stored passages need the normal admin Knowledge rebuild before new term edges appear. No live-news collection or hosted publication was performed.

Local verification also rebuilt the existing synthetic Knowledge index (4 passages, 215 links), preserved the selected term during refresh, and checked the function explorer through the in-app browser. Node diagrams now render one target per neighbor even when several relationships connect it. A renderer regression checks duplicate-edge inputs. File/path tokens such as `transformers.js` and adapter metadata are excluded from reading decoration. Existing local drafts were retained while refreshing the running server. [Function explorer](../shots/terms-function-demo.png) · [Sourced definition](../shots/terms-definition-desktop.png).

## Original-spec alignment and research watch — 2026-11-07

The original `specs/001-superintelligence-homepage/spec.md` remains unchanged. REQ-001/002/004/005/006/007/008 and accounts/votes/saves/browsing remain the core; the research layer, glossary and original publishing remain optional extended features. Spec-mode acceptance now explicitly checks that glossary/editorial APIs and pages answer 404. Default seeds list 11 sources across five kinds, but that is configuration coverage, not verification that every live feed currently works.

**Unresolved scope interpretation:** REQ-003 describes matching at least one superintelligence topic, while the implementation uses a strong term or two distinct root topics. A single Governance/policy match without a strong term is excluded. The spec also says to reject weak borderline matches. This discrepancy needs John and Matt to resolve before claiming full compliance. This pass neither lowers the filter nor changes the agreed fixed nine-topic list or scoring weights. Passing synthetic examples alone does not settle the wording.

REQ-019 and live-site scenarios still require an actual public deployment, sharing, human relevance checks and redeploy verification; REQ-020 remains the partners' own repository log. No log entry, shared-spec edit or deployment was made.

The [research snapshot](research/spec-alignment-and-frontiers.json) records eight primary-paper pointers, observed revision dates, abstract-only summaries and the next evidence checks for recurrent depth, latent reasoning, JEPA and world models. Four linked Learn concepts and glossary entries explain those mechanisms. They do not demonstrate superintelligence, self-modification or safe general planning. No full paper or result reproduction is claimed.

Two targeted arXiv query feeds were attempted; both timed out after 15 seconds. They are unverified catalog candidates, not enabled or reported as working live sources. Existing production records were not harvested or re-tagged.

A fresh `git fetch origin` confirmed that the original spec file matches `origin/main` at `3d24937`. Existing branch differences in constitution/contract/work agreement include explicitly proposed workflow changes; they were not ratified or edited here. The status generator now retains the scope-interpretation warning when reports are regenerated. Original-spec acceptance: `48 passed, 0 failed`; 18/20 requirements are classed as automated and passing, two remain people checks.

Validation for this pass: original-spec browser acceptance `48 passed, 0 failed`; full extended browser `335 passed, 0 failed`, `page errors: none`; term browser `28 passed, 0 failed`; new concept/source/quiz browser `4 passed, 0 failed`; research-foundation integrity `7 passed, 0 failed`; status regressions `10 passed, 0 failed`; benchmark `25 metrics, 0 uplift, 0 regressions`. All browser data is synthetic. Paper metadata comes from the linked real primary sources; summaries are not full-paper reviews.

## Research navigation cleanup — 2026-11-07

An adversarial review found that Knowledge selections changed the displayed node without updating its permalink, glossary filtering folded Σ into σ, and public Learn RSS items led to an authenticated page. Graph selection now updates `qid`, supports browser history and an All nodes reset. Glossary filtering shares a symbol-aware search key. RSS links now resolve through a public published-post reader; its endpoint selects only published post output, while drafts and the existing workspace endpoint retain their access boundaries. Output is rendered as text to prevent markup execution.

Learn route responses are guarded against stale navigation, including its teardown, job creation and queue actions. A separate teardown request counter handles overlapping runs on the same page. Broken concepts have a recoverable error panel, breadcrumbs follow the selected concept, and Feed/Saved have distinct directory selection. Similarity-search errors are handled and old results cannot overwrite newer queries. The independent second review found no blocking issue; its remaining teardown ordering finding was fixed and covered by a delayed-response probe.

Validation on throwaway synthetic fixtures: SQLite and Postgres each `335 passed, 0 failed`, `page errors: none`; `BASE=<fixture> node test/navigation-e2e.js` each `Navigation adversarial browser: 15 passed, 0 failed.`; glossary browser `Term browser: 30 passed, 0 failed.`; generated term properties `Term properties: 1207 passed, 0 failed`. The initial preflight caught a dynamic API-path expression unsupported by the codebase map; the page now uses the recognized template-literal form. These checks establish local behavior, not production deployment or live-source verification. No shared spec, scoring policy or source admission rule changed.

Final preflight: `Preflight passed.` Public withdrawal is also covered: requeueing a published post removes both its public lookup and RSS entry.

## Product backlog and first delivery — 2026-11-07

All 200 user-requested ideas are retained as permanent IDEA-001–200 records across 20 epics and five dependency phases. Buyers, outcomes, priorities, scope notes, requirement pointers and acceptance criteria are captured in `docs/research/product-backlog.json`; `docs/PRODUCT_ROADMAP.md` defines exit checks and pilot validation. They are proposals, not 200 delivered features. SLICE-001 separately records the bounded existing dossier refinement; whole ideas101/121/151 remain backlog.

Project sync validates identities, fields and acyclic phase/idea dependencies before opening the database. Stable source markers update context without overriding human titles, notes, status or priority. Source-owned phase, epic and scope labels replace obsolete values while custom labels survive. An adversarial review found both stale generated labels and delayed list responses; regression checks cover their fixes. The existing CLI sync must be run serially; it does not introduce a new concurrent import authority.

The first dossier slice adds session-local questions, an evidence/gaps/reference brief, complete manual-copy fallback, focusable section links, invalid-topic recovery and stale-response guards. It creates no saved monitor, notifications, subscription, new analysis or customer access. The first slice can be tested alongside open baseline work; it does not declare the monitoring phase complete.

Synthetic SQLite and Postgres validation each: full browser `335 passed, 0 failed`, `page errors: none`; project sync `23 passed, 0 failed`; Product ideas browser `9 passed, 0 failed`; dossier workflow `16 passed, 0 failed`. The initial preflight detected a stale generated Hub; `npm run hub` refreshed it. The actual local preview tracker was then synced: `300 items, 300 created, 0 updated, 0 unchanged`; the repeat run was `300 items, 0 created, 0 updated, 300 unchanged`. Browser inspection confirmed the scoped Product ideas view contains200 proposals plus one Done delivery task. Existing local draft content was retained. No hosted deployment, customer-demand validation or shared-spec amendment is claimed.

Final verification: `Preflight passed.` The compact Product ideas layout was rechecked on both engines: `Product backlog browser: 9 passed, 0 failed.`

## Simplicity pass — 2026-11-07

Dossier and roadmap copy is shorter. The dossier has one primary Copy brief action, direct source access, optional secondary section links and collapsed admin publishing tools. The roadmap retains full task names as accessible labels while showing concise links. The roadmap's simplicity constraint applies to future deliveries: refine existing workflows, keep primary actions visible and reveal secondary controls on demand.

Validation: `Preflight passed.` Existing synthetic local-demo checks report `Dossier workflow browser: 17 passed, 0 failed.` and `Product backlog browser: 9 passed, 0 failed.` The dossier adds a keyboard disclosure check; source records remain directly reachable. No routes, tables, scoring or permission changes.

## Backend data dictionary and vocabulary contracts — 2026-11-07

The offline dictionary joins the existing knowledge schema, ontology, concepts and glossary:14 namespaces,41 canonical fields,160 static entries and213 declared relationships. Definitions retain properties, caveats, source links and registry versions. Generation is deterministic; preflight rejects namespace drift, dangling pointers, malformed registries and stale generated documentation. This is knowledge-layer coverage, not a claim that every database/CMS field has a cross-runtime type.

An independent audit reproduced existing event/outlet graph nodes rejected by the shared parser and a missing document namespace in the generated enum. Namespace grammar now covers existing document/event/outlet/lab identities, preserves hostname/class IDs without slugification, and drives generated Tag constraints. Existing protobuf enum numbers1–10 are unchanged; additions append11–14. Protobuf/Arrow remain structural representations; backend validators enforce lexical admission. Syntax validity, static vocabulary membership and dynamic-record existence are explicitly distinct.

Adapter output validation rejects malformed tag collections, names, IDs, methods, scores, child-topic pointers and curated edge shapes before they are merged or exposed for persistence. Cross-namespace relationships remain supported. Existing adapters and curated relationships pass. Graph/chunk query IDs are no longer silently cut at80 characters; full IDs up to320 are preserved and overlong inputs fail explicitly. A focused HTTP fixture initially expected unknown personal outlets to retain a hostname; it was corrected to use a recognized preprint outlet and separately verify that privacy pooling remains intact.

Validation: identity contract29/0; adapter contract42/0; vocabulary25/0; full SQLite/Postgres browser suites each `335 passed, 0 failed`, `page errors: none`; real HTTP/database graph tests each `Dictionary graph HTTP: 12 passed, 0 failed.` Generated examples load and round-trip in zod, Pydantic, Arrow, protobuf/gRPC and Rust using the existing isolated Python environment. Backend SLICE-002 is In review; the local private tracker sync created exactly one task and the repeat created/updated nothing. No public UI, navigation item, deployment or approval bypass was introduced.

Final verification: `Preflight passed.` Project sync is23/0 on SQLite and Postgres; the local private tracker browser is9/0 after the additional In review task. Compound chunk locators and registry paths are explicitly documented as provenance strings rather than qualified Tag IDs.

## Planning metadata and project-index cleanup — 2026-11-08

Gap review found delivery tasks hard-coded to REQ-031 even when their declared references differed. Labels now follow the task’s declared requirements, with full spec-qualified context in its source block. Obsolete generated requirement/scope labels are replaced; freeform labels, human notes, titles, priorities and progress remain preserved. Generated labels leave room for ordinary custom tags under the tracker’s source-label limit.

Delivery records now require nonempty scope/acceptance context, nonempty unique linked ideas, well-formed requirement pointers and review/completion verification context. Project sync checks pointer existence against actual spec definitions before opening the database; a syntactically valid but nonexistent requirement fails. Verification context does not itself grant partner approval. The project index now links the roadmap and generated data dictionary directly. No shared agreement, public UI, route or database schema changed.

Validation: `Product backlog contract: 10 passed, 0 failed.`; `project sync unit: 23 passed, 0 failed`; dictionary check still validates14 namespaces,41 fields,160 entries and213 relationships. Preflight passed. Local sync corrected2 delivery records and created none; a repeat reported `301 items, 0 created, 0 updated, 301 unchanged`. Existing known judge gaps and incomplete CMS dictionary coverage remain open; this cleanup does not claim to close them.

## Research-informed local confirmation — 2026-11-08

The local preview was not listening on3200 at the start of this run. It was restarted against its preserved synthetic database; read-only checks confirmed one unpublished editorial draft and301 tracker records. The existing browser session loaded the dossier and Source records moved focus to traced references. The preview remains local and no production deployment/publication occurred.

Research: [Playwright best practices](https://playwright.dev/docs/best-practices) recommends isolated browser contexts and observable readiness; [W3C Easy Checks](https://www.w3.org/WAI/test-evaluate/preliminary/) covers keyboard access, labels and feedback. These informed focused verification, not a claim of complete WCAG conformance. The standalone browser library uses explicit readiness checks rather than introducing a new test framework.

Two test-quality gaps were corrected. First, initial full runs failed “brief renders from a server-built spec” and “topic activity bars render”, then timed out waiting for a story. The server had entered a new UTC week, while recorded fixtures belong to the week of2026-11-02. The populated brief test now selects that explicit fixture week; a separate2000-01-03 empty-week test confirms no stories are invented. Fixture timestamps and application behavior were not changed. Second, focused race probes now wait for actual API/JSON completion and the caller's synchronous post-await continuation instead of fixed100–300ms sleeps. Product ordering explicitly waits for the newer response while the stale response remains held. An independent browser-only negative control removed the render guard and failed specifically at the stale-response assertion; the unmodified normal control passed9/0. Production files were not changed by that control.

| Check | SQLite | Postgres |
| --- | --- | --- |
| Full browser | `336 passed, 0 failed`; `page errors: none` | `336 passed, 0 failed`; `page errors: none` |
| Navigation adversarial browser | `15 passed, 0 failed` | `15 passed, 0 failed` |
| Dossier workflow browser | `17 passed, 0 failed` | `17 passed, 0 failed` |
| Term browser | `30 passed, 0 failed` | `30 passed, 0 failed` |
| Dictionary graph HTTP | `12 passed, 0 failed` | `12 passed, 0 failed` |
| CMS browser | `32 passed, 0 failed` | `32 passed, 0 failed` |
| Product backlog browser | `9 passed, 0 failed` | `9 passed, 0 failed` |

The preserved preview's dossier suite separately passed17/0. Generated schema examples pass in zod, Pydantic, Arrow, protobuf/gRPC and Rust; dictionary generation remains current. All database mutations for publication/withdrawal/graph tests used disposable fixtures. Tests do not verify live-feed availability, production performance, customer demand or scientific correctness. Known judge gaps and incomplete CMS dictionary coverage remain open. The dossier's date-only snapshot currently follows UTC without an explicit zone label; retain this as a presentation-contract follow-up for approval rather than silently changing stored date semantics.

Final preflight: `Preflight passed.` This confirmation used the repository's run-tests workflow and full-story verification across browser, API and database boundaries. No main-site publication or approval status was changed.
