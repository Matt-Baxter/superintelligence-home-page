# Research loop: pooled results

2026-11-12T21:36:26.050Z · machines: cloud-shard-9 (linux x64, 2 cores, shard 9/30, d4569d6)

## Experiments

**threshold** (300 seeds): simulated minimum comparator power vs the formula 1 - P(claim)/P(easiest weakening)

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| gap_d0.3 | 0.0215 | 0.0205 to 0.0225 | 0.0085 |
| gap_d0.5 | 0.0305 | 0.0277 to 0.0333 | 0.025 |
| gap_d0.7 | 0.0365 | 0.0355 to 0.0375 | 0.0085 |
| gap_d0.9 | 0.0407 | 0.0402 to 0.0411 | 0.0041 |

**subtle-blind** (300 seeds): weakened share of accepted proofs: exact comparator vs one blind to small weakenings

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| exact | 0 | 0 to 0 | 0 |
| blind | 0.9871 | 0.9868 to 0.9874 | 0.0027 |

**drift-above** (300 seeds): claim retained after 12 generations at power 0.9: outside anchor minus self-reference

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| anchor | 0.9938 | 0.9937 to 0.9939 | 0.0006 |
| self | 0.9446 | 0.9445 to 0.9447 | 0.0011 |
| leak | 0.0492 | 0.0491 to 0.0493 | 0.0012 |

**drift-below** (300 seeds): same at power 0.5 (below threshold)

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| anchor | 0.339 | 0.335 to 0.3431 | 0.0356 |
| self | 0.3232 | 0.3195 to 0.3269 | 0.033 |
| leak | 0.0158 | 0.0104 to 0.0212 | 0.0476 |

**library** (300 seeds): library contamination at a 10% budget: last results first vs foundations first (new random library per seed)

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| unchecked | 0.1354 | 0.1216 to 0.1492 | 0.1215 |
| last_first | 0.1308 | 0.1171 to 0.1446 | 0.1216 |
| foundations_first | 0.0482 | 0.0469 to 0.0496 | 0.0118 |
| gain | 0.0826 | 0.0689 to 0.0962 | 0.1206 |
| relative | 0.3817 | 0.3456 to 0.4179 | 0.3194 |

**introspection-h7** (60 seeds): introspection toy, concept 2, best of 8 causal searches: jointly trained vs post-hoc reporters (Python)

| quantity | mean | 95% interval | sd |
| --- | --- | --- | --- |
| joint_das | 0.9641 | 0.9381 to 0.99 | 0.1025 |
| posthoc_das | 0.8647 | 0.8214 to 0.9079 | 0.171 |
| das_gap | 0.0994 | 0.0654 to 0.1333 | 0.1342 |
| joint_fidelity | 0.9995 | 0.9989 to 1 | 0.0022 |
| posthoc_fidelity | 0.9636 | 0.9197 to 1.0076 | 0.1736 |
| probe_swap | 0.0005 | -0.0005 to 0.0015 | 0.0039 |

## Pre-registered hypotheses, re-tested on pooled seeds

| example | hypothesis | effect (mean, 95% interval) | verdict |
| --- | --- | --- | --- |
| autoformalize-statement-gate | a size-blind comparator raises the weakened share by at least 0.2 | 0.9871 (0.9868 to 0.9874) | supported (whole interval clears the bar) |
| recursive-drift-below-threshold | below threshold, self-reference loses at least 0.3 more of the claim | 0.0158 (0.0104 to 0.0212) | not supported (whole interval below the bar) |
| recursive-drift-above-threshold | above threshold, self-reference loses at least 0.05 more over 12 generations | 0.0492 (0.0491 to 0.0493) | not supported (whole interval below the bar) |
| library-foundations-first | foundations first leaves at least 0.2 less contaminated (absolute) | 0.0826 (0.0689 to 0.0962) | not supported (whole interval below the bar) |
| introspection H7 | joint training makes the reported concept's causal direction at least 0.10 easier to find | 0.0994 (0.0654 to 0.1333) | undecided (interval straddles the bar) |

## Checks per machine

- cloud-shard-9: ok test/verification-unit.js, ok test/analysis-unit.js, ok scripts/bench.js, ok scripts/verification-ratchet.js; Lean: skipped

Bars are the ones registered in modules/lab/examples.json; they are not changed after seeing these results.
