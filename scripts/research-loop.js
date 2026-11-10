#!/usr/bin/env node
// Continuous research loop for the formal-verification work, built to run on our own machines (a Mac mini, laptops).
// Each cycle: runs the unit checks and the bench, dry-runs the rules ratchet, checks the Lean toys if Lean is
// installed, and runs the Lab toys over many independent seeds. Machines split the seeds between them (--shard), write
// to a shared folder (LOOP_DIR, e.g. a synced folder), and --merge pools every machine's samples into confidence
// intervals and re-tests each hypothesis. Nothing is committed or pushed; results stay in LOOP_DIR.
//
//   node scripts/research-loop.js                       one cycle on this machine (shard 0/1)
//   node scripts/research-loop.js --shard 0/3 --seeds 300   this machine runs seeds 0, 3, 6, ... of 300
//   node scripts/research-loop.js --every 60            a cycle every 60 minutes until stopped
//   node scripts/research-loop.js --merge               pool all machines' latest results into report.md
//   LOOP_DIR=~/Sync/si-loop node scripts/research-loop.js ...   shared folder (default out/loop, git-ignored)
//   --introspection N   also train the introspection toy (Python 3 + NumPy) on this shard of N seeds per config,
//                       for H7 (research/introspection/HYPOTHESES.md); a few minutes per 10 seeds on a laptop
const fs = require("fs"), os = require("os"), path = require("path"), { execSync, spawnSync } = require("child_process");
const root = path.join(__dirname, ".."), P = require("../modules/lab/papers");
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }, has = (k) => args.includes(k);
const DIR = path.resolve((process.env.LOOP_DIR || path.join(root, "out", "loop")).replace(/^~(?=$|\/)/, os.homedir()));
const HOST = (process.env.LOOP_HOST || os.hostname()).replace(/[^\w.-]/g, "_");

// Experiments: each draws one sample per seed. Seeds are partitioned across machines, so samples never overlap.
const EXPERIMENTS = [
  { id: "threshold", about: "simulated minimum comparator power vs the formula 1 - P(claim)/P(easiest weakening)",
    sample: (seed) => Object.fromEntries([0.3, 0.5, 0.7, 0.9].map((d) => {
      const pred = P.comparatorThreshold(d); let sim = 1.05;
      for (let k = Math.max(0, Math.floor(pred * 20) - 3); k <= 20; k++) if (P.autoformalize({ gate: 1, power: k / 20, subtle_blind: 0, difficulty: d, steps: 600, batch: 32, seed }).metrics.weakened_share < 0.5) { sim = k / 20; break; }
      return [`gap_d${d}`, sim - pred];
    })) },
  { id: "subtle-blind", about: "weakened share of accepted proofs: exact comparator vs one blind to small weakenings",
    sample: (seed) => ({ exact: P.autoformalize({ gate: 1, power: 1, subtle_blind: 0, difficulty: 0.6, steps: 300, batch: 32, seed }).metrics.weakened_share,
      blind: P.autoformalize({ gate: 1, power: 1, subtle_blind: 1, difficulty: 0.6, steps: 300, batch: 32, seed }).metrics.weakened_share }) },
  { id: "drift-above", about: "claim retained after 12 generations at power 0.9: outside anchor minus self-reference",
    sample: (seed) => { const k = (a) => P.recursiveDrift({ anchor_every: a, power: 0.9, difficulty: 0.6, generations: 12, steps: 200, batch: 32, seed }).metrics.claim_retained; const a = k(1), s = k(0); return { anchor: a, self: s, leak: a - s }; } },
  { id: "drift-below", about: "same at power 0.5 (below threshold)",
    sample: (seed) => { const k = (a) => P.recursiveDrift({ anchor_every: a, power: 0.5, difficulty: 0.6, generations: 6, steps: 200, batch: 32, seed }).metrics.claim_retained; const a = k(1), s = k(0); return { anchor: a, self: s, leak: a - s }; } },
  { id: "library", about: "library contamination at a 10% budget: last results first vs foundations first (new random library per seed)",
    sample: (seed) => { const m = (st) => P.libraryFidelity({ strategy: st, budget: 0.1, mistranslate: 0.05, def_share: 0.25, nodes: 400, seed }).metrics; const a = m(0), b = m(2);
      return { unchecked: a.contaminated_unchecked, last_first: a.contaminated, foundations_first: b.contaminated, gain: a.contaminated - b.contaminated, relative: a.contaminated_unchecked ? (a.contaminated - b.contaminated) / a.contaminated_unchecked : 0 }; } },
];
// The Lab's pre-registered hypotheses, re-tested on pooled samples (mean and 95% interval of the named quantity).
const HYPOTHESES = [
  { id: "autoformalize-statement-gate", exp: "subtle-blind", q: (s) => s.blind - s.exact, bar: 0.2, text: "a size-blind comparator raises the weakened share by at least 0.2" },
  { id: "recursive-drift-below-threshold", exp: "drift-below", q: (s) => s.leak, bar: 0.3, text: "below threshold, self-reference loses at least 0.3 more of the claim" },
  { id: "recursive-drift-above-threshold", exp: "drift-above", q: (s) => s.leak, bar: 0.05, text: "above threshold, self-reference loses at least 0.05 more over 12 generations" },
  { id: "library-foundations-first", exp: "library", q: (s) => s.gain, bar: 0.2, text: "foundations first leaves at least 0.2 less contaminated (absolute)" },
  { id: "introspection H7", exp: "introspection-h7", q: (s) => s.das_gap, bar: 0.10, text: "joint training makes the reported concept's causal direction at least 0.10 easier to find" },
];

