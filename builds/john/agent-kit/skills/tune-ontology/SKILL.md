---
name: tune-ontology
description: Change how stories are tagged - topics, organizations, the benchmark registry and the people watchlist in lib/ontology.json - then re-tag and check. Use when stories are mis-tagged or untagged, or when asked to track a new capability, benchmark, organization or person.
---

# Tune the ontology

Everything lives in `lib/ontology.json`: `topics` (with optional `parent`), `scope`, `organizations`, `benchmarks` and `people`. Every tag stores the words that matched, so the UI can explain it.

The top level is fixed by the shared spec: exactly nine topics (Capabilities & AGI progress, Automating AI research, Recursive self improvement, Alignment, Interpretability, Safety & risk, Forecasting & timelines, Compute & scaling, Governance & policy). Add finer topics as children; changing the nine needs both partners and a spec change. `scope` decides the superintelligence-only feed (REQ-003): a story is in when it has a `strong` term or matches `min_topics` top-level topics; when in doubt, leave it out.

1. **Reproduce first**: `node -e "console.log(JSON.stringify(require('./lib/tagger').tag('<title>','<summary>'),null,1))"` on the real titles that went wrong.
2. **Edit the smallest thing**: add or remove a term, or add an entry. Term rules and known false positives are in `references/term-syntax.md`; read it before adding short or ambiguous terms.
3. **Benchmarks and people** have their own fields and rules (score units, generic vs specific names, who may be on the watchlist): `references/benchmarks-and-people.md`.
4. **Check scope and scoring didn't shift unexpectedly**: `node test/analysis-unit.js`, then the browser test (topic filters and the SC-003 in/out checks run there). A new strong term must not let general AI news in; test it on a product-launch title.
5. **Bump `version`** in the ontology when you add or remove a topic, and note it in the PR.
6. **Re-tag existing stories** after merge: Admin → Ontology → "Re-tag every story" (also re-scores them).

A new top-level topic shows on the feed's topic bar. Child topics roll up into their parent's filter.
