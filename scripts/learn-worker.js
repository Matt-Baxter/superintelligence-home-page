#!/usr/bin/env node
// Learn studio worker: does the queued background jobs off the web server, so the free tier never pays for them.
// Runs once and exits (no polling). Run it by hand, from a daily scheduled job, or let an agent run it.
//
//   node scripts/learn-worker.js                 do every queued job once
//   node scripts/learn-worker.js recheck <id>     audit one historical done Lean job
//   node scripts/learn-worker.js list            show the queue
//   node scripts/learn-worker.js complete <id> <file> [--failed]   record an agent's result (Markdown/text file)
//
// Environment: the same DATABASE_URL / DATA_DIR as the server. For videos, BASE (a running site, default
// http://localhost:3000) is recorded with Playwright; ffmpeg converts to MP4 and manim renders the Manim scene when installed.
// LEAN (path to the lean binary) checks proofs. Files go to out/learn/<job id>/ (gitignored). Nothing is posted anywhere.
const fs = require("node:fs"), path = require("node:path"), { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");
const db = require("../lib/db");
const { createKernel } = require("../kernel/kernel");
const L = require("../modules/learn/learn");

const OUT = process.env.LEARN_OUT || path.join(root, "out", "learn");
const iso = () => new Date().toISOString();
const has = (cmd, args = ["--version"]) => { try { execFileSync(cmd, args, { stdio: "ignore", timeout: 60000 }); return true; } catch { return false; } };

async function save(job, fields) {
  const f = { status: job.status, output: job.output || "", files: JSON.stringify(job.files || []), error: job.error || "", ...fields };
  await db.run("UPDATE learn_jobs SET status = ?, output = ?, files = ?, error = ?, updated_at = ? WHERE id = ?", f.status, f.output, f.files, f.error, iso(), job.id);
}

const AGENT_BRIEF = {
  explain: "Read the linked paper or story and write a plain-language explainer: one-paragraph summary, an analogy, what is new, what is still uncertain, and which Learn concepts it touches (ids from modules/learn/data/concepts.json).",
  "paper-to-code": "Turn the paper's core method into a small, runnable, commented implementation (Python or JavaScript) with a toy example on synthetic data, plus a README saying what is and isn't reproduced.",
  "reverse-engineer": "Work out how the named system or result most likely works from public material: inputs, mechanism, outputs, evidence for each claim, and open questions. Mark guesses as guesses.",
};

// Record an explainer page (the /m/explainer player) to WebM with Playwright, and to MP4 when ffmpeg is installed.
async function record(pagePath, dir, job, files) {
  try {
    const { chromium } = require("playwright");
    const base = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir, size: { width: 1280, height: 720 } } });
    const page = await ctx.newPage();
    await page.goto(`${base}${pagePath}`);
    const secs = await page.waitForFunction(() => window.__explainerSeconds, null, { timeout: 15000 }).then((h) => h.jsonValue());
    await page.waitForFunction(() => window.__explainerDone === true, null, { timeout: (secs + 15) * 1000 });
    await page.waitForTimeout(800);
    const v = page.video(); await ctx.close(); await browser.close();
    const webm = path.join(dir, "explainer.webm"); fs.renameSync(await v.path(), webm); files.push(`out/learn/${job.id}/explainer.webm`);
    if (has("ffmpeg", ["-version"])) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(dir, "explainer.mp4")], { timeout: 300000 });
      files.push(`out/learn/${job.id}/explainer.mp4`); return `Recorded the browser explainer (${secs}s) to MP4.`;
    }
    return `Recorded the browser explainer (${secs}s) to WebM; install ffmpeg for MP4.`;
  } catch (e) { return `Browser recording skipped: ${String(e.message).split("\n")[0]}`; }
}

