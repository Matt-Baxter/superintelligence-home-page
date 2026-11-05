---
name: codebase-map
description: Map of the Superintelligence Homepage code and how a feed item becomes a scored, tagged story on a page. Use first when starting work in a part of the repo you haven't touched, or when asked "where does X happen?".
---

# Codebase map

One Express app (`server.js`) serves JSON under `/api` and static pages from `public/`. On Vercel it runs as one function (`api/index.js`).

| Area | Files | Skill for changing it |
| --- | --- | --- |
| Feeds in | `lib/feeds.js` (formats, fetching, grouping keys), `lib/harvest.js` (schedule, backoff, logging) | add-sources |
| Meaning | `lib/tagger.js` + `lib/ontology.json` (topics, orgs, benchmarks, people) | tune-ontology |
| Judging | `lib/analysis.js` (type, evidence, benchmarks, significance) | tune-significance |
| Data | `lib/db.js` (one API over SQLite and Postgres, schema, migrations) | write-portable-sql |
| Admin | `lib/admin.js`, `lib/audit.js`, `lib/project.js` | write-portable-sql, build-a-page |
| Pages | `public/*.html`, `public/js/api.js`, `public/css/app.css`; json-render in `views/` + `client/` | build-a-page |
| Checks | `scripts/preflight.js`, `test/` | run-tests |

## The pipeline in one line

`harvest()` picks due sources → `feeds.fetchSource()` parses items → `addItem()` groups them into stories by key → `tagger.tag()` adds topics and orgs → `analysis.rescore()` stores significance, analysis and `story_entities` → `storyRows()` in `server.js` ranks and shapes stories for every page.

For the step-by-step version (grouping keys, when re-scoring happens, what each table holds), read `references/pipeline.md`.

## Contract

Anything another partner builds against (tables, routes, request and response shapes) is listed in `docs/CONTRACT.md`. Changing it: use the change-the-contract skill.
