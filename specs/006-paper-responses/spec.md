# Feature Specification: Paper responses (extended version)

**Feature Branch**: `feature/paper-responses-2026-11-11`

**Created**: 2026-11-11

**Status**: Proposed, **not approved**. Built on its own `feature/` branch because John asked for it; nothing here is in scope for the bake-off until both partners (John and Matt) approve it (constitution, shared documents). It changes only the extended version (`SITE_PROFILE=extended`): the responses module is not in the spec or research profiles. The shared spec (`specs/001-superintelligence-homepage`) is unchanged.

**Numbering**: REQ-056 to REQ-059 are the next free numbers after spec 005. The REQ-032..035 collision between specs 002 and 003 is still open for both partners; nothing here renumbers anything.

## Overview

Today the Review desk judges a paper from its abstract, and the Learn studio turns a concept or a topic dossier into an explainer. This feature responds to one paper at a time, and reads all of it:

1. **Read the whole paper**: sections, tables (with their cells), figure captions, references and code links, from arXiv's HTML rendering, a PDF or pasted text, fetched politely and cached.
2. **Analyse it against itself**: each stated contribution is matched to the result, table or theorem in the body that backs it; numbers in the abstract are looked for again in the body; a published full-text rigor checklist (baselines, ablations, spread across seeds, statistical tests, held-out data, contamination, code, limitations, compute, theory, independent benchmarks) is scored with each point quoted from where it was found; limitations are collected and open questions written from what is missing.
3. **Plan the response before making it**: audience, a one-line thesis, beats (goal, narration, visual, seconds) and acceptance checks.
4. **Make it**: an animated explainer (Manim Community, narrated by a local voice, with captions), an article with numbered references and short posts, all drafts for a person.
5. **Keep it behind the curtain**: a feature flag in the CMS meta layer (off, staff only, public) decides who sees it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An editor gets a careful reading of a new paper (Priority: P2)

An admin gives an arXiv id. The site reads the paper in full and shows what it claims, which claims the body backs, how careful it is (with the points for each check and where each was found), what it says it can't do and what is still open.

**Independent Test**: On the synthetic sample paper (test data), the numeric claim is matched to its result sentence and table, the "we propose" claim to its method, a claim whose numbers appear only in the abstract is flagged, and the rigor score is the sum of the published points.

**Acceptance Scenarios**:

1. **Given** a paper whose abstract states a number the body never shows, **When** it is analysed, **Then** the number is listed as not found in the body and the claim becomes an open question.
2. **Given** only an abstract, **When** it is analysed, **Then** the result says "abstract only" and is never rated as read in full.

### User Story 2 - An editor turns the reading into a video, an article and posts (Priority: P3)

The admin reads the plan (thesis, beats, acceptance checks), renders the explainer on a machine with Manim (`npm run respond -- <id> --render`), saves the article as an Editorial CMS draft and copies the posts.

**Independent Test**: The plan's machine checks pass (every number in the narration is in the paper or our Lab check; no watched person is named; under 3 minutes); the scene needs no LaTeX and compiles; captions are ordered and inside the video; every post fits its network; the article lands as a draft whose revision says "generate".

### User Story 3 - An admin decides who can see it (Priority: P3)

An admin switches Paper responses off, to staff only, or to public. The change is audited.

**Independent Test**: In staff mode a reader and a guest get 404 and the admin sees it; in public mode a reader can read but not build; off hides it from everyone, the admin included.

### Edge Cases

- arXiv rate limits or the HTML rendering is missing: one request at a time at least 3 s apart, HTML first and the PDF as a fallback, cached so a paper is fetched once.
- A paper with no tables, no method section or no numbers: the plan leaves those beats out rather than inventing them.
- No voice installed: the video has captions only. No Manim: the scene and the command to render it are written, and the browser explainer plays the same beats.
- A Twitter/X link as a source: refused.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-056**: In the extended version, the system SHOULD read a paper's full text (arXiv HTML, PDF or pasted text) into sections, tables with their cells, figure captions, references and code links, fetching at most one request every 3 seconds, caching what it fetched, never using arXiv's API host for this, and saying when only the abstract could be read.
- **REQ-057**: The system SHOULD analyse a read paper against its own body: match each stated contribution to the results, tables or theorems that back it; look for each abstract number in the body; score a published full-text rigor checklist whose every point quotes where it was found; list stated limitations; and write open questions from what is missing. The paper's statements are reported as the paper's and no claim is attributed to a person.
- **REQ-058**: For each analysed paper, the system SHOULD write a plan (audience, thesis, beats with narration, visual and duration, acceptance checks) and from it an animated explainer video with narration and captions, an article with numbered references and short posts, at no paid-API cost, rendered off the web server; the paper's own numbers are labelled as the paper's, toy results as toy scale, and a person reviews and publishes everything (no Twitter/X version, nothing posted automatically).
- **REQ-059**: An admin SHOULD switch paper responses off, to staff only or to public with a feature flag kept in the CMS meta layer (the site settings beside the look), audited; off hides every route, staff shows them to admins only, and building or drafting stays admin-only in every mode.

### Key Entities

- **Paper response**: one row per paper (`responses_papers`): slug, title, link and the package (analysis, plan, checks, article, posts, storyboard).
- **Feature flags**: one row, key `features`, in `appearance_settings`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-601**: On the synthetic sample papers, every claim's level, every abstract number's status and every checklist item match their labels (unit check).
- **SC-602**: 100% of numbers in a plan's narration are found in the paper's text or our Lab check, or the plan's "cites" check fails.
- **SC-603**: A rendered explainer costs $0 in paid services and renders on a laptop CPU in under 2 minutes for a 2-minute video at 720p.
- **SC-604**: With the flag off, every responses route answers 404 for every user.

## Assumptions

- Matching claims to evidence by shared words and numbers is a pointer for a person to verify, not proof; the page and article say so.
- A local text-to-speech voice is good enough for drafts; a person may re-record narration before publishing.
- Reading a paper's public HTML or PDF for analysis, one at a time and cached, is within arXiv's terms for automated access; both partners confirm this at approval.

## Out of Scope

- Model-written analysis (it would follow REQ-034's two-model rules) and paid voices.
- Posting or uploading videos anywhere.
- Changing the shared spec's REQ-001..REQ-020.
