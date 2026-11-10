# learn

The ideas behind superintelligence research in plain words, mapped as a graph and linked to feed stories. It also has the "how it works" teardown of the pipeline, a public explainer player, and an admin studio queue for heavy background work.

- **Data:** `data/concepts.json`, with 28 concepts, each having plain words, an analogy, a deeper paragraph, a quiz, relations, terms and, for some, a toy Lean 4 statement. Three toy Lean statements check with pinned Lean4.15.0 (no Mathlib); `npm run test:proofs` rechecks their source and axiom footprint. Two other statements remain incomplete.
- **Table:** `learn_jobs`, pruned after 60 days unless published.
- **Routes:**
  - signed in: `GET /api/learn/concepts`, `GET /api/learn/concepts/:id`, `GET /api/learn/story/:id`, `POST /api/learn/teardown`, `GET /api/learn/posts/:id`;
  - public: `GET /api/learn/explainer/:id`, `GET /api/learn/feed.xml`;
  - admins: `GET|POST /api/admin/learn/jobs`, `GET|PUT|DELETE /api/admin/learn/jobs/:id`.
- **Pages:**
  - `/m/learn`, with the concept map, a page per concept, How it works, Studio jobs (admins) and published posts;
  - `/m/explainer?c=<id>`, the video player.
- **Worker:** `npm run learn:worker` (`scripts/learn-worker.js`) makes drafts, videos (Playwright recording, ffmpeg, Manim scene) and Lean checks. Agent jobs get a brief. See the teach-a-concept skill.
- **Nothing is posted automatically.** A person publishes a post to the RSS feed or uploads a video.

## Term pointers

The public `/m/glossary` and `/api/learn/glossary` serve the sourced registry in `data/glossary.json`. `glossary.js` validates pointers and contributes `term:` mention tags and related graph edges. Browser reading pointers skip editable/interactive/code regions and preserve exact text. `public/js/term-model.js` is shared with Node for literal matching and bounded numeric examples. Run `node test/terms-property-unit.js` and `npm run test:terms` against synthetic fixtures. After registry changes, an admin may rebuild Knowledge; this does not alter significance scoring or publish content.
