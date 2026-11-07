# Feature Specification: Judge fidelity and stability (extended version)

**Feature Branch**: `feature/judge-fidelity-spec`

**Created**: 2026-11-07

**Status**: Proposed, **not approved**. Nothing here is in scope until both partners (John and Matt) approve it (constitution, shared documents). It changes only the extended version (`SITE_PROFILE=extended`): the Review desk, the paper watcher and the dossier from `specs/002-research-layer`. The shared spec (`specs/001-superintelligence-homepage`) is unchanged by it.

**Input**: the 2026-11-07 paper watch, where rewording the same facts about one paper moved its credibility from 55 to 63, across the cutoff of 60 the dossier uses to call a paper credible; a survey of methods (`research.md`); and an edge-case catalogue run against today's rules (`bench/judge-edge-cases.json`, 69 synthetic cases: 22 pass, 47 are known gaps); a paraphrase-fidelity set (`bench/fidelity-cases.json`: today's judge can't tell 24 of 26 unfaithful paraphrases from their source, and 13 of 25 faithful rewordings move its credibility); property tests (`test/judge-properties.js`); and a Lean 4 model of the arithmetic (`proofs/`, written, not yet checked).

## Overview

The Review desk's judges are pure functions with no model calls, so they are deterministic: the same text always gets the same judgement. What isn't stable is the text they read. The watcher's agent paraphrases each arXiv abstract, and the judges score the paraphrase, so a judgement depends on how the agent happened to word it. The evidence markers also miss common equivalent wordings (passive voice, number words, "95% CI", "we release our code"), ignore negation ("we do not compare with a baseline" earns baseline credit), and a single cutoff turns a few points of wording noise into a different rating.

This feature makes the judgements **logical and stable**:

1. read a canonical form of the source, not whatever text arrived;
2. score the source, and check any paraphrase for fidelity separately, so wording can't move a score;
3. recognise equivalent wordings and negation, with every case in a labelled synthetic catalogue;
4. report scores in bands with a margin, so a score near a cutoff says "borderline" instead of flipping;
5. state the scoring rules' properties precisely, test them on every change, and prove the arithmetic ones in Lean 4.

**The failure we're preventing:** a paper looks credible or not depending on who summarised it, or a rule that seems sensible fails on an input nobody tried.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The same paper always gets the same judgement (Priority: P1)

The watcher (or a reader) gives the Review desk an arXiv paper. Its scores come from the paper's own abstract, put in a canonical form first. An agent's paraphrase is shown only after a fidelity check, and never changes a score.

**Why this priority**: It removes the instability found on 2026-11-07, and everything else rests on it.

**Independent Test**: Judge a synthetic sample abstract, then judge it again with three meaning-preserving rewordings of the paraphrase and with spacing, Unicode and LaTeX variants of the abstract.

**Acceptance Scenarios**:

1. **Given** a synthetic abstract and any paraphrase of it, **When** both are judged, **Then** the significance, rigor, hype and credibility scores are those of the canonical abstract, whatever the paraphrase says.
2. **Given** a paraphrase that changes a number, drops a hedge, adds a claim, negates a claim or names an entity the abstract doesn't, **When** its fidelity is checked, **Then** the check fails, says which sentence and which check, and the paraphrase is withheld from the page and the dossier.
3. **Given** the same abstract with extra spaces, a non-breaking space, full-width digits, zero-width characters or `$4\%$`, **When** it is judged, **Then** it gets the same document id and the same scores.
4. **Given** an abstract longer than the judge reads, **When** it is judged, **Then** the cut is reported as a reason, never silent.

### User Story 2 - Equivalent wording earns the same credit, negated wording earns none (Priority: P1)

**Why this priority**: Without it, the rules reward phrasing and punish careful writing (passive voice, spelled-out numbers).

**Independent Test**: `node test/judge-edge-cases.js`: every case marked `ok` passes, and the number of known gaps only goes down.

**Acceptance Scenarios**:

1. **Given** a sentence and a rewording of it from the catalogue (passive voice, "four percent", "4 percentage points", "over three seeds", "95% CI", "p = 0.03", "we release our code", "12 synthetic tasks"), **When** both are judged, **Then** they earn the same evidence markers.
2. **Given** a negated marker ("we do not compare with a baseline", "there is no held-out test set", "we report no limitations"), **When** it is judged, **Then** it earns no more than the text without that sentence.
3. **Given** a hype word inside a negation ("we do not claim a breakthrough") or a name ("a Sample Massive Multitask benchmark"), **When** it is judged, **Then** it doesn't count as hype.
4. **Given** a paper that describes prompt-injection attacks, **When** it is judged, **Then** it is not capped as if it addressed the judge; **given** text that does address the judge in other words or with hidden characters, **Then** it is.

