#!/usr/bin/env python3
"""Introspection toy: does a network's self-report track the internal state it actually uses?

A two-layer ReLU network over 12 input bits computes a concept c = (x0 AND x1) OR x2 and is trained on the task
output c XOR x3. A report head on the second hidden layer is trained, jointly, to say whether c is active.

Three measurements (hypotheses in HYPOTHESES.md, registered before any run):
  natural accuracy       report correct on held-out inputs (the "it compiles" number)
  introspection fidelity edit hidden layer 2 along the direction the task head reads, by exactly the amount that makes
                         the network act as if c flipped (task logit mirrored, input unchanged); share where the
                         report flips too (the "statement is faithful" number)
  probe causal rate      a linear probe for c, fitted afterwards, gives a "c direction" label; steering along it by
                         the same edit size, share where the task output flips (is the label causal?)
Plus the outside-check variant: a share of report-training examples use edited states, labelled with the state the
network now acts on (--cf 0.25).

NumPy only, CPU, deterministic per seed; runs on any Mac or laptop.
  python3 research/introspection/introspect.py --seeds 20 --out out/introspection.json
  python3 research/introspection/introspect.py --seed-list 0,3,6 --cf 0.25        (one shard of seeds)
"""
import argparse, json, math, sys, time
import numpy as np

D, H = 12, 32
CONCEPT = 1  # 1: c = (x0 AND x1) OR x2, task c XOR x3.  2 (H7): c = (x4 OR x5) AND NOT x6, task c XOR x7.
XB = 3       # the bit the task XORs with c

def data():
    X = ((np.arange(2 ** D)[:, None] >> np.arange(D)) & 1).astype(np.float64)
    if CONCEPT == 2: c = (((X[:, 4] + X[:, 5]) > 0) & (X[:, 6] == 0)).astype(np.float64)
    else: c = ((X[:, 0] * X[:, 1]) + X[:, 2] > 0).astype(np.float64)
    y = np.logical_xor(c > 0, X[:, XB] > 0).astype(np.float64)
    return X, c, y

def sig(z): return 1 / (1 + np.exp(-np.clip(z, -30, 30)))

class Net:
    def __init__(s, rng, skip=False):
        s.skip = skip
        g = lambda a, b: rng.normal(0, math.sqrt(2 / a), (a, b))
        s.p = {"W1": g(D, H), "b1": np.zeros(H), "W2": g(H, H), "b2": np.zeros(H),
               "u": g(H, 1)[:, 0] * 0.5, "bu": np.zeros(1), "w": g(H, 1)[:, 0] * 0.5, "bw": np.zeros(1), "wx": np.zeros(D + 1 if skip == "and" else D)}
        s.m = {k: np.zeros_like(v) for k, v in s.p.items()}; s.v = {k: np.zeros_like(v) for k, v in s.p.items()}; s.t = 0
    def trunk(s, X):
        a1 = X @ s.p["W1"] + s.p["b1"]; h1 = np.maximum(a1, 0)
        a2 = h1 @ s.p["W2"] + s.p["b2"]; h2 = np.maximum(a2, 0)
        return a1, h1, a2, h2
    def task(s, h2): return h2 @ s.p["u"] + s.p["bu"][0]
    def shortcut(s, X): return np.c_[X, X[:, 0] * X[:, 1]] if s.skip == "and" else X  # concept 1 only
    def report(s, h2, X=None):
        z = h2 @ s.p["w"] + s.p["bw"][0]
        return z + s.shortcut(X) @ s.p["wx"] if (s.skip and X is not None) else z
    def step(s, grads, lr=3e-3):
        s.t += 1
        for k, g in grads.items():
            s.m[k] = 0.9 * s.m[k] + 0.1 * g; s.v[k] = 0.999 * s.v[k] + 0.001 * g * g
            mh = s.m[k] / (1 - 0.9 ** s.t); vh = s.v[k] / (1 - 0.999 ** s.t)
            s.p[k] -= lr * mh / (np.sqrt(vh) + 1e-8)

