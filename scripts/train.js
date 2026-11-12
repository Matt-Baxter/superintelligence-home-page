#!/usr/bin/env node
// One entry point for every training and self-improvement loop in this repo. Each loop still lives in its own file;
// this script runs them in the right order and reports where each one stands. See docs/TRAINING.md.
//
//   node scripts/train.js status                 what each loop last produced, and when
//   node scripts/train.js cycle [loop flags]     research loop with merge: checks, experiments, introspection
//                                                (passes flags to scripts/research-loop.js)
//   node scripts/train.js data [--budget 12]     Lab ratchet over every example, then a split fine-tuning dataset
//   node scripts/train.js all                    cycle + merge + data
//
// Outputs stay out of git: LOOP_DIR (default out/loop), out/lab, out/train.
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { spawnSync } = require("child_process");
const root = path.join(__dirname, ".."), args = process.argv.slice(2), cmd = args[0] || "status";
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const LOOP_DIR = path.resolve((process.env.LOOP_DIR || path.join(root, "out", "loop")).replace(/^~(?=$|\/)/, require("os").homedir()));
const LAB = process.env.LAB_OUT || path.join(root, "out", "lab"), TRAIN = path.join(root, "out", "train");
const node = (script, a) => { const r = spawnSync(process.execPath, [path.join(root, script), ...a], { cwd: root, stdio: "inherit", env: process.env }); if (r.status !== 0) process.exit(r.status || 1); };

