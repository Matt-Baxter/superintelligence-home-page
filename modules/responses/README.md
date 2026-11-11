# Paper responses (proposed REQ-056..059, spec 006)

Reads one paper in full, checks its claims against its own body, plans a response and drafts an animated explainer, an article and posts. Extended profile only; behind a feature flag.

- `reader.js`: arXiv HTML (LaTeXML sections, tables with cells, figure captions, references, code links), PDF via `pdftotext`, or plain text. Fetches one request per 3 s, HTML first then PDF, cached in `out/papers/<id>/`. Never uses arXiv's API host.
- `analysis.js`: contributions → the body results, tables or theorems that back them (`backed`, `described`, `partly backed`, `not found in the body`); abstract numbers looked for in the body; the full-text rigor checklist (`CHECKS`, 100 points, each met item quotes where it was found) with penalties; limitations; open questions.
- `plan.js`: thesis, audience, beats (goal, narration, visual, seconds) and acceptance checks; `check()` traces every narrated number to the paper or our Lab check.
- `video.js`: a Manim Community scene (no LaTeX needed), narration per beat (Piper, espeak-ng or none), captions (SRT), ffmpeg mux into `video.mp4` with a subtitle track; the same beats for `/m/explainer?r=<slug>`.
- `write.js`: the article (numbered references, the rigor table, "not a peer review") and posts (Bluesky, Threads, Mastodon, LinkedIn, Substack note; no Twitter/X).
- `flags.js`: `responses` = `off` | `staff` | `public`, stored in `appearance_settings` (key `features`).

Run: `npm run respond -- 2611.10787 --render` writes `out/response/<slug>/` (plan.md, article.md, social.md, scene.py, captions.srt, narration, video.mp4). Install `pip install manim` (needs the Pango dev headers) and `espeak-ng`, or a Piper voice for a better one. Checks: `npm run test:responses`.
