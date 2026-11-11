#!/usr/bin/env node
// Lean proofs of coordination and the element catalog (proposed REQ-069, REQ-072; proofs/CoordinationSpec.lean,
// Coordination.lean, FinalCheck.lean), and their correspondence with the running JavaScript:
//   1. build FinalCheck (each theorem's type is its trusted statement; #guard_msgs pins its axioms)
//   2. audit: lib/lean-proof.js axiom policy on every theorem, a scan for forbidden constructs, and negative controls
//   3. differential: the Lean definitions and the real code agree on generated inputs (paths, claims, saves through the
//      real artifact store, keys through checkRows, the catalog's load order as a DAG witness)
// Needs Lean 4.15.0 (LAKE=/path/to/lake, or lake on PATH). Synthetic inputs only.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), assert = require("node:assert/strict"), { execFileSync } = require("node:child_process");
const root = path.join(__dirname, ".."), cwd = path.join(root, "proofs"), lake = process.env.LAKE || "lake";
const run = (args) => execFileSync(lake, args, { cwd, encoding: "utf8", timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", m); };
const THEOREMS = ["overlap_symm", "overlap_refl", "conflictB_sound", "conflict_symm", "admit_safe", "release_safe", "admit_refuses_conflict", "saves_counted", "burst_exactly_one", "noDup_sound", "witness_acyclic"].map((n) => `Coord.${n}`);
const FORBIDDEN = /\bsorry\b|^\s*axiom\s|\bnative_decide\b|\bunsafe\b|@\[extern|implemented_by|\bpartial def\b|#eval/m;

(async () => {
  console.log("Build and audit");
  const version = run(["env", "lean", "--version"]).trim();
  ok(/^Lean \(version 4\.15\.0/.test(version), `pinned toolchain (${version.split(",")[0]})`);
  let built = ""; try { built = run(["build", "CoordinationSpec", "Coordination", "FinalCheck"]); } catch (e) { built = String(e.stdout || e.message); }
  ok(/Build completed successfully/.test(built), "CoordinationSpec, Coordination and FinalCheck build: every statement is proved and every axiom footprint matches its pin");
  const sources = ["CoordinationSpec.lean", "Coordination.lean", "FinalCheck.lean"].map((f) => [f, fs.readFileSync(path.join(cwd, f), "utf8").replace(/\/-[\s\S]*?-\//g, "").replace(/--.*$/gm, "")]);
  ok(sources.every(([, t]) => !FORBIDDEN.test(t)), "no sorry, axiom, native_decide, unsafe, extern, implemented_by, partial def or #eval in the trusted files or the proofs");
  ok(!/\btheorem\b/.test(sources[0][1]) && /def AdmitSafe : Prop/.test(sources[0][1]), "the statement file states and defines; it proves nothing (the challenge/solution split)");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "si-coord-lean-")), audit = path.join(dir, "Audit.lean");
  fs.writeFileSync(audit, `import Coordination\n${THEOREMS.map((n) => `#print axioms ${n}`).join("\n")}\n`);
  const report = require("../lib/lean-proof").auditReport(run(["env", "lean", audit]), THEOREMS);
  ok(report.footprints.length === 11 && report.footprints.every((f) => f.axioms.every((a) => ["propext", "Quot.sound"].includes(a))), `axiom audit: 11 theorems, using only ${[...new Set(report.footprints.flatMap((f) => f.axioms))].join(" and ")}`);
  // Negative controls: the checks must reject what they claim to reject.
  const bad = path.join(dir, "Bad.lean"); fs.writeFileSync(bad, `import CoordinationSpec\nopen Coord\ntheorem cheat : AdmitSafe := by sorry\n/-- info: 'cheat' depends on axioms: [propext] -/\n#guard_msgs in\n#print axioms cheat\n`);
  let badOut = ""; try { badOut = run(["env", "lean", bad]); } catch (e) { badOut = String(e.stdout || "") + String(e.stderr || ""); }
  let refused = false; try { require("../lib/lean-proof").auditReport(badOut, ["cheat"]); } catch { refused = true; }
  ok(/sorryAx/.test(badOut) && /error/.test(badOut) && refused, "negative control: a sorry proof fails the pinned #guard_msgs and the audit policy");
  const wrong = path.join(dir, "Wrong.lean"); fs.writeFileSync(wrong, `import CoordinationSpec\nopen Coord\n-- a statement that is false: a claim that conflicts is still admitted\ntheorem wrong : ∀ (cs : List Claim) (c : Claim), (admit cs c).length = cs.length + 1 := by\n  intro cs c; simp [admit]\n`);
  let wrongOut = ""; try { wrongOut = run(["env", "lean", wrong]); } catch (e) { wrongOut = String(e.stdout || "") + String(e.stderr || ""); }
  ok(/error/.test(wrongOut), "negative control: a false statement about admission does not prove");

  // The manifest (formalization.yaml, v0.4 layout): required sections, every main result named and pinned, counts true.
  const man = fs.readFileSync(path.join(cwd, "formalization.yaml"), "utf8");
  const decls = [...man.matchAll(/declaration: (Coord\.\w+), statement: (Coord\.\w+)/g)];
  const pinned = fs.readFileSync(path.join(cwd, "FinalCheck.lean"), "utf8");
  ok(["version:", "project:", "sources:", "status:", "automation:", "fidelity:", "review:"].every((k) => man.includes(`\n${k}`) || man.startsWith(k)) && /sorry_count: 0/.test(man) && /axioms: \[propext, Quot.sound\]/.test(man),
    "formalization.yaml has every required section, sorry_count 0 and the axioms the audit found");
  ok(decls.length === THEOREMS.length && decls.every(([, d, st]) => THEOREMS.includes(d) && pinned.includes(`example : ${st.slice(6)} := ${d.slice(6)}`)), `every main result in the manifest is a pinned theorem with its stated type (${decls.length})`);

  console.log("Differential: Lean definitions against the running code");
  const O = require("../modules/work/overlap"), E = require("../packages/si-elements"), Sim = require("../modules/work/sim");
  const r = Sim.rng(4253), pick = (xs) => xs[Math.floor(r() * xs.length)];
  const SEG = ["modules", "sample", "sam", "samples", "work", "a", "b"], gp = () => { const p = Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(SEG)).join("/"), k = r(); return k < 0.25 ? `${p}/` : k < 0.35 ? `${p}/**` : `${p}${pick([".js", ".md"])}`; };
  const L = (s) => JSON.stringify(s), list = (xs, f = L) => `[${xs.map(f).join(", ")}]`;
  // Paths
  const pairs = Array.from({ length: 400 }, () => [gp(), gp()]); pairs.push(["", ""], ["a.js", "a.js"], ["x/", "x/"], ["x/**", "x/y/z.md"]);
  // Claims: sequences of attempted claims; JS admits with O.check (no items, no shared documents), Lean with admit.
  const actors = ["agent:a", "agent:b", "person:c"], seqs = Array.from({ length: 120 }, () => Array.from({ length: 2 + Math.floor(r() * 8) }, () => ({ task: pick(["t1", "t2", "t3", "t4"]), actor: pick(actors), files: Array.from({ length: Math.floor(r() * 3) }, gp) })));
  const jsAdmit = (seq) => { const live = []; for (const c of seq) { const k = O.check({ task: c.task, files: c.files, actor: c.actor }, { claims: live }); if (k.ok) live.unshift({ ...c, files: k.files }); } return live.length; };
  const leanClaim = (c) => `⟨${L(c.task)}, ${L(c.actor)}, ${list(c.files)}⟩`;
  // Saves: the real artifact store, expectVersion on each save.
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "si-coord-db-")); process.env.SITE_PROFILE = "extended"; process.env.FETCH_MINUTES = "0"; delete process.env.DATABASE_URL;
  const db = require("../lib/db"); await db.ready(); await db.exec("CREATE TABLE IF NOT EXISTS data_artifacts (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, akey TEXT NOT NULL, title TEXT DEFAULT '', current_version INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT, UNIQUE (kind, akey)); CREATE TABLE IF NOT EXISTS data_artifact_versions (artifact_id INTEGER NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL, files TEXT DEFAULT '[]', note TEXT DEFAULT '', actor_id INTEGER, at TEXT, PRIMARY KEY (artifact_id, version));");
  const A = require("../modules/data/artifacts").artifacts(db), saveSeqs = [];
  for (let s = 0; s < 60; s++) {
    const key = `sample-${s}`; await A.save("sample", key, { body: { n: 0 } }); // version 1
    const start = 1 + Math.floor(r() * 3); for (let v = 1; v < start; v++) await A.save("sample", key, { body: { v } });
    const es = Array.from({ length: Math.floor(r() * 7) }, () => start + Math.floor(r() * 3) - (r() < 0.6 ? 0 : 1)), out = [];
    let landed = 0; for (const e of es) { try { await A.save("sample", key, { body: { e }, expectVersion: e }); landed++; } catch (x) { if (x.status !== 409) throw x; } }
    saveSeqs.push({ start, es, js: [(await A.get("sample", key)).current, landed] }); void out;
  }
  // Keys: checkRows on a one-column primary key.
  const keyLists = Array.from({ length: 150 }, () => Array.from({ length: Math.floor(r() * 6) }, () => pick(["a", "b", "c", "d", "e", "f", "g"])));
  const jsNoDup = (ks) => E.checkRows({ id: "table:sample", kind: "table", properties: { k: { type: "string" } }, keys: { primary: ["k"] } }, ks.map((k) => ({ k }))).length === 0;
  // DAG witnesses: the load order the catalog computes, checked by Lean's orderWitness.
  const graphs = Array.from({ length: 80 }, () => { const n = 2 + Math.floor(r() * 6), ds = Array.from({ length: n }, (_, i) => ({ id: `table:t${i}`, kind: "table", relationships: [] })); for (let e = 0; e < n + 2; e++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) ds[a].relationships.push({ rel: "ref", target: `table:t${b}`, direction: "out" }); } return ds; });
  const witness = graphs.map((ds) => { const g = E.dag(ds), load = [...g.order].reverse(), pos = (id) => load.indexOf(id); return { isDag: g.isDag, edges: g.edges.filter((e) => e.known).map((e) => [Number(e.to.slice(7)), Number(e.from.slice(7))]), pos: ds.map((d) => (g.isDag ? pos(d.id) : 0)) }; });

  const ev = path.join(dir, "Evaluate.lean");
  const lines = [...pairs.map(([a, b]) => `  IO.println (toString (overlap ${L(a)} ${L(b)}))`),
    ...seqs.map((s) => `  IO.println (toString (admitAll [] ${list(s, leanClaim)}).length)`),
    ...saveSeqs.map((s) => `  IO.println (toString (runSaves ${s.start} ${list(s.es, String)}))`),
    ...keyLists.map((k) => `  IO.println (toString (noDup ${list(k)}))`),
    ...witness.filter((w) => w.isDag).map((w) => `  IO.println (toString (orderWitness ${list(w.edges, (e) => `(${e[0]}, ${e[1]})`)} (posOf ${list(w.pos, String)})))`)];
  const parts = []; for (let k = 0; k < lines.length; k += 40) parts.push(`def part${parts.length} : IO Unit := do\n${lines.slice(k, k + 40).join("\n")}`);
  fs.writeFileSync(ev, [`import Coordination`, `open Coord`, `set_option maxRecDepth 20000`, `def admitAll (cs : List Claim) : List Claim → List Claim | [] => cs | c :: rest => admitAll (admit cs c) rest`,
    `def posOf (ps : List Nat) (i : Nat) : Nat := ps.getD i 0`, ...parts, `def main : IO Unit := do\n${parts.map((_, k) => `  part${k}`).join("\n")}`].join("\n") + "\n");
  const out = run(["env", "lean", "--run", ev]).trim().split("\n"); let i = 0;
  const pathOk = pairs.filter(([a, b]) => String(O.pathsOverlap(a, b)) === out[i++]).length;
  ok(pathOk === pairs.length, `path overlap: Lean and overlap.js agree on ${pathOk}/${pairs.length} pairs`);
  const claimOk = seqs.filter((s) => String(jsAdmit(s)) === out[i++]).length;
  ok(claimOk === seqs.length, `claims: Lean's admit and the code's check admit the same claims in ${claimOk}/${seqs.length} sequences (so admit_safe covers what the code does)`);
  const saveOk = saveSeqs.filter((s) => out[i++] === `(${s.js[0]}, ${s.js[1]})`).length;
  ok(saveOk === saveSeqs.length, `saves: Lean's runSaves and the real artifact store end on the same version with the same number landed in ${saveOk}/${saveSeqs.length} sequences`);
  const keyOk = keyLists.filter((k) => String(jsNoDup(k)) === out[i++]).length;
  ok(keyOk === keyLists.length, `keys: Lean's noDup and checkRows agree on ${keyOk}/${keyLists.length} key lists (noDup_sound: no problem reported exactly when the keys are distinct)`);
  const dags = witness.filter((w) => w.isDag), witOk = dags.filter(() => out[i++] === "true").length;
  ok(witOk === dags.length && dags.length > 20, `DAG: every load order the catalog computes passes Lean's orderWitness (${witOk}/${dags.length}), so by witness_acyclic it proves the relations acyclic`);
  ok(i === out.length, "every Lean answer was compared");
  if (db.end) await db.end();
  console.log(`\ncoordination lean: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
