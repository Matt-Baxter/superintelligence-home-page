# Introspection toy: pre-registered hypotheses

Registered 2026-11-09 before any training run. Bars are not changed after seeing results.

Setup: a two-layer ReLU network over 12 input bits computes a hidden concept c = (x0 AND x1) OR x2 and is trained on
the task output c XOR x3. A report head on the second hidden layer is trained, jointly, to say whether c is active.
"Introspection fidelity": edit the hidden layer along the direction the task head reads, by exactly the amount that
makes the network act as if c flipped (input unchanged); fidelity is the share of cases where the report flips too.
A linear probe for c, fitted afterwards, gives a "c direction" label; steering along it by the same edit size tests
whether the label is causal for the task.

- H1 (compile vs faithful): natural report accuracy >= 0.95, and introspection fidelity at least 0.20 lower.
- H2 (an outside check during training): training 25% of report examples on edited states, labelled with the state
  the network now acts on, raises introspection fidelity by >= 0.20, with natural accuracy staying >= 0.95.
- H3 (a probe label is not a causal check): steering along the probe direction flips the task output in under 0.80 of
  cases at the edit size that flips it along the task's own direction.

Tested over 20 seeds; a hypothesis is supported only if the 95% interval of the effect clears its bar.

## Amendment 1 (2026-11-09, after a 2-seed smoke test, before any valid result)

The smoke test's edit was wrong: mirroring the task logit flips "c XOR x3", not c, so whether the network "acts as if
c flipped" was ambiguous (both seeds read 0.000, which exposed it). The intervention is now an interchange intervention
along a direction learned by distributed alignment search (DAS): at hidden layer 1, swap the component along v between
a base input and a source input with a different c; v is fitted (network frozen) so the task output becomes
c(source) XOR x3(base). "Introspection fidelity" is then the share of held-out pairs where the swap took (task output
as intended) and the report, reading layer 2, says c(source). The probe for c is fitted at layer 1 too, and H3 uses the
same swap along the probe direction (its "interchange accuracy"). In H2 the report head alone is fine-tuned (trunk
frozen) with 25% swapped examples labelled c(source); fidelity is measured on held-out pairs. The three bars are
unchanged.

## H4 (registered 2026-11-09, after 3 valid seeds showed the report following the swap 100%, before running this)

- H4 (a shortcut to the input breaks introspection): if the report head can also read the raw input (a linear skip
  connection from the 12 input bits), natural report accuracy stays >= 0.95 but introspection fidelity falls by at
  least 0.20 compared with the report that reads only hidden layer 2. The swap edits only the internal state; the input
  the shortcut reads is unchanged.
A random unit direction at layer 1 is added as a baseline for the swap ("took" rate of an arbitrary direction).

## H5 (registered 2026-11-09, after a 2-seed smoke test of H4 showed fidelity 1.000 with the linear skip, before running this)

The linear skip cannot compute c from raw bits (c needs an AND), so the report kept reading the hidden state.
- H5 (a capable shortcut breaks introspection): if the report's shortcut also gets the feature x0*x1, so that c is a
  linear threshold of what the shortcut reads, introspection fidelity falls by at least 0.20 compared with the report
  that reads only hidden layer 2, while natural accuracy stays >= 0.95.

## H6 (registered 2026-11-09, after a diagnostic showed the jointly trained report reads the hidden path ~100x more than a capable shortcut; before running this)

- H6 (a reporter added after training takes the shortcut): train the network and task first, then train the report
  head alone with the network frozen ("post-hoc reporter"), with the capable shortcut (bits plus x0*x1). Introspection
  fidelity is at least 0.20 lower than a post-hoc reporter without the shortcut, with natural accuracy >= 0.95.
- H2 is re-tested in this setting: fine-tuning the post-hoc reporter with 25% swapped examples raises fidelity by >= 0.20.

## Amendment 2 (2026-11-09, after the first 20-seed run): measurement fix

Fidelity was bimodal and every low-fidelity seed also had a weak causal direction (single DAS search, swap success
0.19 to 0.40). Re-running those 9 seeds with the best of 8 searches (chosen on training pairs only) brought 8 of them to
fidelity ~1.0: the failures were the search's, not the reports'. The protocol is now best of 8 searches. Both runs are
kept (out/introspection = 1 search, out/introspection_r8 = best of 8). Bars unchanged. Lesson recorded: with a wrong
causal direction, swapped-example tuning (H2) taught the report to follow the analyst's mistake.

## H7 (registered 2026-11-09 from an unregistered observation; to be tested on a NEW concept, not the data that suggested it)

- H7: training the self-report jointly with the network concentrates the reported concept into a single causal
  direction: with a different concept (c2 = (x4 OR x5) AND NOT x6, task c2 XOR x7), best-of-8 DAS swap success is at
  least 0.10 higher for jointly trained reporters than for post-hoc ones, over 20 seeds.
