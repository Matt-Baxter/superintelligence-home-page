# Learn pipeline details

## Video

`/m/explainer?c=<id>` plays the storyboard from `GET /api/learn/explainer/:id`. The look is a dark math film: one background, white type, a teal accent, and motion that explains.

- **Scenes:** title → plain words → analogy → graph of neighbours → a little deeper → check yourself. The lengths come from `seconds` in `learn.js` `storyboard()`.
- **Motion:**
  - text reveals with a clip-path mask (motion rule 17);
  - arrows draw along arcs (rule 7);
  - options come in staggered;
  - the right answer pulses once (rule 8);
  - the old and new scenes overlap (rule 16).
- **Recording:** `?record=1` hides the controls and sets `window.__explainerDone` at the end. The worker records 1280×720 with Playwright and converts to H.264 MP4 with ffmpeg (`-preset veryfast`).
- **Manim:** `explainer.py` is the same storyboard as a Manim Community scene, for a hand-tuned 3Blue1Brown-style render. Run `pip install manim` (it needs the cairo and pango dev libraries), then `manim -qm explainer.py <Class>`.

## Free tier

- The server only stores jobs (table `learn_jobs`). Unpublished finished jobs are pruned after 60 days.
- No polling: the worker runs once and exits. A person or a daily scheduled job runs it.
- No paid API calls. Agent jobs are done by a person's Claude Code session.

## Teardown (proposed REQ-021)

`POST /api/learn/teardown` runs `fetch → group → tag → scope → score → concepts → feed` with the real code and writes nothing. Grouping uses one `story_keys` lookup per key.
