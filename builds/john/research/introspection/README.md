# Introspection toy

Does a network's self-report track the internal state it actually uses? A self-report is a claim about the network;
an interchange intervention on the causal variable is the statement check (the same ladder as the Machine-checked
signal, applied to introspection and interpretability claims). NumPy only; runs on any Mac or laptop.

- `HYPOTHESES.md`: every hypothesis and amendment, registered before the run that tests it.
- `introspect.py`: trains the networks and measures report accuracy, causal-direction (DAS) swap success,
  introspection fidelity, probe accuracy versus probe causal effect, and a random-direction baseline.
- `analyze.py`: pools runs, paired bootstrap intervals, verdicts against the registered bars.
- Results: `out/introspection` (1 search, kept for the record), `out/introspection_r8` (best of 8, the protocol),
  `out/introspection_h7` (new concept). `out/` is git-ignored; re-run to reproduce:

```bash
python3 research/introspection/introspect.py --seeds 20 --restarts 8 --out out/introspection_r8/joint.json
python3 research/introspection/introspect.py --seeds 20 --restarts 8 --posthoc --out out/introspection_r8/posthoc.json
python3 research/introspection/analyze.py out/introspection_r8
node scripts/research-loop.js --shard 0/3 --introspection 60      # one machine's share, pooled with --merge
```

Findings and limits: `docs/RESEARCH_FORMAL_VERIFICATION.md`, section "Introspection and interpretability".
