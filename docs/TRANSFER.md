# Does the judge work outside AI?

A study of how far the research layer's judge (`modules/review/review.js`) transfers beyond AI news, what broke, what was fixed and what is still unproven. Live results: `/research/transfer` (admins, or anyone when `RESEARCH_PUBLIC=1`); it re-runs the judge every time it loads. Locked in by the benchmark ratchet: `npm run bench`, suite `domains` (REQ-027, REQ-029, REQ-053).

## The question

The judge answers two separate questions. **Credibility** asks how far to believe a piece: does it report numbers, compare with a baseline, give an interval, use controls or held-out tests, state its limits, share its data, and does each claim have its own evidence? **Significance** asks how big a step toward superintelligence it reports, using the AI ontology and frontier signals. The first should be field-neutral, because every empirical field asks the same of a claim (it is the skeleton of evidence-appraisal checklists such as CONSORT and GRADE). The second is AI-specific by design. This study tests the first.

## Method

Three sets of synthetic pieces (labelled test data, no real studies or people), each piece labelled credible or not. Every field gets the same six shapes: a careful study, a careful news report, an honest null or negative result, a hype press release, a small study that overclaims, and a calm post that cites nothing. The held-out and overreach sets add harder shapes: hype dressed in numbers, a retraction notice, a legitimate "first", a careful study with no error bars, a careful blog post, a poll with a margin of error, an observational cohort that names its confounding.

| Set | Fields | Pieces | Written | Role |
| --- | --- | --- | --- | --- |
| `bench/domains-set.json` | medicine, climate, materials, economics, finance, psychology, nutrition | 42 | before any fix | used to find and fix problems |
| `bench/domains-holdout.json` | epidemiology, astronomy, education, security, energy | 30 | after the first fixes | run once to measure transfer |
| `bench/domains-overreach.json` | medicine, public health, biology, economics, politics, ecology, astronomy, epidemiology, energy, nutrition, finance, psychology, education, climate | 18 | after the second fixes | run once to catch false alarms |

A verdict is "right" when it is doubtful or withdrawn exactly when the piece is labelled not credible. Credibility AUC: the share of (credible, not credible) pairs where the credible piece scores higher.

## Results

| Run | Verdicts right | Credibility AUC |
| --- | --- | --- |
| Training set, before any change | 27 of 42 (64%) | 0.97 |
| Held-out set, first run after the first fixes | **27 of 30 (90%)** | 0.97 |
| Overreach set, first run after the second fixes | **18 of 18** | 1.00 |
| All three sets now | 90 of 90 | 1.00 |
| AI benchmark (`bench/review-set.json`, 23 metrics) | unchanged throughout: 0 regressions, adversary gain still 0 | |

The honest transfer numbers are the two first runs in bold. "90 of 90 now" includes sets the fixes were made against.

**Ranking transferred from the start; verdicts didn't.** Before any change, credible pieces already out-ranked the rest in every field (AUC 0.97), but 15 of 42 verdicts were wrong, and 14 of those let weak work through.

## What broke, and the fix (all field-neutral)

| Problem | Example | Fix |
| --- | --- | --- |
| Press releases and blog posts were judged as comments, skipping the check for unbacked assertions. This affected AI news too. | an uncited "the recession is already here" post called "minor" | `press`, `blog`, `newsletter`, `post`, `news` are judged as articles |
| Evidence vocabulary was ML-only | "95% CI", "placebo", "randomized", "preregistered", "replication code", "patients", "households" didn't count | markers widened in field-neutral terms; held-out became "guards against fooling itself (held-out tests, controls, randomization, replication)" |
| Overclaim verbs weren't claims | "this proves extract H cures migraine", "doubles productivity", "guaranteed to 100x" | `proves`, `cures`, `doubles`, `guaranteed`, `reverses`, `is solved`, `ends … forever`, `this shows`, `should be … in every` count as claims |
| A hyphen let "lower-achieving" read as "achieving" | an honest null result called doubtful | no claim match inside hyphenated words |
| Describing the method "backed" a claim next to it | "we gave it to 9 patients; this proves it cures" | a neighbour only partly backs a claim when it compares, bounds or controls something, not when it describes what was done or quotes a bare number |
| A questionnaire was read as a literature survey (surveys skip claim checks) | "using a survey of residents … this proves pollution causes dementia" | "a survey of" must be followed by literature words |
| Article numbers earned points with no source | "scores rose 47%, 98% of parents satisfied" | "gives the study's numbers" only counts when a study is cited |

## Still unproven, and what it would take

1. **Agreement with people.** One person wrote both the rules and the test pieces, so this shows that the vocabulary transfers, not that the judge agrees with experts. The test that would settle it: two people label real pieces without seeing the verdict; measure how often they agree with each other (Cohen's kappa), then how often the judge agrees with them.
2. **Thin margin on stat-washing.** Credible pieces bottom out at 48 and non-credible ones top out at 33, against a cut-off of 35. The two pieces nearest the line are both "numbers without a comparison" or anecdote. Deterministic number checks (GRIM-style impossible means, p-values inconsistent with their test statistic) would widen it.
3. **Study design is only partly modelled.** The judge rewards controls and randomization but doesn't rank designs (randomized trial over cohort over case series), check conflicts of interest, or read effect sizes against field norms.
4. **Significance and tags are AI-only.** Another field needs its own ontology and frontier signals: a domain pack.

## Where else this applies

What carries over unchanged: evidence checks, claim and hype detection, the guards against gaming, the masked two-model panel, outlet grades and forecast track records, the RSS feed and the action catalog. What a new field brings: an ontology (topics, organisations, benchmarks or endpoints), its sources, and its significance signals.

| Use | Who | Fit, from the evidence above |
| --- | --- | --- |
| Health news triage | health reporters, patient groups, clinicians reading press coverage | medicine, nutrition, epidemiology and public-health sets: all right; catches miracle-cure press and small-study overclaims |
| Science newsroom desk check | editors before publishing a science story | the reporting rubric scores the story itself: cites the study, gives its numbers, says what wasn't shown |
| Investor-protection screen | retail-investor education, compliance teams | finance set: "guaranteed 100x", one-stock back-tests and fund stat-washing caught; a backtest checklist (deflated Sharpe, out-of-sample) would deepen it |
| Policy research digest | analysts tracking economics or education evidence | difference-in-differences, lottery studies and nulls credited; four-firm surveys and before-and-after claims caught |
| Climate and energy claims | climate desks, energy analysts | float-network studies credited; "device ends climate change" and backyard-sensor claims caught |
| Security advisory triage | security teams reading vendor claims | measurement studies credited; "unhackable chip" and one-laptop findings caught |
| Teaching evidence appraisal | courses like SEIS 606, journalism and research-methods classes | every verdict comes with its reasons, so students can see why a piece fails |
| Literature screening | anyone running a systematic review | first-pass flag for missing controls, intervals and limits before a person reads it |

Each would be a profile of the same codebase (`SITE_PROFILE`), like `spec`, `extended` and `research` today: same kernel, a different ontology and source catalog.