### User Story 3 - Scores near a cutoff say so (Priority: P2)

**Why this priority**: Even stable rules have noise near a cutoff; a reader should see "borderline", not a confident label that a few points could flip.

**Independent Test**: Judge synthetic abstracts whose credibility sits at, just below and just above each cutoff.

**Acceptance Scenarios**:

1. **Given** a cutoff T and margin m, **When** a score S is reported, **Then** it is in exactly one band: Low (S < T − m), Border (T − m ≤ S < T + m) or High (S ≥ T + m).
2. **Given** any single evidence marker added or removed, **When** the score is recomputed, **Then** the band moves by at most one step (Low to Border or Border to High, never Low to High).
3. **Given** a dossier, **When** it rates a topic, **Then** only High papers count as credible, Border papers are listed as borderline, and the rating never exceeds what High papers and linked toy checks support.
4. **Given** a paper already judged, **When** it is judged again with the same arXiv version and the same rules version, **Then** its band doesn't change; it changes only with a new version of the paper or of the rules, and the change is shown with both versions.

### User Story 4 - The rules' properties are stated, tested and, where arithmetic, proved (Priority: P2)

**Why this priority**: Tests check the inputs someone thought of; properties and proofs cover all inputs.

**Independent Test**: `node test/judge-properties.js` (property tests over generated synthetic inputs) and, where Lean 4 is installed, `lake build` in `proofs/` with no `sorry`.

**Acceptance Scenarios**:

1. **Given** any input, **Then** every score is an integer in 0..100, the guarded score is at most the rigor cap and at most 30 when the text addresses the judge, and no marker family counts twice.
2. **Given** any input and a marker added to it, **Then** rigor doesn't fall (monotonicity), and **given** canonicalisation applied twice, **Then** the result equals applying it once (idempotence).
3. **Given** the arithmetic layer written as portable rules (`lib/expr`), **Then** a Lean 4 model of it proves the properties above, and a differential test checks the Lean evaluator and the JavaScript one agree on generated cases.

### User Story 5 - Peer reviews and reader comments get the same treatment (Priority: P3)

**Why this priority**: Useful signals, but noisier and less available than abstracts; they come after the paper path is stable.

**Independent Test**: Judge synthetic reviews and synthetic comments from the catalogue.

**Acceptance Scenarios**:

1. **Given** public reviews for a paper (OpenReview, CC BY 4.0), **When** they are summarised, **Then** the page shows aspect tags (soundness, clarity, originality, substance, replicability, comparison), the mean, the spread and the number of reviews, never a reviewer's identity, and a paper with no reviews is treated as unreviewed, not as weak.
2. **Given** a reader comment, **When** it is judged, **Then** it is marked as making a claim, asking a question, adding evidence (a checkable link or arXiv id) or rebutting, with its stance shown as leans agree / leans disagree / unclear and the cue words that decided it; length earns credit only up to a cap.
3. **Given** fewer than 5 ratings on a comment, or raters with fewer than 10 ratings each, **When** comments are ranked, **Then** bridging-style ranking is not used and the comment shows "needs more ratings".

### Edge Cases

The full catalogue, with the expected behaviour and the test type of each, is `bench/judge-edge-cases.json` (synthetic test data) plus the stage list in `plan.md`. The ones that shape the requirements:

- An abstract that is empty, a title only, under 25 words, truncated, in LaTeX, in another language, or full of homoglyphs and zero-width characters.
- A new arXiv version with a changed abstract, a withdrawn paper, and the same paper arriving with and without its version suffix.
- Surveys titled "X: A Survey" or "A Review of X"; position papers; datasets and benchmarks; negative results.
- Numbers as words, with units, as ranges, as approximations, and percent vs percentage points.
- Negation, double negation, hedges ("may", "suggests"), and claims made only in the title.
- Paraphrases that add, drop, merge, invert or soften claims, or change a number or a hedge.
- Scores exactly on a cutoff, ties, and several markers changing at once.
- Reviews that are missing, partial, withdrawn or LLM-assisted (only estimable per venue, never per review), and rebuttals.
- Comments that stuff keywords, drop names, inject instructions, quote the paper verbatim, are sarcastic, off-topic or very long.

