# Practices: what we follow, what's next, and where it came from

One page of the practices this build follows, collected from the research layer's own lessons and from published work (research run on 2026-11-07). Each row says whether it is **in place** (with where), or **next** (not done yet). Sources are at the end. For the project rules themselves, see [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md); for the state of the build, [HANDOFF.md](HANDOFF.md).

## Agent instructions and skills

| Practice | Status |
| --- | --- |
| Keep the always-loaded rules file short: commands, folder map, hard rules, pointers. Long context files cost more and can lower task success. | In place: CLAUDE.md is rules plus a generated skill index; AGENTS.md points to it. Keep it that way. |
| Put must-follow rules in the always-loaded file; use skills for occasional, deep workflows (skills were not invoked in about half of default cases in one published eval). | In place: hard rules in CLAUDE.md; 17 skills in `agent-kit/skills/`. |
| Write each skill description as "what it does + when to use it", third person, with the trigger words first. | In place for all 17 (checked by `npm run kit:check`). |
| Keep references one level deep and load them only when the skill says so. | In place (`references/` folders). |
| Test whether skills trigger: about 20 should/should-not prompts per skill, run 3 times, in each tool you use. | Next. |
| v0 has no documented support for SKILL.md: paste the hard rules into v0's project instructions. | Next (John, when starting `bakeoff/v0-john`). |
| Put deterministic steps in scripts the skill runs, not prose. | In place: `scripts/` (watch, checkin, quality, bench, dossier, project-sync). |

## Specs and traceability

| Practice | Status |
| --- | --- |
| Constitution first; requirements numbered; tests named by requirement. | In place: `.specify/memory/constitution.md`, REQ-001 to REQ-035, `docs/SPEC_TRACE.md` checked by preflight. |
| Change behaviour by editing the spec first; a person reviews every spec diff. | In place: new work goes into spec 002 as Proposed; both partners approve. |
| Build ahead, prove, then propose. | In place: features ship on a John branch with tests (e.g. `feature/rigor-badge`), then a Proposed REQ. |
| Run clarify before plan and analyze before implement; converge before merge. | Next: use `/speckit-clarify`, `/speckit-analyze`, `/speckit-converge` on spec 002 with Matt. |

## Judging with rules and models

| Practice | Status |
| --- | --- |
| Separate how big a claim is from how far to believe it. | In place: significance vs credibility; buzz vs evidence. |
| Publish the rubric and the per-criterion result for every item. | In place: `/research/criteria`, scorecard on every write-up; `CRITERIA` is the table the judge uses. |
| Mask author, affiliation and outlet before a model judges. | In place: `modules/review/panel.js` (masking also hides people and organisation names and links). |
| Counterfactual tests for prestige and wording; vary rubric order. | In place for each model run (prestige labels, neutralised hype, rubric order). |
| Models from different makers; never one model alone. | In place: at least two models required, or the panel is "incomplete" and the rules judge stands. |
| Verify every quoted piece of evidence against the text. | In place: unmatched quotes are thrown out and credibility recomputed. |
| When models disagree, send it to a person rather than averaging. | In place: disagreement takes the most conservative score and flags it for a person. |
| Efficient models do the bulk; a bigger model guides. Escalate only the hard cases to it, and let it advise, never score. | In place: `ADVISOR_MODEL` is asked only on disagreement (or a large gap to the rules judge); its quotes are verified; `npm run advise` turns its review into proposals a person adopts. |
| Calibrate against people: 50 to 100 items labelled by both partners, Cohen's kappa (not percent agreement). | Next: label in the control room (`/m/control`), then add kappa to the quality report. |
| Repeat bias trials several times (judges vary run to run). | Next: run each panel model's counterfactual pair more than once. |
| Pin model ids and recalibrate after any model change; cache verdicts by content, prompt and model. | Next (when `PANEL_MODELS` is set). |
| Check real reviews without labels: spread, agreement between parts. | In place: `npm run quality`, shown in the control room. |
| Turn every weakness found on real data into a synthetic benchmark item before changing rules. | In place: `bench/review-set.json` (e.g. `b-hype-press-words`, `b-careful-report`). |

## Sources and hype

| Practice | Status |
| --- | --- |
| Grade the outlet, the article and the paper separately. | Partly: outlet kind and article grade in place (`modules/review/sources.js`); paper checks use the rigor rubric. |
| Judge articles on how they report (cites the study, its numbers, what was not shown). | In place: the reporting rubric. |
| Treat preprints as unreviewed, not false; weight independent replication over venue. | In place: preprint B, peer review A, citing research lifts to B at most. |
| Personal blogs graded as a class, never by writer. | In place. |

## Forecasts

| Practice | Status |
| --- | --- |
| Record each dated forecast as an event with a due date. | In place: `review_events`, `/m/control`, `/m/dossier`. |
| Separate ambiguous from annulled; neither is scored. | In place: outcomes happened, did not, unclear, annulled. |
| Show a hit rate only above a minimum of resolved forecasts. | In place: 3. |
| Attribute only a person's own words to them. | In place by not attributing at all: names a forecast is pinned on are removed. |
| Write resolution criteria at capture time; Brier scores only for stated probabilities. | Next. |
| Publish scoring and near-miss rules before scoring anyone; offer a corrections channel. | Partly: rules on `/research/criteria`; corrections channel next. |

## Free models

| Practice | Status |
| --- | --- |
| Free tiers are tight and change often (OpenRouter free about 50 requests a day; Groq free chat models about 1,000 a day): budget tokens, cache, never fall back to a paid model silently. | In place: no paid calls by default; models only in background runs. |
| Ask for JSON output and validate it; on failure mark "judge error" rather than guess. | In place: unparseable replies drop checks; a failing model is reported. |

## Sources

- Anthropic, Agent Skills best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Agent Skills, optimising descriptions: https://agentskills.io/skill-creation/optimizing-descriptions
- OpenAI Codex skills: https://developers.openai.com/codex/skills
- Vercel, AGENTS.md vs skills evals: https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- Gloaguen et al., repository context files (arXiv 2602.11988): https://arxiv.org/abs/2602.11988
- GitHub Spec Kit: https://github.github.com/spec-kit/
- Zheng et al., MT-Bench and LLM-as-judge biases (arXiv 2306.05685): https://arxiv.org/abs/2306.05685
- Verga et al., panels of LLM evaluators (arXiv 2404.18796): https://arxiv.org/abs/2404.18796
- Judging the Judges (arXiv 2406.12624): https://arxiv.org/abs/2406.12624
- Affiliation bias in LLM reviewing (arXiv 2509.13400): https://arxiv.org/abs/2509.13400
- REFORMS checklist for ML-based science: https://reforms.cs.princeton.edu/
- HealthNewsReview criteria: https://healthjournalism.org/blog/2024/07/writing-about-health-care-interventions-the-healthnewsreview-criteria-are-as-relevant-as-ever/
- Metaculus scoring and resolution FAQ: https://www.metaculus.com/help/scores-faq/
- Dan Luu on scoring futurist predictions: https://danluu.com/futurist-predictions/
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
