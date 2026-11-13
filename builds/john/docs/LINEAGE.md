# Data lineage

Where every piece of data enters, each operator it passes through, where it is stored and where it is served. For each operator: what it **keeps**, **transforms** and **drops**. The last column says which check proves that hop.

`test/lineage-unit.js` is the end-to-end fidelity check. It runs in preflight; `npm run test:lineage` runs every Lab example too. It pushes the synthetic fixtures through the real app on a throwaway SQLite database, then replays each operator on its own in memory. Every stored and served value must equal that replay. Mutation-tested: cutting stored summaries short, adding one to coverage, or adding one to a stored review score each fails the check.

Shapes of tables and routes: [INTERFACES.md](INTERFACES.md). How a feed item becomes a story, step by step: `agent-kit/skills/codebase-map/references/pipeline.md`. Names: [NAMING.md](NAMING.md).

## A. Feed item → story → feed (REQ-001..006)

| # | Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- | --- |
| A1 | `harvest` (lib/harvest.js) | picks due, active sources, 5 at a time; drops (defers) sources not reached in the 45 s budget | — | e2e "Admin: harvesting" |
| A2 | `harvestSource` → `fetchSource` → `fetchText` (lib/feeds.js) | conditional GET (304 = nothing new); refuses private addresses; drops bodies over 5 MB; **keeps the first `max_items` (default 50) in feed order** | `sources.*` health, `fetch_runs` | e2e "Admin: harvesting" |
| A3 | format parsers (`parseXml`, `parseHfDaily`, `parseJsonFeed`, `parseHnAlgolia`, `parseSemanticScholar`) | every format → `{title, url, summary, published, authors[], score?}`; strips HTML; **cuts titles to 300 and summaries to 700 characters** (whole words, "…"); drops items without a title or http URL. HN summaries are replaced with a points/comments line; Semantic Scholar dates with only a year become 1 January | — | lineage A "documented cap" |
| A4 | `addItem`: Twitter/X filter | drops twitter.com, x.com and nitter links (REQ-006) | — | lineage A, e2e |
| A5 | `storyKeys` (lib/feeds.js) | keys in order: `arxiv:<id>`, else `url:<normalised>`; plus `title:<normalised>` for titles of 4+ words | `story_keys` | lineage A "grouping", "every key" |
| A6 | `addItem`: group | first key already known decides the story; else a new story. **First source wins**: title, url (arXiv canonicalised), summary, authors, date come from the first item; later items only raise `ext_score` | `stories`, `story_links` (one per source and URL) | lineage A "stored … equal the first source's item", "one story_links row" |
| A7 | `tag` (lib/tagger.js) | title + summary → topics and organisations, each with the words that matched; a child topic adds its parent (`via`) | `stories.topics`, `stories.orgs`, `story_topics` | lineage A "equal the tagger" |
| A8 | `rescore` → `analyze` (lib/analysis.js) | stored text + topics + the links' source kinds and number of sources → significance (0–100) with a `why` line per factor, scope (REQ-003), benchmarks with scores, watched people | `stories.significance`, `.analysis`, `.in_scope`, `story_entities` | lineage A "analyze() replayed", "story_entities"; `analysis-unit` |
| A9 | `storyRows` → `shapeStory` (server.js) | serves visible, in-scope stories; **computes at read time** votes, coverage, the reader's vote/save/notes and `rank`; drops `hidden_reason`, `ext_score`, `in_scope` from the response | — | lineage A "API serves each … once", "served … equal the stored row", "?topic=" |
| A10 | `GET /api/stories/:id` | same row as the list; out-of-scope and hidden stories are 404 | — | lineage A |
| A11 | pages (`public/js/api.js` `storyCard`, `story.html`) | shows up to 4 topics, 2 orgs, 3 benchmarks; summary trimmed to 260 characters on cards; story page shows every tag's matched words and every `why` line | — | e2e "Feed, grouping and tags", "Story page, notes, lists" |

Re-derivation paths: Admin → Re-tag (`retagAll`) re-runs A7 and A8 for every story; boot `backfill` re-runs A8 for unscored stories. Reader submissions (`POST /api/stories`) enter at A4 with no source.

## B. Readers' actions (REQ-007..012)

| Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- |
| signup / login / session | first user becomes admin; sessions last 30 days, expired or disabled ones are deleted when seen | `users`, `sessions` | e2e "Accounts" |
| vote / save toggle | one row per (user, story); toggling deletes it | `votes`, `saves` | lineage B |
| notes | text up to 2000 characters, private by default; counted for its owner only | `notes` | lineage B |
| lists, list items, follows | item notes overwrite on re-add; a list's stories are served through `storyRows`, so hidden or out-of-scope items drop out | `lists`, `list_items`, `follows` | e2e "Story page, notes, lists" |

Votes feed `rank` and `sort=votes` at read time; nothing a reader does changes `significance`.

## C. Capabilities (`GET /api/capabilities`)

Aggregates at read time: topic counts from `story_topics` over the window and the one before it, benchmark results from `story_entities`, people, organisations from `stories.orgs`, and the top-signal stories. Checked by e2e "Capability analysis". Windows differ by series (see gaps).

## D. Review desk → catalogue → knowledge graph (REQ-027)

| Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- |
| `input` (modules/review/routes.js) | caps title 300, text 20000, authors 600; refuses Twitter/X | — | `review-unit` |
| `review` (modules/review/review.js): normalise, clean, tag, judge, verdict | drops repeated, keyword-list and checklist sentences before tagging; keeps the first 12 claims; score and credibility on two axes; id = `doc:` + hash of title and text | — | `review-unit`, bench `review.*` |
| catalog edges | each non-`via` tag → `about`, `explains`, `evaluates-on` or `mentions` (people by name only) | `knowledge_edges` | lineage C |
| `saveReview` (store.js) | one row per doc id; **a doc already stored is returned as stored, not re-judged**; excerpt is the first 400 characters | `review_docs` | lineage C |
| `GET /api/review/docs/:id` | serves the stored result and its edges | — | lineage C |

## E. Paper watcher → paper-to-code queue (REQ-028, REQ-024)

| Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- |
| `fetchArxiv` or `--from` (scripts/watch.js) | configured queries (`modules/review/watch.json`), 3 s apart; a failed query is skipped and logged | — | `watch-unit` |
| de-duplicate | one entry per arXiv id (abs/pdf/`arXiv:` links only, version dropped); URL canonicalised to `https://arxiv.org/abs/<id>`; drops Twitter/X | — | `watch-unit` |
| catalogue (D above) | up to `--max` / `maxNewPerRun` new papers; the rest are counted as over the cap | `review_docs`, `knowledge_edges` | lineage D |
| queue | new, not a survey, credibility ≥ 50, about a watched topic; skips papers already in the Lab or already queued (by link or doc id); at most `paperToCode.maxPerRun` | `learn_jobs` (`paper-to-code`) | lineage D, `watch-unit` |
| digest | one row per paper: link, arXiv id, query, verdict, score, credibility, qualified topics, doc id | `out/watch/<day>.md`, `.json` | lineage D |

## F. Stories → knowledge chunks → graph (REQ-023)

| Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- |
| `build` (modules/knowledge/routes.js) | newest in-scope, visible stories (up to 2000); title + summary → sentence chunks of up to 420 characters; **an unchanged chunk (same text hash) is not re-tagged** | `knowledge_chunks` | lineage E |
| `tagAll` (lib/taggers) | every registered tagger (topics, orgs, benchmarks, people, Learn concepts), merged by qid | `knowledge_chunks.tags` | lineage E |
| `coOccurrence` + curated edges | pairs of tags seen in the same chunk (weight = chunks, up to 5 stories as evidence); topic `part-of` parent; concept `about` topic and concept relations | `knowledge_edges` (all but `doc:` edges are rebuilt) | lineage E |
| `/api/knowledge/*` | graph (top 60 edges), chunks, similar (cosine over hashed embeddings), JSON-LD export | — | e2e "Knowledge: chunks, tags, graph, JSON-RPC" |

## G. Learn (REQ-021..025)

Concepts (`modules/learn/data/concepts.json`) are served as written; concept-to-story links are matched at read time. Studio jobs (`learn_jobs`) go queued → running → done / needs-agent / failed through `scripts/learn-worker.js`, which writes drafts, storyboards and proofs under `out/learn/<id>/`. Checked by e2e "Learn: concepts, teardown, studio jobs" and `project-sync-unit`.

## H. Lab (REQ-026) and benchmarks (REQ-029)

