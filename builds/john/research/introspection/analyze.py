#!/usr/bin/env python3
"""Pool introspection runs and judge each pre-registered hypothesis (HYPOTHESES.md) against its bar.

Paired by seed; 95% intervals by bootstrap (5,000 resamples, fixed seed) because post-hoc fidelity is bimodal.
A hypothesis is supported only if the whole interval of its effect clears the bar; not supported if the whole interval
misses it; otherwise undecided.
  python3 research/introspection/analyze.py out/introspection        (reads joint.json, posthoc.json, ...; writes report.md)
"""
import json, os, sys
import numpy as np

def load(d, name):
    p = os.path.join(d, name + ".json")
    if not os.path.exists(p): return None
    rows = json.load(open(p))["rows"]
    return {r["seed"]: r for r in rows}

def boot(x, rng, n=5000):
    x = np.asarray([v for v in x if v == v], float)
    if not len(x): return float("nan"), float("nan"), float("nan"), 0
    m = rng.choice(x, (n, len(x))).mean(1)
    return float(x.mean()), float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5)), len(x)

def verdict(lo, hi, bar, below=False):
    if lo != lo: return "no data"
    if below: return "supported" if hi < bar else "not supported" if lo >= bar else "undecided"
    return "supported" if lo >= bar else "not supported" if hi < bar else "undecided"

def main(d):
    rng = np.random.default_rng(606)
    R = {k: load(d, k) for k in ["joint", "joint_linear", "joint_and", "posthoc", "posthoc_and"]}
    L = ["# Introspection toy: results", "", "20 seeds per configuration unless noted; mean and 95% bootstrap interval.", ""]
    keys = [("natural_report_acc", "report accuracy, natural inputs"), ("das_iia", "swap along the causal (DAS) direction took"),
            ("introspection_fidelity", "report follows the swapped state (introspection fidelity)"), ("probe_acc", "linear probe decodes c"),
            ("probe_iia", "swap along the probe direction took"), ("random_iia", "swap along a random direction took"), ("cos_das_probe", "|cos| causal vs probe direction")]
    for name, rows in R.items():
        if not rows: continue
        L += [f"## {name} ({len(rows)} seeds)", "", "| quantity | mean | 95% interval |", "| --- | --- | --- |"]
        for k, label in keys:
            m, lo, hi, n = boot([r["natural_only"][k] for r in rows.values()], rng); L.append(f"| {label} | {m:.3f} | {lo:.3f} to {hi:.3f} |")
        for k, label in [("natural_report_acc", "after swapped-example tuning: report accuracy"), ("introspection_fidelity", "after swapped-example tuning: fidelity")]:
            m, lo, hi, n = boot([r["counterfactual"][k] for r in rows.values()], rng); L.append(f"| {label} | {m:.3f} | {lo:.3f} to {hi:.3f} |")
        L.append("")
    def paired(a, b, f):
        return [f(a[s]) - f(b[s]) for s in a if s in b]
    fid = lambda r: r["natural_only"]["introspection_fidelity"]
    H = []
    j, p = R["joint"], R["posthoc"]
    if j:
        nat = [r["natural_only"]["natural_report_acc"] for r in j.values()]
        m, lo, hi, _ = boot([r["natural_only"]["natural_report_acc"] - fid(r) for r in j.values()], rng)
        H.append(("H1", "natural accuracy >= 0.95 and fidelity at least 0.20 lower", m, lo, hi, verdict(lo, hi, 0.20) if min(nat) >= 0.95 else "not supported (natural accuracy below 0.95)"))
        m, lo, hi, _ = boot([r["counterfactual"]["introspection_fidelity"] - fid(r) for r in j.values()], rng)
        H.append(("H2 (joint)", "swapped-example tuning raises fidelity by >= 0.20", m, lo, hi, verdict(lo, hi, 0.20)))
        m, lo, hi, _ = boot([r["natural_only"]["probe_iia"] for r in j.values()], rng)
        H.append(("H3", "a swap along the probe direction takes in under 0.80 of cases", m, lo, hi, verdict(lo, hi, 0.80, below=True)))
    for hid, a, b, text in [("H4", "joint", "joint_linear", "a linear input shortcut lowers fidelity by >= 0.20"), ("H5", "joint", "joint_and", "a capable shortcut lowers fidelity by >= 0.20"), ("H6", "posthoc", "posthoc_and", "a post-hoc reporter with a capable shortcut has fidelity >= 0.20 lower")]:
        if R[a] and R[b]:
            m, lo, hi, _ = boot(paired(R[a], R[b], fid), rng); H.append((hid, text, m, lo, hi, verdict(lo, hi, 0.20)))
    if p:
        m, lo, hi, _ = boot([r["counterfactual"]["introspection_fidelity"] - fid(r) for r in p.values()], rng)
        H.append(("H2 (post-hoc)", "swapped-example tuning raises a post-hoc reporter's fidelity by >= 0.20", m, lo, hi, verdict(lo, hi, 0.20)))
    if j and p:  # not pre-registered: reported as an observation
        m, lo, hi, _ = boot(paired(j, p, fid), rng); H.append(("observation", "joint minus post-hoc fidelity (not pre-registered)", m, lo, hi, "-"))
        m, lo, hi, _ = boot(paired(j, p, lambda r: r["natural_only"]["das_iia"]), rng); H.append(("observation", "joint minus post-hoc DAS swap success (not pre-registered)", m, lo, hi, "-"))
    L += ["## Hypotheses", "", "| id | claim | effect | 95% interval | verdict |", "| --- | --- | --- | --- | --- |"]
    L += [f"| {h} | {t} | {m:.3f} | {lo:.3f} to {hi:.3f} | {v} |" for h, t, m, lo, hi, v in H]
    if p:
        bad = [s for s, r in p.items() if r["natural_only"]["introspection_fidelity"] == r["natural_only"]["introspection_fidelity"] and r["natural_only"]["introspection_fidelity"] < 0.5]
        L += ["", f"Post-hoc seeds with fidelity below 0.5: {len(bad)} of {len(p)} ({', '.join(map(str, bad))})."]
    out = "\n".join(L) + "\n"; open(os.path.join(d, "report.md"), "w").write(out); print(out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out/introspection")