const stat = (xs) => { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / (n || 1), sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)), h = 1.96 * sd / Math.sqrt(n || 1);
  const r = (x) => Math.round(x * 10000) / 10000; return { n, mean: r(m), sd: r(sd), lo: r(m - h), hi: r(m + h) }; };
const sh = (cmd) => { const t = Date.now(); const r = spawnSync("sh", ["-c", cmd], { cwd: root, encoding: "utf8", timeout: 15 * 60e3 }); return { cmd, ok: r.status === 0, ms: Date.now() - t, tail: ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-3).join(" | ") }; };

function leanCheck() {
  const lean = spawnSync("sh", ["-c", "command -v lean || ls ~/.elan/bin/lean 2>/dev/null"], { encoding: "utf8" }).stdout.trim().split("\n")[0];
  if (!lean) return { available: false, note: "Lean not found (install elan to check the Lean toys on this machine)" };
  const concepts = require("../modules/learn/data/concepts.json").concepts.filter((c) => c.lean && c.lean.proved === false && !c.lean.needs);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "si-lean-")), out = [];
  for (const c of concepts) { const f = path.join(tmp, `${c.id.replace(/\W/g, "_")}.lean`); fs.writeFileSync(f, c.lean.statement + "\n"); const r = spawnSync(lean, [f], { encoding: "utf8", timeout: 120e3 }); out.push({ concept: c.id, checks: r.status === 0, message: (r.stdout + r.stderr).trim().slice(0, 300) }); }
  return { available: true, version: spawnSync(lean, ["--version"], { encoding: "utf8" }).stdout.trim(), results: out };
}

