# Bake-off scorecard

Generated from `criteria.json` and `evidence.json` by `node bakeoff/report.js`. Do not edit by hand.

Every check is pass, fail or unknown. An unknown is never guessed: it widens the range a total can still reach.

## Decision: open

Not decidable yet: the ranges overlap (A 0–100, B 0–100).

Still needed:

- A: Acceptance tests
- A: Superintelligence relevance
- A: Security
- A: Maintainability
- A: Human effort
- A: Usability
- B: Acceptance tests
- B: Superintelligence relevance
- B: Security
- B: Maintainability
- B: Human effort
- B: Usability

## Weighted scorecard

| Criterion | Weight | Build A | Build B |
|---|---:|---|---|
| Acceptance tests | 30 | unknown (0–30) | unknown (0–30) |
| Superintelligence relevance | 20 | unknown (0–20) | unknown (0–20) |
| Security | 15 | unknown (0–15) | unknown (0–15) |
| Maintainability | 15 | unknown (0–15) | unknown (0–15) |
| Human effort | 10 | unknown (0–10) | unknown (0–10) |
| Usability | 10 | unknown (0–10) | unknown (0–10) |
| **Total** | **100** | **0–100** | **0–100** |

## Acceptance tests (on the deployed app only)

| AT | Feature | Expected | A | B |
|---|---|---|---|---|
| AT-01 | F1 | Stories from all 8 sample sources appear, newest first. | unknown | unknown |
| AT-02 | F1 | The AI photo-editing app item does not appear. | unknown | unknown |
| AT-03 | F2 | The paper in three sources appears once, listing all three. | unknown | unknown |
| AT-04 | F3 | Shows Forecasting & timelines and the matched words "AGI timelines". | unknown | unknown |
| AT-05 | F4 | The Twitter/X item does not appear. | unknown | unknown |
| AT-06 | F4 | With one source unreachable, the rest of the feed still loads. | unknown | unknown |
| AT-07 | F5 | Sign-up with an unused username creates the account and signs in. | unknown | unknown |
| AT-08 | F5 | Sign-up with a used username fails clearly; no duplicate account. | unknown | unknown |
| AT-09 | F5 | Still signed in after closing the browser and returning next day. | unknown | unknown |
| AT-10 | F6 | A's vote survives sign-out and sign-in and shows as A's. | unknown | unknown |
| AT-11 | F6 | A and B each see only their own saved stories. | unknown | unknown |
| AT-12 | F6 | A's direct request to remove B's vote is refused. | unknown | unknown |
| AT-13 | F7 | Alignment filter shows only Alignment stories; no sideways scroll on a phone. | unknown | unknown |
| AT-14 | F8 | A classmate signs up and sees the feed in under 2 minutes, unaided. | unknown | unknown |

Notes that do not count toward the score (self-tests, probes):

- A AT-05: probe: Live front page links to Twitter/X: 0. Proxy only; AT-05 uses the shared sample data.
- A AT-13: probe: Front page at 390px: sideways overflow 0px. Proxy only; AT-13 needs the Alignment filter.
- A AT-14: probe: Public URL answered 200 in 1.2s.
- B AT-05: probe: Live front page links to Twitter/X: 0. Proxy only; AT-05 uses the shared sample data.
- B AT-13: probe: Front page at 390px: sideways overflow 0px. Proxy only; AT-13 needs the Alignment filter.
- B AT-14: probe: Public URL answered 200 in 0.9s.

## Relevance sample

### Build A

Sampled 13 of 20 · judged by both partners 0 · on-topic unknown · target 90%: unknown

Rule pre-check (a hint, never a score): 69% of sampled titles match an ontology topic.

