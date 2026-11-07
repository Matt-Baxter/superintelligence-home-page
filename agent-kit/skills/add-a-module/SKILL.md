---
name: add-a-module
description: Add a feature as a plug-in module of the modular monolith (modules/<id>/ with module.js, routes, pages, blocks, views, judges, signals, formats or tables) through the kernel's extension points, or unplug one. Use when building any new feature, moving one out of the core, or asked to "make it a plugin".
---

# Add a module

Everything beyond the core (accounts, stories, lists, feeds, tagging, analysis) is a module in `modules/<id>/`, loaded by `kernel/kernel.js` from `modules/modules.json`. Read `modules/README.md` for the picture.

1. **Pick the extension points** the feature needs (routes, nav, blocks, views, schema, formats, signals, judges). The table with the exact call for each, and the lifecycle, is in `references/extension-points.md`.
2. **Scaffold** `modules/<id>/module.js` from the template in `references/module-template.md`, plus a `README.md` (what it does, the points it uses, routes, pages, tables).
3. **Write the parts**: `routes.js` (gets `deps`: db, auth, admin, wrap, storyRows, views, …), `pages/*.html` (served at `/m/<page>`; use the build-a-page skill), `blocks/` (use the generative-ui skill), judges (use the run-a-judge skill).
4. **Respect boundaries**: use the core through `deps` or `lib/`; never require another module's files. Need something from another module? Give that module an extension point.
5. **Enable it** in `modules/modules.json`, then `npm run build` (generates the block registry and copies pages) and `npm run modules:check`.
6. **Contract**: new tables or routes need a row in `docs/INTERFACES.md` (change-the-contract skill).
7. **Test**: add browser checks to `test/e2e.js` and, for headless logic, a check in `test/kernel-unit.js` using a fixture module in `test/fixtures/modules/` (run-tests skill).

To unplug: remove the id from `modules.json` (or set `MODULES_DISABLED=id`). Pages, nav, routes and blocks disappear; its tables stay.