function cycle() {
  const [i, n] = String(arg("--shard", "0/1")).split("/").map(Number), N = Number(arg("--seeds", 100)), started = new Date();
  const seeds = Array.from({ length: N }, (_, s) => s).filter((s) => s % n === i).map((s) => 1000 + s * 7919);
  console.log(`[${HOST}] cycle ${started.toISOString()}: shard ${i}/${n}, ${seeds.length} of ${N} seeds per experiment -> ${DIR}`);
  const checks = has("--no-checks") ? [] : [sh("node test/verification-unit.js"), sh("node test/analysis-unit.js"), sh("node scripts/bench.js"), sh("node scripts/verification-ratchet.js")];
  for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.cmd} (${c.ms} ms) ${c.tail.slice(0, 160)}`);
  const samples = {};
  for (const e of EXPERIMENTS) { const t = Date.now(); samples[e.id] = seeds.map((s) => ({ seed: s, ...e.sample(s) })); console.log(`  ${e.id}: ${seeds.length} samples in ${Date.now() - t} ms`); }
  const introN = Number(arg("--introspection", 0));
  if (introN) {
    const ids = Array.from({ length: introN }, (_, s) => s).filter((s) => s % n === i), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "si-intro-")), t = Date.now();
    const go = (extra, f) => spawnSync("python3", ["research/introspection/introspect.py", "--concept", "2", "--restarts", "8", "--seed-list", ids.join(","), "--out", path.join(tmp, f), ...extra], { cwd: root, encoding: "utf8", timeout: 6 * 3600e3 });
    const a = go([], "joint.json"), b = go(["--posthoc"], "posthoc.json");
    if (a.status === 0 && b.status === 0) {
      const J = JSON.parse(fs.readFileSync(path.join(tmp, "joint.json"), "utf8")).rows, Pp = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(tmp, "posthoc.json"), "utf8")).rows.map((r) => [r.seed, r]));
      samples["introspection-h7"] = J.filter((r) => Pp[r.seed]).map((r) => ({ seed: r.seed, joint_das: r.natural_only.das_iia, posthoc_das: Pp[r.seed].natural_only.das_iia, das_gap: r.natural_only.das_iia - Pp[r.seed].natural_only.das_iia,
        joint_fidelity: r.natural_only.introspection_fidelity, posthoc_fidelity: Pp[r.seed].natural_only.introspection_fidelity, probe_swap: r.natural_only.probe_iia }));
      console.log(`  introspection-h7: ${ids.length} seeds x 2 configs trained in ${Date.now() - t} ms`);
    } else console.log(`  introspection: skipped (${((a.stderr || "") + (b.stderr || "")).trim().split("\n").pop() || "python3 with numpy needed"})`);
  }
  const lean = has("--no-lean") ? { available: false, note: "skipped" } : leanCheck();
  console.log(`  lean: ${lean.available ? lean.results.map((r) => `${r.concept} ${r.checks ? "checks" : "FAILS"}`).join(", ") || "nothing queued" : lean.note}`);
  let commit = ""; try { commit = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim(); } catch {}
  const rec = { host: HOST, platform: `${os.platform()} ${os.arch()}`, cpus: os.cpus().length, node: process.version, commit, started: started.toISOString(), finished: new Date().toISOString(), shard: `${i}/${n}`, seedsTotal: N, checks, lean, samples };
  const dir = path.join(DIR, HOST); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${started.toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(rec)); fs.writeFileSync(path.join(dir, "latest.json"), JSON.stringify(rec));
  console.log(`  wrote ${file}`);
  return rec;
}

function merge() {
  const hosts = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((h) => fs.existsSync(path.join(DIR, h, "latest.json"))) : [];
  const recs = hosts.map((h) => JSON.parse(fs.readFileSync(path.join(DIR, h, "latest.json"), "utf8")));
  if (!recs.length) { console.log(`no results in ${DIR}`); return; }
  const commits = [...new Set(recs.map((r) => r.commit))], pooled = {};
  for (const id of [...EXPERIMENTS.map((e) => e.id), "introspection-h7"]) { const seen = new Set(); pooled[id] = recs.flatMap((r) => r.samples[id] || []).filter((s) => !seen.has(s.seed) && seen.add(s.seed)); }
  const L = [`# Research loop: pooled results`, ``, `${new Date().toISOString()} · machines: ${recs.map((r) => `${r.host} (${r.platform}, ${r.cpus} cores, shard ${r.shard}, ${r.commit})`).join("; ")}`, ``];
  if (commits.length > 1) L.push(`**Warning:** machines ran different commits (${commits.join(", ")}); pool only results from the same code.`, ``);
  L.push(`## Experiments`, ``);
  for (const e of [...EXPERIMENTS, { id: "introspection-h7", about: "introspection toy, concept 2, best of 8 causal searches: jointly trained vs post-hoc reporters (Python)" }]) {
    const xs = pooled[e.id]; if (!xs.length) continue; L.push(`**${e.id}** (${xs.length} seeds): ${e.about}`, ``, `| quantity | mean | 95% interval | sd |`, `| --- | --- | --- | --- |`);
    for (const k of Object.keys(xs[0]).filter((k) => k !== "seed")) { const s = stat(xs.map((x) => x[k])); L.push(`| ${k} | ${s.mean} | ${s.lo} to ${s.hi} | ${s.sd} |`); }
    L.push(``);
  }
  L.push(`## Pre-registered hypotheses, re-tested on pooled seeds`, ``, `| example | hypothesis | effect (mean, 95% interval) | verdict |`, `| --- | --- | --- | --- |`);
  for (const h of HYPOTHESES) { const xs = pooled[h.exp]; if (!xs.length) continue; const s = stat(xs.map(h.q));
    const v = s.lo >= h.bar ? "supported (whole interval clears the bar)" : s.hi < h.bar ? "not supported (whole interval below the bar)" : "undecided (interval straddles the bar)";
    L.push(`| ${h.id} | ${h.text} | ${s.mean} (${s.lo} to ${s.hi}) | ${v} |`); }
  L.push(``, `## Checks per machine`, ``);
  for (const r of recs) L.push(`- ${r.host}: ${r.checks.map((c) => `${c.ok ? "ok" : "FAIL"} ${c.cmd.replace(/^node /, "")}`).join(", ") || "skipped"}; Lean: ${r.lean.available ? `${r.lean.version}; ${r.lean.results.map((x) => `${x.concept} ${x.checks ? "checks" : "fails"}`).join(", ") || "nothing queued"}` : r.lean.note}`);
  L.push(``, `Bars are the ones registered in modules/lab/examples.json; they are not changed after seeing these results.`);
  fs.writeFileSync(path.join(DIR, "report.md"), L.join("\n") + "\n"); console.log(L.join("\n"));
}

if (has("--merge")) merge();
else if (arg("--every")) { const min = Number(arg("--every")); const go = () => { try { cycle(); merge(); } catch (e) { console.error(e); } }; go(); setInterval(go, min * 60e3); }
else { cycle(); if (has("--and-merge")) merge(); }
