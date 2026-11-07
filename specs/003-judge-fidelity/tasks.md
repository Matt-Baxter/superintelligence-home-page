# Tasks: Judge fidelity and stability

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Any agent (Codex, v0, Claude or another) picks up work here. `scripts/project-sync.js` mirrors every task below into the Project tracker (`/m/project`) as one issue, and its status follows the checkbox: tick a task in the same commit that finishes it.

**Who may do a task**

- `[agent]`: any agent may do it unattended, on a `feature/` branch: tests, catalogue cases, docs, proofs and measurements. It changes no scoring rule.
- `[rules]`: changes how items are scored. An agent does it only when a person asks for it in a session, on a `feature/` branch, with `npm run bench` and `node test/judge-edge-cases.js` showing no regressions.
- `[people]`: John and Matt decide.

**Format**: `- [ ] T### [who] [REQ-0xx] description (files)`. Mark `[P]` when it can run in parallel with others.

## Phase 0: approval

- [ ] T000 [people] [REQ-032] Approve, change or drop REQ-032..REQ-040 (this spec). Until then it's extended-version only.

## Phase 1: measure (no rule changes)

- [x] T001 [agent] [REQ-034] Edge-case catalogue of 35 synthetic cases, with a runner that fails only on regressions and reports known gaps (bench/judge-edge-cases.json, test/judge-edge-cases.js, preflight)
- [x] T002 [agent] [P] [REQ-034] Add catalogue cases for segmentation (e.g., et al., decimals, Fig.), ranges ("3–5%"), approximations ("~4%", "about 4%"), double negation, hedges ("may", "suggests"), merged sentences and title-only claims (bench/judge-edge-cases.json) (done: 27 cases; after an audit the catalogue is 69 cases, 22 pass, 47 known gaps)
- [x] T003 [agent] [P] [REQ-033] Paraphrase-fidelity catalogue: synthetic source/paraphrase pairs that change a number, drop a hedge, add a claim, invert a claim, add an entity, or are faithful rewordings, each labelled with the expected check result (bench/fidelity-cases.json) (done: 5 sources, 51 paraphrases; today's judge can't tell 24 of 26 unfaithful ones from their source; `node test/fidelity-cases.js --baseline`)
- [x] T004 [agent] [P] [REQ-038] Property tests over generated synthetic inputs for the plan's properties 2–7, run against today's code; record which hold (test/judge-properties.js) (done: 8 hold, 3 fail on today's code: survey sentence order, a repeated survey sentence placed first, and the one-flip credibility bound when the flip also unbacks a claim)
- [x] T005 [agent] [P] [REQ-038] Lean 4 model of plan steps 3–7 (hype, credibility, guarded score, bands, rating) with theorem statements; proofs may be `sorry` at first and are filled in as they are checked (proofs/Judge.lean, proofs/lakefile.lean) (written, not yet checked by Lean: 40+ theorems, no `sorry`; proofs/README.md lists them; T007 checks them)
- [x] T006 [agent] [P] [REQ-037] Report how many reviewed papers in the catalog sit within 5 points of a cutoff (35, 60, 70), from a dry run on the fixtures (scripts/judge-report.js) (done: `npm run judge:report`; 2 of 3 papers watched on 2026-11-07 sit within 5 of 60)

- [ ] T007 [people] [REQ-038] Install Lean 4 (elan, from https://lean-lang.org) on a machine you control, run `cd proofs && lake build`, and record which theorems check; agents may not run installers unattended
- [ ] T008 [agent] [REQ-034] Add a pure dropped-result case to bench/fidelity-cases.json (the `claims-dropped` check has no case yet), and band cases (score exactly on 35, 60, 70) once `band()` exists

## Phase 2: canonical input (REQ-032)

- [x] T010 [rules] [REQ-032] `canonical(text)`: NFKC, zero-width and format characters removed, whitespace collapsed, common LaTeX rewritten; `qid` from canonical text; flips rw-whitespace-id, rw-fullwidth-digits, rw-latex-percent, inj-zero-width (modules/review/review.js) (done: `canonical()` and `fold()` exported; flips rw-whitespace-id, rw-fullwidth-digits, rw-latex-percent, inj-zero-width and, through the confusables map on the guard, inj-homoglyph)
- [x] T011 [rules] [REQ-032] Report truncation as a reason and a field; flips trunc-limitations-late (modules/review/review.js) (done: `truncated` = null or [{field, length, kept}], one reason per cut, so a cut item is sent to a person)
- [ ] T012 [rules] [REQ-037] Cap any single marker weight at 10, or raise the band margin, so one flip moves credibility by at most 5; flips band-one-marker (modules/review/review.js, bench/baseline.json)

## Phase 3: score the source (REQ-033)

- [ ] T020 [rules] [REQ-033] `fidelity(source, paraphrase)` with number/unit, entity, hedge, negation and claim-count checks, passing bench/fidelity-cases.json (modules/review/fidelity.js)
- [ ] T021 [rules] [REQ-033] The watcher scores the abstract and stores the paraphrase for display only, withheld when fidelity fails; only a hash and the 400-character excerpt are stored (scripts/watch.js, modules/review/store.js)

## Phase 4: wording and negation (REQ-034, REQ-035)

- [ ] T030 [rules] [REQ-034] Marker wordings: passive voice, "beats", "release our code", number words, percentage points, "CI", "p =", adjectives between a count and its noun; flips the rw-* gaps
- [ ] T031 [rules] [REQ-035] Negation window for markers and hype words; capitalised names exempt from hype; flips neg-* and hype-benchmark-name
- [ ] T032 [rules] [REQ-035] Injection guard on canonical text with confusables mapped, more wordings, and a "describes attacks" exception that is reported, not capped; flips inj-*
- [ ] T033 [rules] [REQ-034] Don't drop a statement with a verb as a keyword list; flips clean-title-like-sentence
- [ ] T034 [rules] [REQ-032] Sentence splitting that keeps "et al.", "Fig.", "e.g.", "i.e.", "approx." inside a sentence, and splits at semicolons for claim backing (so a claim can't borrow the numbers after a semicolon); flips the seg-* gaps
- [ ] T035 [rules] [REQ-035] Hedged claims ("may", "suggests"), negated claims and question titles are not claims; count every claim, not only the first 12, for hype; flips hedge-*, neg-negated-claim, title-question, claims-past-twelve
- [ ] T036 [rules] [REQ-036] Survey detection that doesn't depend on which sentence comes first (the T004 order property)

## Phase 5: kinds and bands (REQ-036, REQ-037)

- [ ] T040 [rules] [REQ-036] Survey and review title forms; position, dataset/benchmark and negative-result kinds; flips survey-* gaps
- [ ] T042 [rules] [REQ-037] Count only toy checks that test a credible paper's idea toward the dossier rating: today a non-credible paper with a held-up check can lift "early" to "some support" (Lean: `noncredible_paper_with_check_raises`)
- [ ] T041 [rules] [REQ-037] `band(S, T, m)` for verdicts and the dossier; Border shown on the Review desk, the digest and the dossier; only High counts as credible (modules/review/review.js, modules/review/dossier.js, scripts/watch.js)

## Phase 6: proofs (REQ-038)

- [ ] T050 [agent] [REQ-038] Move the scoring arithmetic into si-expr rules (lib/rules/review.json) behind the same outputs, with bench showing no change
- [ ] T051 [agent] [REQ-038] Lean evaluator for those rules; prove the T005 theorems with no `sorry`; differential test of Lean against JavaScript on generated cases (proofs/, test/judge-differential.js)

## Phase 7: reviews and comments (REQ-039, REQ-040)

- [ ] T060 [rules] [REQ-039] Public peer reviews (OpenReview, CC BY 4.0): aspect tags, mean, spread, count, licence and link; no reviewer identities; missing reviews treated as unreviewed
- [ ] T061 [rules] [REQ-040] Comment role and stance with cue words; capped length credit; checkable-evidence credit; bridging ranking only with 5+ ratings per comment and 10+ per rater
