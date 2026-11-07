---
name: teach-a-concept
description: Add or improve a Learn concept (plain words, analogy, links in the concept graph, quiz, toy Lean proof) and do the Learn studio jobs - blog/Substack drafts, explainer videos, Lean 4 proofs, paper-to-code and reverse-engineering - with the local worker. Use when asked to explain a paper or idea, map concepts, make an explainer or video, prove something in Lean, or turn a paper into code.
---

# Teach a concept

The Learn module (`modules/learn`) holds the concepts behind superintelligence research in `data/concepts.json`, shows them as a graph at `/m/learn`, links them to feed stories by their `terms`, and queues heavy work as **studio jobs**. The web server never does that work, so the free tier is safe. `npm run learn:worker` and you (the agent) do it.

1. **Adding a concept.** Fill in every field and keep the rules:
   - `plain`: two sentences a 15-year-old follows. No jargon left unexplained.
   - `analogy`: one everyday comparison that is true in the way that matters, not just cute.
   - `deeper`: the technical version, one short paragraph.
   - `check`: one question, three options, the answer index and why it's right.
   - `relations`: kinds from `relations` (needs, part-of, leads-to, contrasts, related), pointing at existing ids.
   - `terms`: words that mark a story about it (the tagger's syntax: `word*` for a prefix).
   - `topic`: one of the nine top-level topics.
   - No claims or quotes attributed to real people, and no invented papers.
2. **Toy Lean proofs** (`lean`): a small formal statement of the idea. Set `proved: true` only after the proof checks with plain Lean 4 (no Mathlib): `lean file.lean`. Otherwise leave `sorry`, set `needs`, and queue a `lean-proof` job.
3. **Run the queue:** `npm run learn:worker` (same `DATA_DIR`/`DATABASE_URL` as the site; `BASE` = a running site for video recording; `LEAN` = path to `lean`). Results go to `out/learn/<id>/`:
   - **post** gives `post.md` and `social.md`.
   - **video** gives `storyboard.json`, `narration.txt`, `explainer.py` (Manim), plus `explainer.mp4` recorded from `/m/explainer`.
   - **lean-proof** is checked with Lean.
4. **Agent jobs** (`explain`, `paper-to-code`, `reverse-engineer`, and Lean proofs that need Mathlib) end as `needs-agent` with a `brief.md`. Do the work, then record it: `node scripts/learn-worker.js complete <id> <result.md>`, or add `--failed` with the reason.
   - Paper to code: small runnable code on synthetic data, plus a README of what is and isn't reproduced.
   - Reverse-engineering: mark every guess as a guess.
5. **Publishing is a person's job.**
   - A finished post becomes public only when an admin presses "Publish to RSS". Blog readers and Substack's RSS import can then pull `/api/learn/feed.xml`.
   - Videos and social drafts are uploaded by a person.
   - Never post to an account, and never use Twitter/X.
6. **Check:** run `npm run preflight` (unslop, codemap, smoke) and `npm test` (the Learn section).

Pipeline details and the video look: `references/pipeline.md`.
