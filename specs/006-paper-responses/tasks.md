# Tasks: Paper responses

**Spec**: [spec.md](spec.md)

Same tags as `specs/004-parity/tasks.md`: `[agent]` any agent on a `feature/` branch, `[rules]` changes scoring (only when a person asks), `[people]` John and Matt decide. **Format**: `- [ ] T### [who] [REQ-0xx] description (files)`.

## Phase 0: approval

- [ ] T600 [people] [REQ-056] Approve, change or drop REQ-056..REQ-059, and confirm that reading public arXiv HTML or PDFs one at a time, cached, is acceptable automated access.
- [ ] T601 [people] [REQ-059] Decide the flag's default for a deployment (today: staff only).

## Phase 1: built on feature/paper-responses-2026-11-11

- [x] T610 [agent] [REQ-056] Full-text reader: arXiv HTML, PDF via pdftotext, plain text; polite, cached fetch (modules/responses/reader.js)
- [x] T620 [rules] [REQ-057] Claim-to-evidence map, abstract numbers in the body, full-text rigor checklist, limitations, open questions (modules/responses/analysis.js)
- [x] T630 [agent] [REQ-058] Plan with beats and acceptance checks (modules/responses/plan.js)
- [x] T631 [agent] [REQ-058] Manim scene without LaTeX, local narration, captions, ffmpeg mux, browser-player beats (modules/responses/video.js)
- [x] T632 [agent] [REQ-058] Article with numbered references and posts (modules/responses/write.js); CLI (scripts/respond.js) and Learn worker job "response"
- [x] T640 [agent] [REQ-059] Feature flag in appearance_settings, audited admin route, gated routes and page (modules/responses/flags.js, routes.js, pages/responses.html)
- [x] T650 [agent] [REQ-056] Unit and route checks on synthetic sample papers (test/responses-unit.js)

## Phase 1b: production planning and learning

- [x] T670 [agent] [REQ-060] Viewer model, A* over beats, Q-learning over offerings, Lab runners and bench suite (modules/lab/production.js)
- [x] T671 [agent] [REQ-060] Line-aligned scenes with a local neural voice and a voice cache (modules/responses/video.js, tts_kokoro.py)
- [x] T672 [agent] [REQ-060] Render QA, calibration and the learnings ledger with enforced guards (modules/responses/qa.js, learnings.json)
- [ ] T673 [agent] [REQ-060] Let A* choose the order of beats too (a strong paper scored best evidence-first, a thin one question-first)
- [ ] T674 [people] [REQ-060] Replace the simulated viewer and channel numbers with real ones (watch time, reach) once anything is published

## Phase 2: later

- [ ] T660 [agent] [REQ-056] Read the daily watcher's top papers in full and attach the full-text rigor to their Review desk records
- [ ] T661 [rules] [REQ-057] Benchmark the full-text checklist on a labelled synthetic set (bench/), like the Review desk's judges (REQ-029)
- [ ] T662 [agent] [REQ-058] A neural local voice by default (Piper voice download step in docs), and a burned-in caption option
