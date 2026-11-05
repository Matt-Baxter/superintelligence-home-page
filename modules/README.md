# Modules: a modular monolith

The app is one deployable (one Vercel function, one database) built from a small **core** and **modules** that plug into **extension points**. Borrowed from Backstage (owners declare extension points, modules contribute, owners read contributions when they start) and BlockSuite / AFFiNE (one provider per feature; headless parts separate from view parts; string keys; schema-validated definitions).

```
core (server.js, lib/)           kernel (kernel/kernel.js)                     modules (modules/<id>/)
 accounts, stories, lists,  ←──  loads modules.json, sorts by requires,  ←──  module.js  { id, version, description,
 agent log, feeds, tagging,       declares extension points, runs              requires, register(env), setup(ctx) }
 analysis, harvest                register → setup → mount → start             routes.js, pages/, blocks/, views, judges…
```

## Extension points

| Id | Owner | Contribute with | Used for |
| --- | --- | --- | --- |
| `http.routes` | kernel | `.add((app, deps) => …)` | API routes; `deps` has db, auth, admin, wrap, storyRows, views, … |
| `ui.nav` | kernel | `.add({ href, label, admin?, order? })` | Top-bar links (returned with `/api/me`) |
| `ui.blocks` | kernel | a `blocks/<Name>/{block.mjs, render.jsx}` folder | json-render components (generative UI) |
| `ui.views` | kernel | `.add(name, { title, description?, admin?, spec \| build(deps, req) })` | Generated views at `/m/view?name=` |
| `db.schema` | kernel | `.addSql(sql)`, `.addColumns([[table, col, type]])`, `.addPrune(async (db) => …)` | Module tables, migrations, keeping the free tier |
| `feeds.formats` | kernel | `.add(id, { label, json, parse(body) })` | New feed or API formats for harvesting |
| `analysis.signals` | kernel | `.add({ factor, max, score(ctx) → { points, detail } })` | Extra significance signals (shown as `why` lines) |
| `decision.judges` | decision | `.add({ id, name, description, method, judge(input) })` | Decision models (weighted-criteria, JEV, CLEF, …) |

Pages in `modules/<id>/pages/*.html` are served at `/m/<page>` (the build copies them to `public/m/` for Vercel).

## Rules
- **Additive only.** Extension points grow; to change one, add a new id (`…V2`) and deprecate the old.
- **Boundaries.** A module may use the core (`deps`, `lib/`, `views/`) but never another module's files; it talks to other modules only through extension points. `npm run modules:check` enforces this.
- **Headless first.** Definitions (block props, judges, signals, formats) run without a browser; views are separate files.
- **Fail loudly at boot**, with the module's name: unknown extension point, missing dependency, duplicate id.
- **Unplug** a feature by removing it from `modules.json` (or `MODULES_DISABLED=id` per environment). Tables a module owns stay in the database.
- **Contract.** A module's tables and routes are part of `docs/CONTRACT.md` like any other.

## Add a module
Use the add-a-module skill (`agent-kit/skills/add-a-module`).
