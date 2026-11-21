#!/usr/bin/env node
// Generate and check the cross-runtime schemas (schema/types.json -> schema/gen/*).
//   node scripts/schema.js            write schema/gen/ (npm run schema)
//   node scripts/schema.js check      fail if schema/gen/ is out of date (preflight)
//   node scripts/schema.js check --runtimes   also load the examples in every runtime that's installed:
//        zod (Node), pydantic + pyarrow + protoc via grpcio-tools (Python), serde (Rust)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const S = require("../lib/schema");
const root = path.join(__dirname, "..");
const [cmd = "gen", ...flags] = process.argv.slice(2);
const files = S.generateAll();

if (cmd === "gen") {
  fs.mkdirSync(S.OUT, { recursive: true });
  for (const f of files) fs.writeFileSync(f.file, f.text);
  console.log(`schema: wrote ${files.length} files to schema/gen (${S.generators.ids().join(", ")})`);
  process.exit(0);
}

const stale = files.filter((f) => !fs.existsSync(f.file) || fs.readFileSync(f.file, "utf8") !== f.text).map((f) => path.relative(root, f.file));
const results = [["up to date", !stale.length, stale.length ? `stale: ${stale.join(", ")} (run npm run schema)` : `${files.length} files`]];

if (flags.includes("--runtimes")) {
  const examples = JSON.parse(fs.readFileSync(path.join(root, "schema", "examples.json"), "utf8")).examples;
  const run = async (name, fn) => { try { results.push([name, true, await fn()]); } catch (e) { const m = String(e.stderr || e.stdout || e.message).trim().split("\n").slice(-3).join(" | "); results.push([name, e.code === "ENOENT" || /No module named|not installed/.test(m) ? "skip" : false, m.slice(0, 300)]); } };
  (async () => {
    await run("zod", async () => {
      const z = await import(path.join(S.OUT, "zod.mjs"));
      for (const [type, value] of Object.entries(examples)) z[type].parse(value);
      const bad = z.Tag.safeParse({ qid: "Not a qid", label: "x", matched: [], method: "ontology-term" });
      if (bad.success) throw new Error("zod accepted an invalid qid");
      return `${Object.keys(examples).length} examples parse; invalid qid rejected`;
    });
    await run("pydantic", () => execFileSync("python3", ["-I", "-c", `
import json, sys; sys.path.insert(0, ${JSON.stringify(S.OUT)})
import models
ex = json.load(open(${JSON.stringify(path.join(root, "schema", "examples.json"))}))["examples"]
for t, v in ex.items():
    m = getattr(models, t).model_validate(v)
    assert m.model_dump(by_alias=True, exclude_none=True, mode="json") == {k: x for k, x in v.items() if x is not None}, t
print(f"{len(ex)} examples validate and round-trip")`], { encoding: "utf8" }).trim());
    await run("arrow", () => execFileSync("python3", ["-I", "-c", `
import json, sys; sys.path.insert(0, ${JSON.stringify(S.OUT)})
import pyarrow as pa, arrow_schema as A
ex = json.load(open(${JSON.stringify(path.join(root, "schema", "examples.json"))}))["examples"]
for name in ("Tag", "Chunk", "Edge", "Embedding"):
    t = pa.Table.from_pylist([ex[name]], schema=A.SCHEMAS[name])
    assert t.num_rows == 1
print(f"{len(A.SCHEMAS)} schemas; Tag, Chunk, Edge, Embedding examples load as tables")`], { encoding: "utf8" }).trim());
    await run("protobuf", () => {
      const out = fs.mkdtempSync(path.join(require("os").tmpdir(), "si-proto-"));
      execFileSync("python3", ["-I", "-m", "grpc_tools.protoc", `-I${S.OUT}`, `--python_out=${out}`, `--grpc_python_out=${out}`, path.join(S.OUT, "si.proto")], { encoding: "utf8" });
      return execFileSync("python3", ["-I", "-c", `import sys; sys.path.insert(0, ${JSON.stringify(out)}); import si_pb2, si_pb2_grpc; t = si_pb2.Tag(qid="topic:alignment", label="Alignment", matched=["alignment"]); assert si_pb2.Tag.FromString(t.SerializeToString()).qid == "topic:alignment"; print("compiles with protoc; messages round-trip; gRPC stub", "KnowledgeStub" in dir(si_pb2_grpc))`], { encoding: "utf8" }).trim();
    });
    await run("rust", () => execFileSync("cargo", ["test", "-q", "--release", "--lib", "--features", "types", "types_examples"], { cwd: path.join(root, "interop/rust/si-expr"), encoding: "utf8", timeout: 600000 }).trim().split("\n").filter(Boolean).pop());
    finish();
  })();
} else finish();

function finish() {
  for (const [n, ok, d] of results) console.log(`${ok === true ? "✓" : ok === "skip" ? "-" : "✗"} ${n.padEnd(10)} ${d}`);
  process.exit(results.every(([, ok]) => ok === true || ok === "skip") ? 0 : 1);
}
