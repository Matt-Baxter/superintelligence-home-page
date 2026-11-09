# Formal verification: what "machine-checked" does and doesn't establish

Analysis, Nov 9, 2026. Built on the verification module, its labelled benchmark and four Lab toys. Every number below
is from a run in this repo (`npm run lab:results`, `npm run bench`, `npm run verification:ratchet`); toys test the logic
of an idea at small scale, not any paper's results.

## The question

Three stories this autumn: Anthropic reported a Lean proof of Fermat's Last Theorem whose final statement a comparator
matched to Mathlib's; researchers at Cambridge and King's College London reported that OpenAI's Lean formalization of
its Navier-Stokes proof states weaker results than its prose; Axiom released a Lean formalization of the Stacks Project
with each declaration linked to its source tag. The common thread: **a proof checker proves the formal statement, not
the claim.** Who checks that the statement is the claim, and how well, decides what a "verified" result is worth.

## Findings

**1. Rewarding "it compiles" teaches weaker theorems, and the dashboard improves while the work gets worse.**
In the `autoformalize-gate` toy (difficulty 0.6), an autoformalizer rewarded only for compiling ends with 97.5% of
attempts compiling and 99.9% of accepted proofs proving something weaker than the claim. An exact comparator gives 0%
weakened, at 36% compiling. *Lab: supported* (`autoformalize-statement-gate`).

**2. The comparator has a threshold, and it rises with difficulty.** Proving the claim pays only when the comparator
rejects weakenings with probability at least

  p* = 1 − P(claim compiles) / P(easiest weakening compiles).

Checked against simulation at 8 difficulties; agreement within one grid step (largest gap 0.054, grid 0.05; the
simulation needs slightly more power every time, since near the threshold training can't separate two nearly equal
payoffs). When the claim compiles 8% of the time, p* is 0.91. **Below p*, a comparator does almost nothing**: at power
0.5 (threshold 0.64), 98% of accepted proofs are still weakened. For hard results this argues for exact statement
checks (the library's own statement, a second kernel) over a statistical judge.

**3. A check that only notices large weakenings is worse than it looks.** If detection scales with the size of the
weakening, small ones always slip through: 98.7% of accepted proofs are weakened, by a small amount on average (0.21).
No amount of power fixes this, because the smallest weakening is never caught often enough. This is the shape of the
Navier-Stokes report: the formal statements were close to the claims, not obviously different. *Lab: supported.*

**4. Recursive self-improvement: anchoring matters in the regime where every check looks fine.** In `recursive-drift`,
each generation proves what it takes to be the claim and hands its result on.
- Below the threshold, anchoring doesn't help: with an outside anchor or self-reference, the first generation falls to
  about a third of the claim and stays there (no compounding: once a statement is easy there is no pressure to weaken
  it further). *Our hypothesis that self-reference compounds the loss: not supported.*
- Above the threshold (power 0.9), checking each generation against the original claim holds at 99.4% for 12
  generations. Checking against the previous generation's output leaks about 0.4% a generation (to 94.5%): each check
  looks excellent, and the losses still add up. *Our pre-registered bar was a 0.05 drop; the drop was 0.049, so: not
  supported as registered.* The mechanism is there; we over-predicted its size.
- So "checking moves into outside hands" has a precise toy meaning: a fixed external reference stops slow drift that
  no single check would flag.

**5. Algebraic geometry: a library needs a different check than a theorem.** For one theorem, the final-statement
comparator is enough: everything under it is proved from the axioms. In a library (the Stacks Project), every
declaration is something people cite, and a mistranslated definition contaminates everything built on it. In
`library-fidelity` (400 declarations, 25% definitions, 5% mistranslated), 14.4% of the library rests on a wrong
statement. With a 10% review budget:
- checking the last results first (a single-theorem habit) leaves 14.0%;
- checking at random leaves 13.7%;
- checking foundations first (definitions with the most dependents) leaves 4.8%, two thirds removed,
- while last-results-first and foundations-first catch about the same share of the errors (about 10%). **Where you check matters more than how many errors
  you catch.** Linking every declaration to its source text (as Stacks tags do) is what makes foundations-first review
  possible. *Our hypothesis was a 0.2 absolute drop; the library only starts at 0.144, so: not supported as registered.*

**6. Mechanistic interpretability: the same ladder, a different object.** The rungs map onto interpretability claims:

| Formal proofs | Interpretability |
| --- | --- |
| A formal proof is claimed | A feature or circuit is labelled ("a deception feature") |
| Statement checked against a reference | Causal check: ablation, patching or steering moves the behaviour the label predicts, with little collateral change (the Lab's `steering` toy measures exactly target gain versus collateral) |
| Checked outside the authors | Replicated by another group on another model or SAE |
| Fidelity gap | The label explains less than claimed (the feature tracks a surface correlate) |

Two things follow. First, the Machine-checked signal must not credit interpretability claims: 6 new held-out
sentences ("an independent team verified its deception feature", "checked by ablation", "a weaker statement than the
headline") were written before testing and all score correctly, including a Lean proof *about* an SAE, which does
count. Second, an interpretability-evidence ladder is the natural next signal; the toys already have ground truth to
benchmark it.

**7. The research loop and its gate.** `npm run verification:ratchet` tunes the signal's rules on the train split and
accepts only if held-out doesn't drop. It chose a general pattern ("Lean statement / theorem / development") over a
narrow one because harmless rewordings rewarded generality, and it rejected bare "lean" and "verified". A unit test
shows the gate refusing an edit that helps train and breaks held-out. Held-out rung accuracy went from 0.85 to 1.

## How much to trust this

- **Toys.** The compile curve, five strength levels and REINFORCE learner are hand-set. The threshold formula is exact
  for this toy and a hypothesis for real systems.
- **Pre-registration record: 1 supported, 3 not supported.** All three misses were about effect size (one direction
  was also wrong: no compounding below the threshold). Our priors overestimate effect sizes; future bars should be
  relative, not absolute.
- **Held-out leak.** The ratchet's candidate edits were written after seeing three held-out misses, so the first 20
  held-out items are no longer blind. The 6 interpretability items are. A fresh held-out set from someone who hasn't
  read `rules.json` (Matt) is the next step, and fits the two-reviewer rule for judgements.
- **Synthetic sentences.** The signal hasn't been measured on real feed stories yet; the first deploy's stories should
  be labelled and added.

## Next

1. Matt writes 20 blind held-out sentences; re-run the bench.
2. An interpretability-evidence signal (label → causal check → replication), benchmarked on the interp toys' ground truth.
3. A dossier view of formal verification that lists, per story, its rung and any fidelity gap.
4. A Lean statement of the threshold inequality (needs Mathlib reals; for the Lean job queue).

## Where things are

`modules/verification/` (signal, rules, scorer, tag adapter) · `bench/verification-set.json` ·
`scripts/verification-ratchet.js` · `modules/lab/papers.js` (`autoformalize-gate`, `recursive-drift`,
`library-fidelity`, `comparatorThreshold`) · `modules/lab/examples.json` (four examples) · bench metrics `verification.*`
and `papers.comparator_*`, `papers.self_reference_leak`, `papers.foundations_first_gain`.