// The loops, in one place. `last` returns a one-line state or null if it has never run here.
const LOOPS = [
  { id: "research-loop", what: "Seeded experiments and pre-registered hypotheses, pooled across machines", run: "train.js cycle", where: "scripts/research-loop.js",
    last: () => { const f = path.join(LOOP_DIR, "report.md"); if (!fs.existsSync(f)) return null; const s = fs.readFileSync(f, "utf8");
      const v = (s.match(/\| (supported|not supported|undecided|too few)[^|]*\|/g) || []).map((x) => x.replace(/[|]/g, "").trim().split(" (")[0]);
      const c = v.reduce((a, x) => ({ ...a, [x]: (a[x] || 0) + 1 }), {}); return `${when(f)}; hypotheses: ${Object.entries(c).map(([k, n]) => `${n} ${k}`).join(", ")}`; } },
  { id: "introspection", what: "Trains small networks to report a concept; checks reports with interchange interventions (Python + NumPy)", run: "train.js cycle --introspection 60", where: "research/introspection/introspect.py",
    last: () => { const hosts = fs.existsSync(LOOP_DIR) ? fs.readdirSync(LOOP_DIR).filter((h) => fs.existsSync(path.join(LOOP_DIR, h, "latest.json"))) : [];
      const n = hosts.reduce((a, h) => a + ((JSON.parse(fs.readFileSync(path.join(LOOP_DIR, h, "latest.json"), "utf8")).samples || {})["introspection-h7"] || []).length, 0); return n ? `${n} seeds trained (latest per machine)` : null; } },
  { id: "verification-ratchet", what: "Edits verification rules; keeps an edit only if train improves and held-out holds", run: "npm run verification:ratchet", where: "scripts/verification-ratchet.js",
    last: () => { const hosts = fs.existsSync(LOOP_DIR) ? fs.readdirSync(LOOP_DIR).filter((h) => fs.existsSync(path.join(LOOP_DIR, h, "latest.json"))) : [];
      const c = hosts.flatMap((h) => (JSON.parse(fs.readFileSync(path.join(LOOP_DIR, h, "latest.json"), "utf8")).checks || []).filter((x) => /verification-ratchet/.test(x.cmd)).map((x) => `${h} ${x.ok ? "ok" : "FAILED"}`));
      return c.length ? `dry run in last cycle: ${c.join(", ")}` : null; } },
  { id: "lab-ratchet", what: "Autoresearch ratchet over each Lab example (deterministic or model proposer)", run: "train.js data", where: "scripts/lab.js explore",
    last: () => { if (!fs.existsSync(LAB)) return null; const f = fs.readdirSync(LAB).filter((x) => x.startsWith("explore-")); return f.length ? `${f.length} runs over ${new Set(f.map((x) => x.replace(/^explore-|-\d+\.json$/g, ""))).size} examples` : null; } },
  { id: "fine-tune-data", what: "SFT rows and DPO pairs from kept vs rejected ratchet steps, split by example family", run: "train.js data", where: "out/train/",
    last: () => { const f = path.join(TRAIN, "manifest.json"); if (!fs.existsSync(f)) return null; const m = JSON.parse(fs.readFileSync(f, "utf8"));
      return `${when(f)}; ${Object.entries(m.splits).map(([k, s]) => `${k} ${s.sft} SFT/${s.dpo} DPO`).join(", ")}; status: ${m.status}`; } },
  { id: "gemma-lora", what: "LoRA fine-tune of a local Gemma on out/train (MLX, Apple silicon only)", run: "see docs/TRAINING.md", where: "modules/lab/README.md", last: () => (fs.existsSync(path.join(root, "adapters")) ? "adapters/ present" : null) },
];
function when(f) { const m = fs.statSync(f).mtime; const h = (Date.now() - m) / 36e5; return `updated ${h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`} ago`; }

function status() {
  console.log(`Training loops (LOOP_DIR=${path.relative(root, LOOP_DIR) || LOOP_DIR})\n`);
  for (const l of LOOPS) { let s; try { s = l.last(); } catch (e) { s = `unreadable (${e.message})`; } console.log(`${l.id.padEnd(22)} ${s || "not run on this machine"}\n${"".padEnd(22)} ${l.what}\n${"".padEnd(22)} run: ${l.run} · code: ${l.where}\n`); }
}

// Split by example family (the runner), so no family appears in two splits; the assignment depends only on the
// family name, so it is stable across runs and machines. Test is frozen: never used for training or prompts.
function split(family) { const h = parseInt(crypto.createHash("sha256").update(family).digest("hex").slice(0, 8), 16) % 10; return h < 7 ? "train" : h < 8 ? "valid" : "test"; }

function data() {
  const L = require("../modules/lab/lab"), budget = opt("--budget", "12");
  for (const e of L.EX.examples) node("scripts/lab.js", ["explore", e.id, "--budget", budget]);
  const latest = {};
  for (const f of fs.readdirSync(LAB).filter((x) => /^explore-.*\.json$/.test(x)).sort()) latest[f.replace(/^explore-|-\d+\.json$/g, "")] = f; // newest per example
  const out = { train: { sft: [], dpo: [] }, valid: { sft: [], dpo: [] }, test: { sft: [], dpo: [] } }, families = {};
  for (const [id, f] of Object.entries(latest)) {
    const ex = L.BY_ID[id]; if (!ex) continue; const fam = ex.reproduce.runner, s = split(fam); (families[s] ||= new Set()).add(fam);
    const t = L.trainingRows(JSON.parse(fs.readFileSync(path.join(LAB, f), "utf8")));
    out[s].sft.push(...t.sft.map((r) => ({ ...r, meta: { example: id, family: fam } }))); out[s].dpo.push(...t.dpo.map((r) => ({ ...r, meta: { example: id, family: fam } })));
  }
  fs.mkdirSync(TRAIN, { recursive: true });
  const w = (f, rows) => fs.writeFileSync(path.join(TRAIN, f), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  // mlx_lm.lora reads data/{train,valid,test}.jsonl with a "messages" field; meta is kept alongside for review.
  for (const s of Object.keys(out)) { w(`${s}.jsonl`, out[s].sft); w(`dpo-${s}.jsonl`, out[s].dpo); }
  let commit = ""; try { commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(); } catch {}
  const manifest = { created: new Date().toISOString(), commit, budget: Number(budget), examples: Object.keys(latest).length,
    status: "unreviewed: candidates only, not approved for training (needs human review, rights review and a recorded base-model revision)",
    split_rule: "by example family (runner), sha256(family) mod 10: 0-6 train, 7 valid, 8-9 test; test is frozen",
    splits: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { sft: v.sft.length, dpo: v.dpo.length, families: [...(families[k] || [])].sort() }])) };
  fs.writeFileSync(path.join(TRAIN, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const overlap = ["train", "valid", "test"].flatMap((a, i, xs) => xs.slice(i + 1).map((b) => [...(families[a] || [])].filter((f) => (families[b] || new Set()).has(f)))).flat();
  if (overlap.length) { console.error(`family leaked across splits: ${overlap.join(", ")}`); process.exit(1); }
  console.log(`\nfine-tuning data -> ${path.relative(root, TRAIN)}: ${Object.entries(manifest.splits).map(([k, s]) => `${k} ${s.sft} SFT/${s.dpo} DPO (${s.families.length} families)`).join("; ")}\nstatus: ${manifest.status}`);
}

const loopArgs = args.slice(1);
if (cmd === "status") status();
else if (cmd === "cycle") node("scripts/research-loop.js", [...loopArgs.filter((a) => a !== "--and-merge"), "--and-merge"]);
else if (cmd === "merge") node("scripts/research-loop.js", ["--merge"]);
else if (cmd === "data") data();
else if (cmd === "all") { node("scripts/research-loop.js", [...loopArgs.filter((a) => a !== "--and-merge"), "--and-merge"]); data(); status(); }
else { console.error(`Unknown command "${cmd}". Use status, cycle, merge, data or all.`); process.exit(1); }
