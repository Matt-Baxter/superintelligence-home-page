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
payoffs). Over 60 seeds the bias is systematic and grows with difficulty: the formula is low by 0.021 at difficulty
0.3 and 0.041 at 0.9, every interval excluding zero, so read p* as a floor. When the claim compiles 8% of the time, p* is 0.91. **Below p*, a comparator does almost nothing**: at power
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
  supported as registered.* Over 60 seeds the leak is 0.0491 (95% interval 0.0488 to 0.0495): certainly real, certainly
  under the bar. The mechanism is there; we over-predicted its size.
- So "checking moves into outside hands" has a precise toy meaning: a fixed external reference stops slow drift that
  no single check would flag.

**5. Algebraic geometry: a library needs a different check than a theorem.** For one theorem, the final-statement
comparator is enough: everything under it is proved from the axioms. In a library (the Stacks Project), every
declaration is something people cite, and a mistranslated definition contaminates everything built on it. In
`library-fidelity` (400 declarations, 25% definitions, 5% mistranslated), 14.4% of the library rests on a wrong
statement. With a 10% review budget:
- checking the last results first (a single-theorem habit) leaves 14.0%;
- checking at random leaves 13.7%;
- checking foundations first (definitions with the most dependents) leaves 4.8%,
- while last-results-first and foundations-first catch about the same share of the errors (about 10%). **Where you check
  matters more than how many errors you catch.** Linking every declaration to its source text (as Stacks tags do) is what makes foundations-first review
  possible. *Our hypothesis was a 0.2 absolute drop; the library only starts at 0.144, so: not supported as registered.*
- **Correction from 60 seeds (research loop, Nov 9):** that library (seed 29) was a favourable draw. Across 60 random
  libraries, foundations first removes 35% of the contamination on average (95% interval 26% to 43%), not two thirds.
  Its result is very stable (4.95% contaminated, sd 0.012), while checking the last results first swings with how
  contaminated the foundations happen to be (sd 0.116).

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
- **Pre-registration record (afternoon): 1 supported, 3 not supported.** Evening: H3 supported (and replicated);
  H1, H2 (twice), H4, H5, H6 and the infrastructure-hub bar not supported; H7 undecided. All three misses were about effect size (one direction
  was also wrong: no compounding below the threshold). Our priors overestimate effect sizes; future bars should be
  relative, not absolute.
- **Held-out leak.** The ratchet's candidate edits were written after seeing three held-out misses, so the first 20
  held-out items are no longer blind. The 6 interpretability items are. A fresh held-out set from someone who hasn't
  read `rules.json` (Matt) is the next step, and fits the two-reviewer rule for judgements.
- **Synthetic sentences.** The signal hasn't been measured on real feed stories yet; the first deploy's stories should
  be labelled and added.

## Introspection and interpretability: a trained toy (Nov 9, evening)

Built and trained in NumPy (`research/introspection/`; every hypothesis registered in `HYPOTHESES.md` before the run
that tested it). A two-layer network computes a concept c and uses it for its task; a report head says whether c is
active. A self-report is a claim; an interchange intervention along the causal direction for c (found by distributed
alignment search, DAS) is the statement check. 20 networks per configuration, paired bootstrap intervals.

**1. A probe can decode a concept perfectly and be causally inert.** In every configuration a linear probe reads c
with ~100% accuracy, yet swapping along its direction changes the network's behaviour in 0.1% of cases (interval
0.0% to 0.2%), the same as a random direction (0.7%). The probe's direction is mostly orthogonal to the causal one
(|cos| 0.27). It replicated on a second concept (0.0%). *H3: supported.* A probe's label is a claim, not a check.

**2. Self-reports were faithful; the apparent failures were our tool's.** The first 20-seed run showed bimodal
introspection fidelity: 5 of 20 networks' reports seemed to ignore the causal state. Every one of those seeds also had
a weak causal direction (swap success 0.19 to 0.40). Re-running the search 8 times and keeping the best (chosen on
training pairs only) brought 8 of 9 failing seeds to fidelity ~1.0. With the corrected protocol, all 20 jointly
trained networks report the causal state at 100%. *H1, H4, H5 and H6 (shortcuts and post-hoc reporters break
introspection): not supported.* The lesson is about the analyst: "the model's self-report is unfaithful" can be an
artifact of a weak causal analysis, so interpretability claims need the same ladder.

**3. Training against a wrong check teaches the wrong thing.** Fine-tuning the report on swapped states (H2, an
outside check during training) raised measured "fidelity" in the failing seeds (seed 6: 0.00 to 0.70), but those swaps
were along the wrong direction: the report learned to follow the analyst's mistake. With a correct direction there was
nothing to fix (*H2: not supported*). This is the recursive-drift lesson in a trained network: an outside reference
only helps if it is right.

**4. Joint training may concentrate the reported concept (H7, undecided).** Jointly trained reporters' networks kept c
in a more findable single direction than post-hoc ones (+0.17 on the first concept, unregistered). Registered as H7 and
tested on a new concept: +0.148 (interval 0.085 to 0.224), bar 0.10, so undecided. The Mac loop's `--introspection`
option trains more seeds to settle it.

Limits: 12-bit inputs, 32-unit layers, one concept at a time, 1-D causal search. Real models represent concepts in
superposition and across layers; this toy shows the checks are necessary, not that real self-reports are faithful.

## Library review with infrastructure hubs (Nov 9, evening)

The deep research found that centrality in Mathlib mostly measures infrastructure (tactics, notation, instances), not
mathematics (arXiv 2604.24797). In `library-fidelity` with 20% infrastructure hubs (60 libraries, 10% budget), left
contaminated: unchecked 10.2%, final results first 9.9%, raw most-dependents first 5.1%, mathematical foundations first
3.7%. Filtering to mathematical definitions helps (raw leaves 38% more), but by 0.014 (interval 0.010 to 0.018)
against a registered bar of 0.03: *not supported as registered.* Practical rule: check foundations; filter out
infrastructure when you can.

## Calibration against real systems (from the deep research)

- An agent with Lean feedback compiled 87.2% of 227 graduate-level formalizations, but only 57.7% were faithful; nearly
  half its compile gain from Lean feedback failed the semantic check (arXiv 2606.31002). That is the autoformalize-gate
  mechanism in a real system.
- 31.8% of ProofNet's Lean 4 statements had formalization errors (arXiv 2406.07222); an autoformalizer scored 97.5% by
  its own judge and 62.7% by Lean experts (arXiv 2511.03108).
- Reward hacking of provers is documented: a Lean `apply?` bug, editable context, `theorem` rewritten as `axiom`.
- Model collapse and in-context reward hacking corroborate the drift result qualitatively; no source reports a
  per-generation leak in comparable units, so ours stays a toy result.

## Re-running on our machines

`node scripts/research-loop.js` runs one cycle (unit checks, bench, ratchet dry run, the Lean toys if Lean is
installed, and every experiment above over many seeds; `--introspection N` also trains the introspection toy). Machines split seeds with `--shard i/n`, write to a shared
folder (`LOOP_DIR`), and `--merge` pools them into intervals and re-tests each pre-registered hypothesis against its
original bar. `--every 60` repeats hourly; `scripts/launchd/` has a macOS launch agent for the Mac mini. Results stay
in `LOOP_DIR`; nothing is committed or pushed.

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
