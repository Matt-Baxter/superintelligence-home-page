#!/usr/bin/env node
// Runs test/expr-vectors.json in every si-expr runtime that's available: Node (always), Python, Rust and WebAssembly.
//   node scripts/expr-check.js            Node + whatever else is installed
//   node scripts/expr-check.js --require python,rust,wasm   fail if one of those can't run (CI)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const vectorsFile = path.join(root, "test", "expr-vectors.json");
const { vectors } = JSON.parse(fs.readFileSync(vectorsFile, "utf8"));
const required = new Set((process.argv.find((a) => a.startsWith("--require=")) || process.argv[process.argv.indexOf("--require") + 1] || "").replace("--require=", "").split(",").filter(Boolean));
const spec = require(path.join(root, "lib", "expr", "spec.json"));
const results = [];
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(x) { return Array.isArray(x) ? x.map(sortKeys) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortKeys(x[k])])) : x; }

// Node, plus: every operator in spec.json is implemented here, and nothing undocumented is.
const ev = require(path.join(root, "lib", "expr"));
const ops = new Set(ev.operators()), documented = new Set(Object.keys(spec.operators));
const missing = [...documented].filter((o) => !ops.has(o)), extra = [...ops].filter((o) => !documented.has(o));
let bad = vectors.filter((v) => { try { return !same(ev.evaluate(v.rule, v.data), v.expect); } catch { return true; } }).map((v) => v.name);
results.push(["node", bad.length === 0 && !missing.length && !extra.length, `${vectors.length - bad.length} of ${vectors.length}${missing.length ? `; missing ops ${missing}` : ""}${extra.length ? `; undocumented ops ${extra}` : ""}${bad.length ? `; failing ${bad.slice(0, 3)}` : ""}`]);

function tryRun(name, fn) {
  try { const out = fn(); results.push([name, true, out]); }
  catch (e) {
    const msg = String(e.stdout || e.stderr || e.message).trim().split("\n").slice(-2).join(" | ");
    if (e.code === "ENOENT" || /not available/.test(msg)) results.push([name, !required.has(name), `skipped: ${msg.slice(0, 120)}`]);
    else results.push([name, false, msg.slice(0, 300)]);
  }
}
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
if (only !== "node") {
tryRun("python", () => execFileSync("python3", ["-I", path.join(root, "interop/python/si_expr.py"), vectorsFile], { encoding: "utf8" }).trim().split("\n").pop());
const crate = path.join(root, "interop/rust/si-expr");
tryRun("rust", () => execFileSync("cargo", ["run", "-q", "--release", "--bin", "si-expr-vectors", "--", vectorsFile], { cwd: crate, encoding: "utf8", timeout: 600000 }).trim().split("\n").pop());
tryRun("wasm", () => {
  const wasm = process.env.SI_EXPR_WASM || path.join(crate, "target/wasm32-unknown-unknown/release/si_expr.wasm");
  if (!fs.existsSync(wasm)) { const e = new Error("not available: build with cargo build --release --target wasm32-unknown-unknown --lib"); throw e; }
  const inst = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasm)), {});
  const { memory, si_alloc, si_eval, si_free } = inst.exports;
  const put = (str) => { const b = Buffer.from(str, "utf8"); const p = si_alloc(b.length); new Uint8Array(memory.buffer, p, b.length).set(b); return [p, b.length]; };
  let wrong = [];
  for (const v of vectors) {
    const [rp, rl] = put(JSON.stringify(v.rule)), [dp, dl] = put(JSON.stringify(v.data));
    const packed = BigInt.asUintN(64, BigInt(si_eval(rp, rl, dp, dl)));
    const op = Number(packed >> 32n), ol = Number(packed & 0xffffffffn);
    const out = JSON.parse(Buffer.from(new Uint8Array(memory.buffer, op, ol)).toString("utf8"));
    si_free(rp, rl); si_free(dp, dl); si_free(op, ol);
    if (out.error || !same(out.ok, v.expect)) wrong.push(v.name);
  }
  if (wrong.length) throw new Error(`failing ${wrong.slice(0, 3)}`);
  return `wasm si-expr: ${vectors.length} of ${vectors.length} vectors pass (${(fs.statSync(wasm).size / 1024).toFixed(0)} KB)`;
});
}

for (const [n, ok, d] of results) console.log(`${ok ? "✓" : "✗"} ${n.padEnd(7)} ${d}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
