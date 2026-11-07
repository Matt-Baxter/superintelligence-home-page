#!/usr/bin/env node
// Lab worker: runs the examples and the autoresearch ratchet off the web server (laptop, Mac mini, CI, a sandbox).
//   node scripts/lab.js list
//   node scripts/lab.js run <example>                        reproduction vs our hypothesis, verdict
//   node scripts/lab.js explore <example> [--budget 12] [--target metric] [--tunable a,b]
//                                        [--provider ollama|lmstudio|openrouter|vercel-ai-gateway|cloudflare|groq] [--model name]
//   node scripts/lab.js export                               out/lab/results.tsv + train-sft.jsonl + train-dpo.jsonl
//   node scripts/lab.js intent "<request>"                    route a request with the gym's learned policy
// With DATABASE_URL / DATA_DIR set, runs are also recorded in lab_runs so the Lab page shows them.
// Default proposer is deterministic (free). A model proposer reads the example's program and history and must reply
// with {"params": {...}}; a bad reply counts as a rejected step. Training rows let you fine-tune a local model on the
// changes that were kept, e.g. Gemma with MLX on a Mac mini (see modules/lab/README.md).
const fs = require("fs"), path = require("path");
const L = require("../modules/lab/lab");
const OUT = process.env.LAB_OUT || path.join(__dirname, "..", "out", "lab");
const args = process.argv.slice(2), cmd = args[0];
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };

function llmProposer(providerId, model) {
  const P = require("../lib/providers"); const llm = P.create(providerId, model ? { model } : {});
  return { id: `${providerId}:${llm.model}`, about: `Model proposer via ${providerId}`,
    async propose({ program, history, params }) {
      const msg = `${program}\n\nCurrent params: ${JSON.stringify(params)}\nHistory (most recent last): ${JSON.stringify(history.slice(-8).map(({ params, value, kept }) => ({ params, value, kept })))}\n\nPropose the next params to try. Reply with JSON only: {"params": {...}}`;
      const reply = await llm.chat([{ role: "system", content: "You are a careful research assistant running a ratchet: propose one small, well-reasoned parameter change per step. JSON only." }, { role: "user", content: msg }], { json: true });
      const j = P.parseJson(reply); if (!j.params || typeof j.params !== "object") throw new Error("Reply has no params object");
      return { ...params, ...j.params };
    } };
}

async function record(rows) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.DATA_DIR) return false;
  const db = require("../lib/db"); const { createKernel } = require("../kernel/kernel");
  const k = createKernel(); db.extend({ sql: k.store.schema.join("\n"), columns: k.store.columns }); await db.ready();
  for (const r of rows) await db.insert("INSERT INTO lab_runs (example_id, kind, proposer, metric, value, result) VALUES (?, ?, ?, ?, ?, ?)", r.example_id, r.kind, r.proposer, r.metric, r.value, JSON.stringify(r.result));
  return true;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!cmd || cmd === "list") { for (const e of L.EX.examples) console.log(`${e.id.padEnd(22)} ${e.reproduce.runner.padEnd(15)} ${e.title}`); return; }
  if (cmd === "run") {
    const ids = args[1] ? [args[1]] : L.EX.examples.map((e) => e.id);
    const rows = [];
    for (const id of ids) { const r = L.runExample(id); console.log(`${id.padEnd(22)} ${r.verdict.text}`); rows.push({ example_id: id, kind: "run", proposer: "deterministic", metric: r.verdict.metric, value: r.verdict.variant, result: { verdict: r.verdict, baseline: r.baseline.metrics, variant: r.variant.metrics } }); }
    if (await record(rows)) console.log(`recorded ${rows.length} run(s) in lab_runs`);
    return;
  }
  if (cmd === "explore") {
    const id = args[1]; if (!L.BY_ID[id]) throw new Error(`Unknown example "${id}" (try: node scripts/lab.js list)`);
    const provider = opt("provider"), proposer = provider ? llmProposer(provider, opt("model")) : L.deterministicProposer;
    const res = await L.explore(id, { budget: Number(opt("budget", 12)), target: opt("target"), tunable: (opt("tunable", "") || "").split(",").filter(Boolean), proposer,
      onStep: (h) => console.log(`step ${String(h.step).padStart(2)} ${h.kept ? "kept    " : h.error ? "error   " : "rejected"} ${h.value ?? ""} ${h.error || JSON.stringify(h.params)}`) });
    console.log(`best ${res.metric} = ${res.best.metrics[res.metric]} with ${JSON.stringify(res.best.params)}`);
    const file = path.join(OUT, `explore-${id}-${Date.now()}.json`); fs.writeFileSync(file, JSON.stringify(res, null, 2));
    fs.appendFileSync(path.join(OUT, "results.tsv"), (fs.existsSync(path.join(OUT, "results.tsv")) ? "" : "time\texample\tproposer\tmetric\tvalue\tkept_steps\tparams\n") +
      `${new Date().toISOString()}\t${id}\t${proposer.id}\t${res.metric}\t${res.best.metrics[res.metric]}\t${res.history.filter((h) => h.kept && h.step).length}\t${JSON.stringify(res.best.params)}\n`);
    if (await record([{ example_id: id, kind: "explore", proposer: proposer.id, metric: res.metric, value: res.best.metrics[res.metric], result: { best: res.best, steps: res.history.length - 1, kept: res.history.filter((h) => h.kept && h.step).length } }])) console.log("recorded in lab_runs");
    console.log(`wrote ${path.relative(process.cwd(), file)}`);
    return;
  }
  if (cmd === "export") {
    const files = fs.readdirSync(OUT).filter((f) => f.startsWith("explore-") && f.endsWith(".json"));
    let sft = [], dpo = [];
    for (const f of files) { const t = L.trainingRows(JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"))); sft = sft.concat(t.sft); dpo = dpo.concat(t.dpo); }
    fs.writeFileSync(path.join(OUT, "train-sft.jsonl"), sft.map((x) => JSON.stringify(x)).join("\n") + (sft.length ? "\n" : ""));
    fs.writeFileSync(path.join(OUT, "train-dpo.jsonl"), dpo.map((x) => JSON.stringify(x)).join("\n") + (dpo.length ? "\n" : ""));
    console.log(`from ${files.length} explore run(s): ${sft.length} SFT rows, ${dpo.length} DPO pairs -> ${path.relative(process.cwd(), OUT)}`);
    return;
  }
  if (cmd === "intent") {
    const I = require("../modules/lab/intent"); const e = I.explain(I.policy(), args.slice(1).join(" "));
    console.log(`${e.action}\n  why: ${e.path.slice(-3).join("; ")}\n  plan: ${(I.PLANS[e.action] || I.PLANS.clarify)().join(" -> ")}`);
    return;
  }
  throw new Error(`Unknown command "${cmd}"`);
}
main().then(() => process.exit(0), (e) => { console.error("lab:", e.message); process.exit(1); });
