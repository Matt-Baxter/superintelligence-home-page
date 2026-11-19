#!/usr/bin/env node
// CI test runner (npm run test:ci, and .github/workflows/ci.yml at the repo root).
// Runs every unit and contract suite (test/*-unit.js) plus the spec acceptance suite in API mode.
// No browser and no network: everything runs on synthetic sample data, about 20 s in total.
const { spawnSync } = require("node:child_process"), path = require("node:path"), fs = require("node:fs");
const root = path.join(__dirname, "..");

const SKIP = {
  "lean-proof-unit.js": "needs the Lean toolchain; run with npm run test:proof-admission on a machine that has it",
};

const suites = [
  ...fs.readdirSync(__dirname).filter((f) => f.endsWith("-unit.js") && !SKIP[f]).sort().map((f) => ["test/" + f]),
  ["test/spec-acceptance.js"],
];

const failures = [];
for (const [file, ...args] of suites) {
  const started = Date.now();
  const r = spawnSync(process.execPath, ["--no-warnings", file, ...args], { cwd: root, encoding: "utf8", timeout: 120_000 });
  const ok = r.status === 0;
  const summary = (r.stdout || "").trim().split("\n").pop() || "";
  console.log(`${ok ? "✓" : "✗"} ${file} (${Date.now() - started} ms) ${summary}`);
  if (!ok) { failures.push(file); process.stdout.write((r.stdout || "") + (r.stderr || "")); }
}
for (const [file, why] of Object.entries(SKIP)) console.log(`- skipped test/${file}: ${why}`);
console.log(`\n${suites.length - failures.length} of ${suites.length} suites passed.`);
if (failures.length) { console.log("Failed: " + failures.join(", ")); process.exit(1); }