| Operator | Keeps / transforms / drops | Writes | Checked by |
| --- | --- | --- | --- |
| examples (`modules/lab/examples.json`) | idea, reproduction params, our hypothesis with a predicted metric, sources for paper toys | — | `naming` (ids), `papers-unit` |
| runner (`runners.js`, `interp.js`, `papers.js`, helpers in `util.js`) | deterministic, seeded; params clamped to range and step; paper toys average 10 seeds | — | `lab-unit`, `papers-unit` (runner contract) |
| `runExample` → `verdict` → `judgeInput` (lab.js) | baseline vs variant on the predicted metric; refuted results are kept; judge input reduces each metric to 8/4, 4/8 or 5/5 | — | lineage F, e2e "refuted hypotheses" |
| `GET /api/lab/examples[/:id]` | serves the cached run | — | lineage F |
| `POST /api/lab/examples/:id/run` | stores the variant's predicted metric | `lab_runs` | lineage F |
| `scripts/bench.js` | suites review, lab, interp, papers, analysis; a regression is a worse value beyond `tol` | `bench/baseline.json` (`--update`), `bench/history.jsonl` | preflight "Benchmarks" |

## I. Project, audit and pruning (REQ-030, REQ-019)

- Project issues come from the admin board and from `scripts/project-sync.js` (spec 002 requirements, people checks, Learn jobs, the scheduled watcher), matched by a `sync-key:` marker; only status is synced back.
- `audit.log` records admin actions (target 200, detail 500 characters).
- `prune()` runs at the end of each harvest. It trims `fetch_runs` (2000), `admin_audit` (5000), expired sessions, `review_docs` (1000, with their edges), knowledge chunks outside the newest 2000 stories, old finished Learn jobs (60 days), Lab runs (500) and inactive policies (50). Stories, votes and saves are never pruned.

## J. Code and schema maps

- `modules/codemap/scan.js` → `modules/codemap/data/codemap.json`. It reads every module, both specs and every `test/*.js`; dangling edges are dropped and counted. Checked by preflight "Codebase map" and e2e "Codebase map".
- `schema/types.json` → `schema/gen/*` (zod, pydantic, protobuf, Arrow, JSON-LD, OpenRPC, Rust). Preflight checks the generated files byte for byte.

## Known gaps

All found by reading the code; the three marked **(probed)** were reproduced on synthetic data. None is a regression; each changes behaviour, so each needs a decision before it's fixed.

1. **(probed)** A re-fetched story's stored score goes stale. A story's `ext_score` rose from 10 to 900, but its stored `why` still says "10 points or citations": `rescore` runs only when a new link is added (lib/harvest.js `addItem`). `rank` uses the live value.
2. **(probed)** Repeat reader submissions inflate coverage. Three readers submitting the same URL made 3 links and "+14, 3 independent sources", because a NULL `source_id` never conflicts in the `story_links` unique key.
3. **(probed)** `GET /api/review/docs?verdict=` filters after `LIMIT 100`, so older matching reviews are missed.
4. The effective summary cap is 700 characters (parser), not the 1,500 that INTERFACES.md row 0.5 states (that row needs both partners to change).
5. First source wins: if an aggregator's item (for example an HN points line) arrives before the paper, the story is tagged and scored on the aggregator's text.
6. Items past a feed's `max_items` are lost silently; `fetch_runs.items` records the count after the cap.
7. Deleting a source turns its links into "submitted" links, each counted as a separate source at read time, without rescoring.
8. Reviews are never re-judged after the judges change (`saveReview` returns the stored row).
9. Knowledge chunks keep their old tags after an ontology change (the skip test hashes the text only).
10. Capabilities windows differ by series: benchmarks use all time (LIMIT 400), people use twice the window, organisations have no ORDER BY before their LIMIT.
11. Three term matchers (tagger, si-expr, analysis) treat word boundaries differently; the Review desk reads any `dddd.dddd` number as an arXiv id.
12. `project-sync` matches `sync-key: job:1` with LIKE, which also matches `job:10`–`job:19`.
13. The codemap misses columns added by migration, writes made in another file, and admin guards passed through a shared variable.
14. Lab pruning keeps the newest 500 runs of all kinds, and variants are never deleted, so variants can crowd out run history; a Learn job that throws loses its recorded files.
