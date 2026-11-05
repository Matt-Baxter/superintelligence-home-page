---
name: tune-ontology
description: Change how stories are tagged - topics, organizations, the benchmark registry and the people watchlist in lib/ontology.json - then re-tag and check. Use when stories are mis-tagged or untagged, or when asked to track a new capability, benchmark, organization or person.
---

# Tune the ontology

Everything lives in `lib/ontology.json`: `topics` (with optional `parent`), `organizations`, `benchmarks` and `people`. Every tag stores the words that matched, so the UI can explain it.

1. **Reproduce first**: `node -e "console.log(JSON.stringify(require('./lib/tagger').tag('<title>','<summary>'),null,1))"` on the real titles that went wrong.
2. **Edit the smallest thing**: add or remove a term, or add an entry. Term rules and known false positives are in `references/term-syntax.md`; read it before adding short or ambiguous terms.
3. **Benchmarks and people** have their own fields and rules (score units, generic vs specific names, who may be on the watchlist): `references/benchmarks-and-people.md`.
4. **Check scoring didn't shift unexpectedly**: `node test/analysis-unit.js`, then the browser test (topic filter counts are checked there).
5. **Bump `version`** in the ontology when you add or remove a topic, and note it in the PR.
6. **Re-tag existing stories** after merge: Admin → Ontology → "Re-tag every story" (also re-scores them).

A new top-level topic shows on the feed's topic bar. Child topics roll up into their parent's filter.