async function runJob(job, opts) {
  const jobDir = path.join(OUT, String(job.id));
  fs.mkdirSync(jobDir, { recursive: true });
  const dir = opts.recheck ? fs.mkdtempSync(path.join(jobDir, "recheck-")) : jobDir;
  const artifactPrefix = `out/learn/${path.relative(OUT, dir).split(path.sep).join("/")}`;
  const files = [], put = (name, text) => { fs.writeFileSync(path.join(dir, name), text); files.push(`${artifactPrefix}/${name}`); };
  const c = job.concept_id && L.BY_ID[job.concept_id];

  if (job.kind === "post") {
    if (!c) throw new Error("A blog draft needs a concept.");
    const rows = await db.all("SELECT id, title, url, summary FROM stories WHERE COALESCE(in_scope, 1) = 1 ORDER BY id DESC LIMIT 400");
    const stories = rows.filter((s) => L.conceptsIn(`${s.title}\n${s.summary || ""}`).some((x) => x.id === c.id));
    const draft = L.postDraft(c.id, stories);
    put("post.md", draft);
    put("social.md", L.socialDrafts(c.id).map((d) => `## ${d.channel}\n\n${d.text}\n`).join("\n") + "\n(Drafts for a person to post. No Twitter/X.)\n");
    return { status: "done", output: draft, files };
  }

  // A topic dossier (modules/review/dossier.js): the traced analysis, its blog draft and posts, and the explainer video.
  if (job.kind === "dossier") {
    const topic = (String(job.note || "").match(/topic:([a-z0-9-]+)/) || [])[1]; if (!topic) throw new Error("A dossier needs topic:<id> in its note.");
    const D = require("../modules/review/dossier"), Lab = require("../modules/lab/lab"), pre = require("../modules/lab/results.json").results;
    const concepts = require("../modules/learn/data/concepts.json").concepts;
    const d = D.analyse(await D.gather(db, topic), { examples: Lab.EX.examples.filter((e) => pre[e.id]).map((e) => ({ ...e, verdict: pre[e.id].verdict })), concepts });
    const site = (process.env.SITE_URL || process.env.BASE || "").replace(/\/$/, ""), link = site ? `${site}/m/dossier#${topic}` : "";
    const blog = D.blog(d, site); put("post.md", blog);
    put("social.md", D.posts(d, link).map((x) => `## ${x.channel}\n\n${x.text}\n`).join("\n") + "\n(Drafts for a person to post. No Twitter/X.)\n");
    put("dossier.json", JSON.stringify(d, null, 2)); put("storyboard.json", JSON.stringify(D.storyboard(d), null, 2));
    const notes = [`Evidence on ${d.label}: ${d.strength} (${d.why}); ${d.refs.length} traced references.`];
    if (!opts.noVideo) notes.push(await record(`/m/explainer?d=${encodeURIComponent(topic)}&record=1`, dir, job, files));
    notes.push("Review the drafts, then publish them yourself: nothing is posted automatically.");
    return { status: "done", output: `${notes.join("\n")}\n\n${blog}`, files };
  }

  if (job.kind === "video") {
    if (!c) throw new Error("A video needs a concept.");
    const sb = L.storyboard(c.id), scene = L.manimScene(c.id), notes = [];
    put("storyboard.json", JSON.stringify(sb, null, 2));
    put(scene.file, scene.source);
    put("narration.txt", sb.scenes.map((s) => s.text ? `${s.text}${s.why ? " " + s.why : ""}` : `${s.center}: ${s.nodes.map((n) => n.name).join(", ")}`).join("\n\n") + "\n");
    // 1) Record the browser explainer (always available where Playwright is).
    if (!opts.noVideo) notes.push(await record(`/m/explainer?c=${encodeURIComponent(c.id)}&record=1`, dir, job, files));
    // 2) Render the Manim scene when Manim is installed (pip install manim).
    if (has("manim")) {
      try { execFileSync("manim", ["-qm", "--media_dir", path.join(dir, "manim"), path.join(dir, scene.file), scene.className], { timeout: 900000, stdio: "ignore" }); notes.push("Rendered the Manim scene (out/learn/<id>/manim)."); }
      catch (e) { notes.push(`Manim render failed: ${String(e.message).split("\n")[0]}`); }
    } else notes.push(`Manim isn't installed here; render with: manim -qm ${scene.file} ${scene.className}`);
    notes.push("Upload the video yourself (YouTube, LinkedIn, Bluesky, Substack): nothing is posted automatically.");
    return { status: "done", output: notes.join("\n"), files };
  }

  if (job.kind === "lean-proof") {
    fs.rmSync(path.join(dir, "proof-audit.json"), { force: true });
    const lf = c && L.leanFile(c.id); if (!lf) throw new Error("That concept has no formal statement.");
    put(lf.file, lf.source);
    const lean = process.env.LEAN || (has("lean") ? "lean" : null);
    const sorry = /\bsorry\b/.test(lf.source);
    if (lf.needs || sorry) return { status: "needs-agent", output: `Proof still to do${lf.needs ? ` (needs ${lf.needs})` : ""}. Review the proof and its dependencies before adding it to the curated worker inputs.`, files };
    if (!lean) return { status: "needs-agent", output: "Lean isn't installed here. Install Lean 4 (elan) or set LEAN, then run the worker again.", files };
    // These are controlled Learn sources, not arbitrary uploaded Lean programs.
    const theorems = [...lf.source.matchAll(/^theorem ([A-Za-z_]\w*)\b/gm)].map(m => m[1]);
    const auditName = "proof-audit.lean";
    try {
      const result = require("../lib/lean-proof").checkSource({lean, source:lf.source, theorems, auditFile:path.join(dir, auditName)});
      files.push(`${artifactPrefix}/${auditName}`);
      put("proof-audit.json", JSON.stringify({toolVersion:result.toolVersion, sourceSha256:result.sourceSha256, theorems:result.theorems, footprints:result.footprints, allowedAxioms:result.allowedAxioms}, null, 2));
      return { status: "done", output: `Checked with ${path.basename(lean)}: the proof is accepted. ${theorems.length} theorem(s) audited; only standard axioms allowed.`, files };
    }
    catch (e) { return { status: "failed", output: "", error: String(e.stdout || e.stderr || e.message).slice(0, 2000), files }; }
  }

  if (AGENT_BRIEF[job.kind]) {
    const brief = [`Job #${job.id}: ${L.JOB_KINDS.find((k) => k.id === job.kind).label}`, "", AGENT_BRIEF[job.kind], "",
      job.note ? `Request: ${job.note}` : "", c ? `Concept: ${c.name} (${c.id})` : "", job.story_id ? `Story id: ${job.story_id}` : "", "",
      "Rules: no paid API calls by default; never attribute claims or quotes to real people; test data is synthetic and labelled; no Twitter/X.",
      `When finished: node scripts/learn-worker.js complete ${job.id} <result.md>`].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
    put("brief.md", brief + "\n");
    return { status: "needs-agent", output: brief, files };
  }
  throw new Error(`Unknown job kind ${job.kind}`);
}

