# Next: what we're building from the November 6 ideas

Ideas collected on Nov 6 (Sean Parent on declarative property models and DSL pipelines, GitNexus, Floorplan, a dependency-aware timeline, Teardown) and what we do with each. Decided by John's agent at John's request; anything that changes the shared spec is a proposal until both of us approve it.

Where each of these now lives (skills, specs, checks, measures) is indexed in [HUB.md](HUB.md), generated from the repo.

| Idea | Decision | Why | Spec |
| --- | --- | --- | --- |
| **Codebase map** (Floorplan, GitNexus) | **Build now** (`feature/codemap`) | Developer and agent tooling: agents query a graph of the repo instead of grepping, and preflight catches pages that call routes that don't exist. It follows Sean Parent's pipeline: a parser reads the repo, maps it into a graph schema, and a layout engine and behaviour layer draw it. | None needed (tooling); listed under "Beyond the spec" in `docs/SPEC_TRACE.md` |
| **Dependency timeline** in the Project workspace | **Next** | Ties the spec to the process: `/speckit-tasks` writes dependency-ordered tasks; importing them as issues with "blocked by" links and a timeline that warns when a task starts before its dependency ends makes the plan visible. | Process tooling; no product REQ |
| **Pipeline teardown** (Teardown) | **Propose** | A "how it works" page where one sample story moves through fetch → group → tag → score → feed, each panel showing the real numbers. Strong for the class demo and for REQ-005 ("why is this here"). | Proposed REQ-021 below |
| **Unslop UI and motion** (Nov 6 screenshots) | **Built** (`feature/design-and-learn`) | The ui-design skill, the 20 motion rules as tokens and classes, and `scripts/unslop.js` in preflight, so new pages can't drift into the generic AI look. | Tooling; no REQ |
| **Learn layer**: concepts in plain words with analogies, a knowledge graph, links to stories, and the pipeline teardown | **Built as a module, proposed** | It teaches what the feed is about and explains the pipeline (REQ-005, "why is this here"). | Proposed REQ-021 and REQ-023 |
| **Studio jobs**: paper-to-code, reverse-engineering, Lean 4 proofs, explainer videos (3Blue1Brown-style), blog and Substack drafts | **Built as a queue plus a local worker, proposed** | Heavy work runs off the server (free tier), and agents do the parts that need a model. Nothing posts automatically: a person publishes (RSS, which Substack can import) or uploads the video. No Twitter/X. | Proposed REQ-024 and REQ-025 |
| **Knowledge layer and portable rules** (Nov 7) | **Built** (`fix/sync-with-main`; knowledge module in the extended version) | There are two parts:<br>- **Tooling (works in both versions):** one rule language for every runtime (si-expr: Node, Python, Rust, WebAssembly) and one type source (`schema/types.json` → zod, pydantic, protobuf/gRPC, Arrow, JSON-LD, OpenRPC, Rust).<br>- **Extended version:** chunk-level tagging, local embeddings and a knowledge graph.<br>Research: `docs/RESEARCH_AGENTS_SANDBOXES.md`. | Tooling; the knowledge graph is part of proposed REQ-023 |
| **Lab: idea → reproduction → hypothesis; recursive self-improvement; autoresearch** (Nov 7) | **Built** (extended version) | Six deterministic examples (four on recursive self-improvement, plus Goodhart, weak-to-strong and scaling). A self-improving decision gym whose policies are portable si-expr. Intent routing that builds validated dashboards. A ratchet worker with optional local Gemma via Ollama or free-tier providers, plus SFT/DPO export for fine-tuning. | Proposed REQ-026 |
| **Review desk and superintelligence map** (Nov 7) | **Built** (extended version) | Ingest and judge a paper, article or comment with three explainable judges behind anti-gaming guards; a stress test where adversaries try to game the judge; a catalog in the knowledge graph; a map of the topics, concepts, people (watchlist counts only) and organisations. `test/review-unit.js` holds the anti-gaming invariants, and `npm run bench` measures the judges (plus the Lab policy and the scope rule) against `bench/baseline.json`; preflight fails if any metric gets worse. | Proposed REQ-027 |
| **Declarative property models** (Sean Parent) | **Propose, later** | Forms declared as properties plus relations (for example the Decide page: weights must total 100; changing one rebalances the others) solved by one small engine instead of hand-written handlers. Good idea, but not needed for the bake-off (constitution II, simplicity). | Proposed REQ-022 below, low priority |