## Requirements *(mandatory)*

### Functional Requirements

- **REQ-032**: Before judging, the system SHOULD put the text in a canonical form (Unicode NFKC, zero-width and format characters removed, confusable letters mapped for the guards, whitespace collapsed, common LaTeX forms rewritten), derive the document id from the canonical text and, for arXiv papers, the id and version, and report any truncation as a reason.
- **REQ-033**: For a paper with a source abstract, the system SHOULD compute every score from the canonical abstract and check any paraphrase separately for fidelity (numbers and units, named entities, hedges, negation, claims added or dropped), withholding a paraphrase that fails and never letting it change a score; the abstract itself is used at judging time and only a hash and the 400-character excerpt are stored (REQ-007).
- **REQ-034**: The evidence markers SHOULD recognise the equivalent wordings and number forms in the edge-case catalogue, and the catalogue SHOULD gate changes: a case marked `ok` that breaks fails preflight, and the count of known gaps is reported and only goes down (REQ-029).
- **REQ-035**: Negated markers, hype words inside negations or names, and text that describes attacks rather than addressing the judge SHOULD earn nothing and trigger nothing; text that addresses the judge in other words or with hidden characters SHOULD still be flagged.
- **REQ-036**: The kind detector SHOULD recognise surveys and reviews by their common title forms, and distinguish position papers, datasets or benchmarks and negative results, each judged on what that kind of paper can show.
- **REQ-037**: Verdicts and the dossier's "credible" test SHOULD use half-open bands around each cutoff with a stated margin m such that 2m is at least the largest change one marker can make to that score (so a single marker can never skip the Border band), show Border items as borderline, count only High items as credible, and change a stored band only with a new paper version or rules version.
- **REQ-038**: The scoring rules' properties (bounds, the caps, no double counting, monotonicity, idempotent canonicalisation, exhaustive bands, the one-step band limit) SHOULD be checked by property tests on every change, and the arithmetic layer SHOULD be written as portable rules with a Lean 4 model that proves them and a differential test against the JavaScript evaluator; Lean runs in the worker, not on the web server.
- **REQ-039**: Where public peer reviews exist, the system SHOULD show their aspect tags, mean, spread and count with their licence and link, never reviewer identities, and treat a paper without reviews as unreviewed.
- **REQ-040**: Reader comments SHOULD be marked by role (claim, question, evidence, rebuttal) and stance (leans agree, leans disagree, unclear) with the deciding cue words, give length credit only up to a cap, credit only checkable evidence (links, arXiv ids, DOIs), and use bridging-style ranking only with at least 5 ratings per comment and 10 per rater.

### Key Entities

- **Canonical text**: the normalised abstract or comment the judges read, its hash and the rules version that produced it.
- **Fidelity check**: one paraphrase checked against one source, each check's result and the sentence it concerns.
- **Band**: a score's band (Low, Border, High) for a named cutoff and margin, with the versions it was computed from.
- **Edge case**: a synthetic input or pair, the stage it tests, the requirement it serves, the expected relation and its status (`ok` or `gap`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301**: Every case in the edge-case catalogue marked `ok` passes on every change; the known gaps (47 on 2026-11-07) fall to 0 as REQ-032..REQ-036 are built.
- **SC-302**: Meaning-preserving rewordings of a paraphrase change no score (0 points), because scores come from the abstract.
- **SC-303**: No single marker change moves an item more than one band, checked by property tests over at least 1,000 generated synthetic inputs (`node test/judge-properties.js`, 1,200 by default; preflight runs a 300-input sample).
- **SC-304**: The Lean 4 model proves the bounds, caps, monotonicity and band properties with no `sorry`, and agrees with the JavaScript evaluator on every generated case.

## Assumptions

- Abstracts from arXiv are CC0 metadata (arXiv API terms), so reading them at judging time is allowed; REQ-007 still limits what is stored to a hash and an excerpt.
- Thresholds and margins in this spec are placeholders until calibrated on the labelled synthetic set (`bench/review-set.json`) and then frozen by rules version.
- Neural fidelity checkers (small NLI models) stay optional: they are known to reject faithful but heavily reworded paraphrases (`research.md`), and no paid API is called by default.

## Out of Scope

- Changing the shared spec's REQ-001..REQ-020.
- Any Twitter/X data, including the Community Notes rating files (only the published algorithm is reused, on this site's own ratings).
- Attributing claims or results to named people; reviewers stay anonymous.