async function main() {
  const kernel = createKernel();
  db.extend({ sql: kernel.store.schema.join("\n"), columns: kernel.store.columns });
  await db.ready();
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "list") {
    const rows = await db.all("SELECT id, kind, concept_id, status, updated_at FROM learn_jobs ORDER BY id DESC LIMIT 50");
    for (const r of rows) console.log(`#${r.id}\t${r.status}\t${r.kind}\t${r.concept_id || ""}`);
    if (!rows.length) console.log("No jobs.");
    return;
  }
  if (cmd === "recheck") {
    if (args.length !== 1 || !/^[1-9][0-9]*$/.test(args[0])) throw new Error("Usage: recheck <done Lean job id>");
    const job = await db.get("SELECT * FROM learn_jobs WHERE id = ?", Number(args[0]));
    if (!job || job.kind !== "lean-proof" || job.status !== "done") throw new Error("Choose a done Lean proof job.");
    const proof = L.leanFile(job.concept_id);
    const prefix = `out/learn/${job.id}/`;
    let refs;
    try { refs = JSON.parse(job.files || "[]"); } catch { refs = []; }
    const sourceMatches = (() => {
      if (!proof || !Array.isArray(refs) || ![1, 3].includes(refs.length)) return false;
      const [source, ...audit] = refs;
      if (typeof source !== "string" || !source.startsWith(prefix)) return false;
      const parts = source.slice(prefix.length).split("/");
      if (parts.pop() !== proof.file || parts.length > 1 || parts.some(p => !/^recheck-[A-Za-z0-9]+$/.test(p))) return false;
      const sourceDir = source.slice(0, source.lastIndexOf("/") + 1);
      if (audit.length && (audit[0] !== sourceDir + "proof-audit.lean" || audit[1] !== sourceDir + "proof-audit.json")) return false;
      const file = path.join(OUT, String(job.id), ...parts, proof.file);
      const stat = fs.lstatSync(file, { throwIfNoEntry: false });
      return stat?.isFile() && stat.size === Buffer.byteLength(proof.source)
        && fs.readFileSync(file).equals(Buffer.from(proof.source));
    })();
    let result;
    if (sourceMatches) {
      if (!has(process.env.LEAN || "lean")) throw new Error("Lean is unavailable. The historical record was left for review.");
      result = await runJob(job, { recheck: true });
    } else {
      result = { status: "needs-agent", output: "Historical proof evidence is missing, ambiguous, or differs from the curated statement. Review the original before retrying.", files: [] };
    }
    const updated = await db.run(
      "UPDATE learn_jobs SET status = ?, output = ?, files = ?, error = ?, updated_at = ? WHERE id = ? AND kind = 'lean-proof' AND status = 'done' AND updated_at = ? AND files = ? AND output = ?",
      result.status, result.output || "", JSON.stringify(result.files), result.error || "", iso(),
      job.id, job.updated_at, job.files, job.output
    );
    if (updated.changes !== 1) throw new Error("Job changed during recheck. Review the current record before retrying.");
    console.log(`Proof recheck #${job.id}: ${result.status}.`);
    return;
  }
  if (cmd === "complete") {
    const [id, file] = args; if (!id || !file) throw new Error("Usage: complete <id> <file> [--failed]");
    const job = await db.get("SELECT * FROM learn_jobs WHERE id = ?", Number(id)); if (!job) throw new Error(`No job #${id}`);
    const failed = args.includes("--failed");
    const proof = job.kind === "lean-proof";
    if (proof && !failed) throw new Error("Lean proof completion requires the audited worker.");
    const text = fs.readFileSync(file, "utf8").slice(0, 60000);
    await save(job, { status: failed ? "failed" : "done", output: failed ? (proof ? "" : job.output) : text, error: failed ? text.slice(0, 2000) : "", files: JSON.stringify(proof ? [file] : [...JSON.parse(job.files || "[]"), file]) });
    console.log(`Job #${id} recorded as ${failed ? "failed" : "done"}.`);
    return;
  }
  const jobs = await db.all("SELECT * FROM learn_jobs WHERE status = 'queued' ORDER BY id LIMIT 20");
  if (!jobs.length) { console.log("learn worker: no queued jobs"); return; }
  const tally = {};
  for (const job of jobs) {
    job.files = JSON.parse(job.files || "[]");
    await save(job, { status: "running" });
    let r; try { r = await runJob(job, { noVideo: args.includes("--no-video") }); } catch (e) { r = { status: "failed", error: String(e.message || e).slice(0, 2000), output: "" }; }
    await save(job, { status: r.status, output: r.output || "", error: r.error || "", files: JSON.stringify(r.files || []) });
    tally[r.status] = (tally[r.status] || 0) + 1;
    console.log(`#${job.id} ${job.kind} ${job.concept_id || ""} -> ${r.status}${r.error ? ": " + r.error.split("\n")[0] : ""}`);
  }
  console.log(`learn worker: ${jobs.length} job(s): ${Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(", ")}`);
}
main().then(() => process.exit(0), (e) => { console.error("learn worker:", e.message); process.exit(1); });
