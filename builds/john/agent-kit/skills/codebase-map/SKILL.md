---
name: codebase-map
description: Map of the Superintelligence Homepage code and how a feed item becomes a scored, tagged story on a page. Use first when starting work in a part of the repo you haven't touched, or when asked "where does X happen?".
---

# Codebase map

A modular monolith: one Express app (`server.js`, the core) plus plug-in modules (`modules/<id>/`) loaded by `kernel/kernel.js` through extension points. On Vercel it is one function (`api/index.js`) plus static pages from `public/` (module pages are copied to `public/m/` by the build).

| Area | Files | Skill for changing it |
| --- | --- | --- |
| Feeds in | `lib/feeds.js` (formats, fetching, grouping keys), `lib/harvest.js` (schedule, backoff, logging) | add-sources |
| Meaning | `lib/tagger.js` + `lib/ontology.json` (topics, orgs, benchmarks, people) | tune-ontology |
| Judging | `lib/analysis.js` (type, evidence, benchmarks, significance) | tune-significance |
| Data | `lib/db.js` (one API over SQLite and Postgres, schema, migrations) | write-portable-sql |
| Modules | `kernel/kernel.js`, `modules/modules.json`, `modules/<id>/` (blocks-core, generative-ui, decision, capabilities, admin, project) | add-a-module |
| Generative UI | `views/catalog.mjs` (blocks from modules), `views/specs.mjs`, `client/jr.jsx`, `modules/generative-ui` | generative-ui |
| Decisions | `modules/decision` (judges: weighted-criteria, JEV, CLEF) | run-a-judge |
| Pages | core pages in `public/*.html`; module pages in `modules/<id>/pages/` (served at `/m/<page>`); `public/js/api.js`, `public/css/app.css` | build-a-page |
| Checks | `scripts/preflight.js`, `test/` | run-tests |

## The pipeline in one line

`harvest()` picks due sources → `feeds.fetchSource()` parses items → `addItem()` groups them into stories by key → `tagger.tag()` adds topics and orgs → `analysis.rescore()` stores significance, analysis and `story_entities` → `storyRows()` in `server.js` ranks and shapes stories for every page.

For the step-by-step version (grouping keys, when re-scoring happens, what each table holds), read `references/pipeline.md`.

## Ask the map before grepping

The codemap module parses the repo into a graph: pages → routes they call → tables those routes read or write; modules → extension points; spec REQs → files → tests.
- Terminal: `npm run codemap -- votes` (or `REQ-003`, `project_issues`, `POST /api/lists`).
- MCP: the `codemap_query` tool (`trace: true` returns everything connected).
- Browser: `/m/codemap` (admins), click anything to trace it.
Preflight fails when a page calls an API route that doesn't exist, so a renamed route can't silently break a page.

## Contract

What to build comes from the shared spec (`specs/001-superintelligence-homepage/spec.md`, REQ IDs) under the constitution; `docs/SPEC_TRACE.md` maps each REQ to code and tests. This build's tables, routes and shapes are in `docs/INTERFACES.md`. Changing either: use the change-the-contract skill.
