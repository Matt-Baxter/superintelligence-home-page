---
name: build-a-page
description: Build or change a page in public/ using the shared helpers, styles and conventions (plain HTML and JS, no framework; json-render for server-built views), and check it on phone width. Use when adding a page, a panel, a card element or an admin or project screen.
---

# Build a page

Pages are plain HTML files in `public/` with one inline `<script>`, sharing `public/js/api.js` and `public/css/app.css`. No framework and no build step except the json-render bundle.

1. **Start from a similar page.** `sources.html` (simple table and form), `capabilities.html` (read-only dashboard), `admin.html` (tabs), `project.html` (app shell with keyboard shortcuts).
2. **Skeleton**: `<link rel="stylesheet" href="/css/app.css">`, a `<main>` with a `.pagehead`, then `<script src="/js/api.js"></script>` and your script ending in `requireUser().then(load)`.
3. **Use the helpers** (`api`, `$`, `esc`, `storyCard`, …) and the style tokens instead of writing your own; the list and the class names to avoid are in `references/ui-kit.md`.
4. **Escape everything** you put into `innerHTML` with `esc()`. Links from feeds go in `href` only after `esc()`, with `rel="noopener noreferrer"`.
5. **Admin-only pages** check `user.admin` after `requireUser()`, and the API routes check too (`auth, admin` middleware). Never rely on the page alone.
6. **Add it to the nav** (`NAV` in `api.js`, or the admin-only list in `topbar()`) and to the phone-width loop in `test/e2e.js`.
7. **Check it**: run-tests skill; then look at `shots/` and at 390 px wide. There must be no sideways scroll.

Server-built, data-driven views (the weekly brief, the agent log summary) use json-render: the component catalog is `views/catalog.mjs`, specs are built in `views/specs.mjs`, and the browser renderer is `client/jr.jsx` (run `npm run build` after changing it).
