# research

The research layer that feeds the feed: plain-language write-ups of reviewed papers and topic dossiers, an RSS feed another site adds as a source (each item keeps the paper's title, so it groups with the paper's story there), open data, and the control room that runs the layer from the web app. Hidden unless `RESEARCH_PUBLIC=1` or you're a signed-in admin; always tagged "Research preview" and noindex. Runs alone as `SITE_PROFILE=research` or inside `extended`. See `docs/RESEARCH_SITE.md`.

- **Pages** (`render.js`, server-built): `/research`, `/research/paper/:id`, `/research/topic/:topic`, `/research/criteria`, `/research/outlets`, `/research/transfer` (the judge on 16 fields outside AI, re-run live), `/research/feed.xml`, `/research/data.json`.
- **Control room**: `/m/control` (admins): forecasts to resolve, reviews to label, requirements to approve, judging quality, the panel's set-up, and "Everything this app can do", a runnable list built from the action catalog. **Route**: `GET /api/admin/research/status`.
- **Uses from other modules, through extension points only** (`deps.js`): `review.judge` (required), `lab.examples`, `learn.concepts`, `project.sync` (optional, null when the module is off).
- **Tables**: none of its own; reads the review desk's.
- **On start**: in `SITE_PROFILE=research`, switches on the catalog's checked buzz feeds once.
- **Checks**: research feed test (`test/research-feed.js`), rigor badge test, meta unit test.