## Proposed requirements (need both partners; add with `/speckit-specify`)

All of these, plus REQ-028 (daily paper watch), REQ-029 (benchmarks with a ratchet) and REQ-030 (the project tracker mirrors the spec and the agents), are now written up as one draft spec in Spec Kit form: [`specs/002-research-layer/spec.md`](../specs/002-research-layer/spec.md), status Proposed. Nothing in it counts until both partners approve. `node scripts/project-sync.js` puts one "Approve REQ-0xx with Matt" issue per proposal in the Project tracker.


- **REQ-021 (proposed, P3):** The system SHOULD offer a "how it works" page that shows one synthetic story passing through each step (fetch, grouping, topic tagging with matched words, superintelligence scope decision, feed placement) with the real values at each step.
  - *Given* the sample data, *When* a visitor opens the page, *Then* each step shows its input and output for the same story, labelled as test data.
- **REQ-023 (proposed, P3):** The system SHOULD explain the concepts behind superintelligence research in plain language, with an analogy and a self-check, and show how the concepts relate as a graph linked to the stories that mention them.
  - *Given* a concept, *When* a reader opens it, *Then* they see its plain explanation, an analogy, what to read first, related concepts and recent stories.
- **REQ-024 (proposed, P4):** Admins SHOULD be able to queue background studio jobs (plain-language explainers of a paper, paper-to-code, reverse-engineering, Lean 4 proofs) that run outside the web server and record their results and files.
- **REQ-025 (proposed, P4):** The system SHOULD turn a concept into an animated explainer video and a blog/newsletter draft. Publishing is always a person's action: the site offers an RSS feed of published explainers and never posts to social accounts.
- **REQ-026 (proposed, P4):** The system SHOULD offer worked examples that restate a superintelligence idea in plain words, reproduce it as a deterministic toy experiment, and test a stated hypothesis of ours against it, keeping refuted hypotheses as results. The examples should centre on recursive self-improvement.
  - *Given* an example, *When* a reader opens it, *Then* they see the idea, the reproduction, the hypothesis with its prediction, and whether the toy result supports it, and can rerun it with their own parameters.
- **REQ-027 (proposed, P4):** A signed-in reader SHOULD be able to submit a paper, article or comment about superintelligence and get an explained judgement (significance, rigor, hype) that resists obvious gaming (repetition, keyword lists, unbacked frontier claims, name-dropping, text addressed to the judge), with the result catalogued in the knowledge graph and open to a person's agree or disagree label.
  - *Given* the synthetic samples, *When* a reader judges the hype sample, *Then* its guarded score is below the careful sample's, the guards that fired are listed, and it is sent to a person.
- **REQ-022 (proposed, P4):** Forms with dependent fields (comparison weights) SHOULD keep their constraints satisfied automatically (weights always total 100) and show which field changed which.

## Codebase map: how it works

1. **Parse**: `modules/codemap/scan.js` reads `server.js`, `lib/`, `modules/`, `kernel/`, pages, the spec and the trace.
2. **Schema**: it emits one graph (`nodes` and `edges`):
   - **Nodes:** pages, API routes, tables, files, modules, extension points, blocks, judges, views, requirements and tests.
   - **Edges:**
     - a page calls a route;
     - a route reads or writes a table;
     - a route is defined in a file;
     - a file requires another file;
     - a module contributes to an extension point;
     - a requirement is met in a file and checked by a test.
3. **Layout**: the Map page (`/m/codemap`, admins) draws pages → routes → tables in lanes, with module and spec views.
4. **Behaviour**: click anything to trace everything upstream and downstream of it; type a question ("votes", "REQ-003") to light up the path.
5. **Agents**: the `codemap_query` MCP tool and `npm run codemap -- <query>` answer the same questions from the command line.
6. **Checks**: preflight fails when a page calls an API route that doesn't exist.
