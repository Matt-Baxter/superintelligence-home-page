# learn

The ideas behind superintelligence research in plain words, mapped as a graph and linked to feed stories. It also has the "how it works" teardown of the pipeline, a public explainer player, and an admin studio queue for heavy background work.

- **Data:** `data/concepts.json`, with 24 concepts, each having plain words, an analogy, a deeper paragraph, a quiz, relations, terms and, for some, a toy Lean 4 statement. Three Lean statements are proved and check with Lean 4.15 (no Mathlib).
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