def train(seed, skip=False, steps=3000, report_weight=0.5):
    """Jointly train the trunk, the task head (c XOR x3) and the report head (is c active?) on natural inputs."""
    rng = np.random.default_rng(seed)
    X, c, y = data()
    idx = rng.permutation(len(X)); tr, te = idx[: len(X) * 3 // 4], idx[len(X) * 3 // 4:]
    net = Net(rng, skip)
    for t in range(steps):
        b = rng.choice(tr, 256, replace=False); Xb, cb, yb = X[b], c[b], y[b]
        a1, h1, a2, h2 = net.trunk(Xb)
        dzt = (sig(net.task(h2)) - yb) / len(b); dzr = report_weight * (sig(net.report(h2, Xb)) - cb) / len(b)
        g = {"u": h2.T @ dzt, "bu": np.array([dzt.sum()]), "w": h2.T @ dzr, "bw": np.array([dzr.sum()]), "wx": (net.shortcut(Xb).T @ dzr) if skip else np.zeros_like(net.p["wx"])}
        da2 = (np.outer(dzt, net.p["u"]) + np.outer(dzr, net.p["w"])) * (a2 > 0)
        g["W2"] = h1.T @ da2; g["b2"] = da2.sum(0)
        da1 = (da2 @ net.p["W2"].T) * (a1 > 0)
        g["W1"] = Xb.T @ da1; g["b1"] = da1.sum(0)
        net.step(g)
    return net, X[te], c[te], y[te], X[tr], c[tr]

def interchange(net, Xb, Xs, v):
    """Swap the component along unit vector v of hidden layer 1 from source inputs into base inputs."""
    _, h1b, _, _ = net.trunk(Xb); _, h1s, _, _ = net.trunk(Xs)
    d = (h1s - h1b) @ v
    h1p = h1b + d[:, None] * v[None, :]
    a2 = h1p @ net.p["W2"] + net.p["b2"]; h2p = np.maximum(a2, 0)
    return h1b, h1s, d, h1p, a2, h2p

def das(net, X, c, rng, steps=1500, lr=0.02, restarts=1):
    """Best of `restarts` searches, chosen by swap success on training pairs (never on test pairs)."""
    if restarts > 1:
        b, s = pairs(X, c, rng, 1000)
        cands = [das(net, X, c, rng, steps, lr, 1) for _ in range(restarts)]
        return max(cands, key=lambda v: measure(net, X, c, b, s, v)[0])
    return _das(net, X, c, rng, steps, lr)

def _das(net, X, c, rng, steps=1500, lr=0.02):
    """Distributed alignment search, 1-D at layer 1: find v so swapping it makes the task act on the source's c."""
    v = rng.normal(size=H); v /= np.linalg.norm(v)
    m = np.zeros(H); s2 = np.zeros(H)
    for t in range(1, steps + 1):
        b = rng.integers(0, len(X), 256); sidx = rng.integers(0, len(X), 256)
        keep = c[b] != c[sidx]; b, sidx = b[keep], sidx[keep]
        target = np.logical_xor(c[sidx] > 0, X[b, XB] > 0).astype(float)
        h1b, h1s, d, h1p, a2, h2p = interchange(net, X[b], X[sidx], v)
        z = net.task(h2p); dz = (sig(z) - target) / len(b)
        g_h1p = (dz[:, None] * net.p["u"][None, :] * (a2 > 0)) @ net.p["W2"].T
        gv = (g_h1p * d[:, None]).sum(0) + ((h1s - h1b) * (g_h1p @ v)[:, None]).sum(0)
        m = 0.9 * m + 0.1 * gv; s2 = 0.999 * s2 + 0.001 * gv * gv
        v -= lr * (m / (1 - 0.9 ** t)) / (np.sqrt(s2 / (1 - 0.999 ** t)) + 1e-8); v /= np.linalg.norm(v)
    return v

def pairs(X, c, rng, n=2000):
    b = rng.integers(0, len(X), n * 3); s = rng.integers(0, len(X), n * 3); k = c[b] != c[s]
    return b[k][:n], s[k][:n]

def measure(net, X, c, b, s, v):
    target = np.logical_xor(c[s] > 0, X[b, XB] > 0)
    *_, h2p = interchange(net, X[b], X[s], v)
    took = (net.task(h2p) > 0) == target
    follows = (net.report(h2p, X[b]) > 0) == (c[s] > 0)
    return float(took.mean()), float(follows[took].mean()) if took.any() else float("nan")

def finetune_report(net, X, c, rng, v, cf, steps=1500, lr=3e-3):
    """Outside check on the report only: trunk frozen; cf share of examples are swapped states labelled c(source)."""
    w, bw, wx = net.p["w"].copy(), net.p["bw"].copy(), net.p["wx"].copy(); n = H + 1 + len(wx); m = np.zeros(n); s2 = np.zeros(n)
    for t in range(1, steps + 1):
        idx = rng.integers(0, len(X), 256); *_, h2 = net.trunk(X[idx]); tgt = c[idx]; Xin = X[idx]
        k = int(cf * 256) if v is not None else 0
        if k:
            b, s = pairs(X, c, rng, k); *_, h2p = interchange(net, X[b], X[s], v)
            h2 = np.concatenate([h2, h2p]); tgt = np.concatenate([tgt, c[s]]); Xin = np.concatenate([Xin, X[b]])
        z = h2 @ w + bw[0] + (net.shortcut(Xin) @ wx if net.skip else 0)
        dz = (sig(z) - tgt) / len(h2)
        g = np.r_[h2.T @ dz, dz.sum(), (net.shortcut(Xin).T @ dz) if net.skip else np.zeros(len(wx))]
        m = 0.9 * m + 0.1 * g; s2 = 0.999 * s2 + 0.001 * g * g
        step = lr * (m / (1 - 0.9 ** t)) / (np.sqrt(s2 / (1 - 0.999 ** t)) + 1e-8)
        w -= step[:H]; bw -= step[H:H + 1]; wx -= step[H + 1:]
    net.p["w"], net.p["bw"], net.p["wx"] = w, bw, wx

def run_seed(seed, cf=0.25, steps=3000, skip=False, posthoc=False, restarts=1):
    rng = np.random.default_rng(seed)
    net, Xte, cte, yte, Xtr, ctr = train(seed, skip, steps, report_weight=0.0 if posthoc else 0.5)
    if posthoc:  # the reporter is trained afterwards, network frozen, on natural states only
        net.p["w"][:] = 0; net.p["bw"][:] = 0; net.p["wx"][:] = 0
        finetune_report(net, Xtr, ctr, rng, None, 0.0)
    _, _, _, h2 = net.trunk(Xte)
    task_acc = float(((net.task(h2) > 0) == (yte > 0)).mean())
    natural = float(((net.report(h2, Xte) > 0) == (cte > 0)).mean())
    v = das(net, Xtr, ctr, rng, restarts=restarts)
    b, s = pairs(Xte, cte, rng)
    iia, fidelity = measure(net, Xte, cte, b, s, v)
    # Linear probe for c at layer 1 (the interpretability "label"), and the same swap along it.
    _, h1tr, _, _ = net.trunk(Xtr)
    coef = np.linalg.lstsq(np.c_[h1tr, np.ones(len(h1tr))], 2 * ctr - 1, rcond=None)[0]; p = coef[:-1] / np.linalg.norm(coef[:-1])
    _, h1te, _, _ = net.trunk(Xte)
    probe_acc = float((((np.c_[h1te, np.ones(len(h1te))] @ coef) > 0) == (cte > 0)).mean())
    probe_iia, _ = measure(net, Xte, cte, b, s, p)
    cos_vp = float(abs(v @ p))
    r = rng.normal(size=H); r /= np.linalg.norm(r); random_iia, _ = measure(net, Xte, cte, b, s, r)
    base = {"task_acc": task_acc, "natural_report_acc": natural, "das_iia": iia, "introspection_fidelity": fidelity,
            "probe_acc": probe_acc, "probe_iia": probe_iia, "random_iia": random_iia, "cos_das_probe": cos_vp}
    finetune_report(net, Xtr, ctr, rng, v, cf)
    _, _, _, h2 = net.trunk(Xte)
    natural2 = float(((net.report(h2, Xte) > 0) == (cte > 0)).mean())
    _, fidelity2 = measure(net, Xte, cte, b, s, v)
    return {"seed": seed, "skip": skip, "posthoc": posthoc, "natural_only": base, "counterfactual": {"natural_report_acc": natural2, "introspection_fidelity": fidelity2, "das_iia": iia}}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=20); ap.add_argument("--seed-list", default="")
    ap.add_argument("--cf", type=float, default=0.25, help="share of report examples on edited states in the outside-check variant")
    ap.add_argument("--steps", type=int, default=3000); ap.add_argument("--out", default="")
    ap.add_argument("--restarts", type=int, default=1, help="DAS restarts, best chosen on training pairs")
    ap.add_argument("--posthoc", action="store_true", help="train the reporter after the network, network frozen (H6)")
    ap.add_argument("--skip", nargs="?", const="linear", default="", help="report shortcut: 'linear' = raw input bits (H4), 'and' = bits plus x0*x1 (H5)")
    ap.add_argument("--concept", type=int, default=1, help="1 = (x0 AND x1) OR x2 with x3; 2 = (x4 OR x5) AND NOT x6 with x7 (H7)")
    a = ap.parse_args()
    global CONCEPT, XB
    CONCEPT, XB = a.concept, (7 if a.concept == 2 else 3)
    seeds = [int(s) for s in a.seed_list.split(",") if s] if a.seed_list else list(range(a.seeds))
    rows, t0 = [], time.time()
    for s in seeds:
        r = run_seed(s, a.cf, a.steps, a.skip, a.posthoc, a.restarts); rows.append(r); b, c = r["natural_only"], r["counterfactual"]
        print(f"seed {s}: task {b['task_acc']:.3f} | report {b['natural_report_acc']:.3f} | DAS swap took {b['das_iia']:.3f}, report follows {b['introspection_fidelity']:.3f} | "
              f"probe acc {b['probe_acc']:.3f}, probe swap took {b['probe_iia']:.3f}, random {b['random_iia']:.3f}, |cos| {b['cos_das_probe']:.2f} | after swapped-example tuning: report {c['natural_report_acc']:.3f}, follows {c['introspection_fidelity']:.3f}", flush=True)
    out = {"experiment": "introspection-fidelity", "concept": a.concept, "restarts": a.restarts, "posthoc": a.posthoc, "skip": a.skip, "cf": a.cf, "steps": a.steps, "seconds": round(time.time() - t0, 1), "rows": rows}
    if a.out:
        with open(a.out, "w") as f: json.dump(out, f)
    return out

if __name__ == "__main__":
    main()