| # | Story | Rule topics | John | Matt |
|---:|---|---|---|---|
| 1 | Research acceleration: The jagged frontier | none | unknown | unknown |
| 2 | Astra covertly underperforming on safety research is concerning, even though it’s unlikely to be motivated by ambitious goals | Safety & risk | unknown | unknown |
| 3 | Sharing AI progress in mathematics | Math, Reasoning, Capabilities & AGI progress | unknown | unknown |
| 4 | Trump Signs Executive Order For AI Testing Prior To Frontier Model Releases | Capabilities & AGI progress, Governance & policy | unknown | unknown |
| 5 | Don't Worry About the Vase | none | unknown | unknown |
| 6 | The AI Ad-Hoc Prior Restraint Era Begins | none | unknown | unknown |
| 7 | Reasoning models struggle to control their chains of thought, and that’s good | Reasoning, Capabilities & AGI progress | unknown | unknown |
| 8 | Detecting and reducing scheming in AI models | Alignment, Deception & scheming, Safety & risk | unknown | unknown |
| 9 | OpenAI and Anthropic share findings from a joint safety evaluation | Safety & risk, Evals & dangerous capabilities | unknown | unknown |
| 10 | Toward understanding and preventing misalignment generalization | Alignment | unknown | unknown |
| 11 | Deliberative alignment: reasoning enables safer language models | Alignment, Reasoning, Capabilities & AGI progress | unknown | unknown |
| 12 | Alignment Faking in Large Language Models | Alignment, Deception & scheming, Safety & risk | unknown | unknown |
| 13 | Extracting Concepts from GPT-4 | none | unknown | unknown |

### Build B

Sampled 20 of 20 · judged by both partners 0 · on-topic unknown · target 90%: unknown

Rule pre-check (a hint, never a score): 85% of sampled titles match an ontology topic.

| # | Story | Rule topics | John | Matt |
|---:|---|---|---|---|
| 1 | Superintelligence Homepage | AGI & superintelligence, Capabilities & AGI progress | unknown | unknown |
| 2 | Read the feed without an account | none | unknown | unknown |
| 3 | 292P Towards self-improving neural networks: LLM-guided evolution of medical image models | Recursive self improvement | unknown | unknown |
| 4 | Recursive self improvement | Recursive self improvement | unknown | unknown |
| 5 | A hybrid self-improvable meta-learning network for utterance-level Sentiment classification in scripted dialogues | Recursive self improvement | unknown | unknown |
| 6 | VirtualLab_CC: An LLM-augmented virtual laboratory for automated computational chemistry research | AI for science, Capabilities & AGI progress | unknown | unknown |
| 7 | AI scientists & research agents | Agents, Automating AI research, AI scientists & research agents, Capabilities & AGI progress | unknown | unknown |
| 8 | What Would Count as Superintelligence? | AGI & superintelligence, Capabilities & AGI progress | unknown | unknown |
| 9 | Combatting adversarial distillation | Scaling & training, Compute & scaling | unknown | unknown |
| 10 | Capabilities & AGI progress | Capabilities & AGI progress, AGI & superintelligence | unknown | unknown |
| 11 | AI R&D-relevant model capabilities are improving rapidly and are getting harder to measure | Capabilities & AGI progress, Automating AI research | unknown | unknown |
| 12 | SoK: Assessing the Evolution of LLM Capability in Software Vulnerability Research | Capabilities & AGI progress | unknown | unknown |
| 13 | Probing the "Conscious" Mind: Selective Access and Global Workspace in Vision-Language Models | Multimodal, Interpretability, Capabilities & AGI progress | unknown | unknown |
| 14 | Replication of Agentic Security Events: Audit and Investigation (ROGUE-AI) | Agents, Capabilities & AGI progress | unknown | unknown |
| 15 | Evals & dangerous capabilities | Capabilities & AGI progress, Evals & dangerous capabilities, Safety & risk | unknown | unknown |
| 16 | The Geometry of Lies: Knowledge and Persona Directions for Detecting Deception in Large Language Models | none | unknown | unknown |
| 17 | AURA: AUdio-dRiven streaming Avatar | Multimodal, Capabilities & AGI progress | unknown | unknown |
| 18 | FLUID: Flexible, Evidence-Grounded Situated Task Guidance | none | unknown | unknown |
| 19 | A CPU Inside an LLM: Zero-Gradient Compilation of Exact Circuits into Pretrained Weights | Interpretability | unknown | unknown |
| 20 | Mind2Act World: A Diagnostic Benchmark for Embodied Mind, Physical Action, and Mind-Action Composition in Robotic Manipulation | Robotics & embodiment, Evals & dangerous capabilities, Capabilities & AGI progress, Safety & risk | unknown | unknown |

## How to fill in the unknowns

1. Run each AT on the deployed app and add `{ "build", "at", "on": "deployed", "result": "pass" | "fail", "by", "date", "note" }` to `evidence.acceptance`.
2. In `evidence.relevance.<build>.stories`, set each `judges.john` and `judges.matt` to true (on-topic) or false.
3. Set `evidence.manual.<build>.<criterion>.value` to a number from 0 to 1 for security, maintainability, effort and usability, with a note.
4. Run `node bakeoff/report.js` again.
