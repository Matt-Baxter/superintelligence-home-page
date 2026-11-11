#!/usr/bin/env node
// Paper responses from the command line (REQ-056..058, proposed). Reads each paper in full, analyses it, writes the
// plan, article and posts, and (with --render) narrates and renders the explainer video. $0: everything runs here.
//
//   npm run respond -- 2611.10787                     arXiv id or link (HTML first, PDF fallback; cached in out/papers)
//   npm run respond -- paper.pdf --title "..." --url https://...    a local PDF, HTML or text file
//   npm run respond -- 2611.10787 2611.10261 --render       several papers; --render needs Manim (pip install manim)
//   options: --render, --learn (fold measured lengths into the planner), --quality l|m|h (default m), --offline (cache only),
//            --out <dir> (default out/response/<slug>)
// Voice: Piper when PIPER_MODEL points at a voice file, else espeak-ng, else captions only. Nothing is posted.
const path = require("node:path");
const { respond } = require("../modules/responses/respond");
const args = process.argv.slice(2), flag = (f) => args.includes(f), val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const skip = new Set(["--title", "--url", "--quality", "--out"].flatMap((f) => { const i = args.indexOf(f); return i >= 0 ? [i, i + 1] : []; }));
const inputs = args.filter((a, i) => !a.startsWith("--") && !skip.has(i));
if (!inputs.length) { console.log("Usage: npm run respond -- <arXiv id | link | file> [...] [--render] [--quality l|m|h] [--offline]"); process.exit(1); }
if (val("--quality")) process.env.RESPONSE_QUALITY = val("--quality");
(async () => {
  let failed = 0;
  for (const input of inputs) {
    try {
      const meta = { ...(val("--title") ? { title: val("--title") } : {}), ...(val("--url") ? { url: val("--url") } : {}) };
      const probe = await respond(input, { meta, offline: flag("--offline") });
      const out = val("--out") && inputs.length === 1 ? val("--out") : path.join("out", "response", probe.slug);
      const t0 = Date.now();
      const p = await respond(input, { meta, out, render: flag("--render"), offline: true, site: (process.env.SITE_URL || "").replace(/\/$/, ""), log: (m) => console.log(`  ${m}`) });
      console.log(`${p.slug}: ${p.analysis.summary}`);
      for (const c of p.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}: ${c.why}`);
      for (const n of p.video.notes) console.log(`  ${n}`);
      if (flag("--render")) {
        // Quality checks on the render, each guarding a learning in modules/responses/learnings.json.
        const qa = require("../modules/responses/qa"), res = qa.run(out);
        for (const r of res) console.log(`  ${r.skip ? "-" : r.ok ? "✓" : "✗"} qa ${r.id}: ${r.skip || r.why}`);
        if (flag("--learn")) { qa.calibrate(out); console.log("  learned: measured beat lengths folded into modules/lab/production-calibration.json"); }
      }
      console.log(`  -> ${out}/ (plan.md, article.md, social.md, scene.py, captions.srt${p.video.files.includes("video.mp4") ? ", video.mp4" : ""}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) { failed++; console.error(`${input}: ${e.message}`); }
  }
  process.exit(failed ? 1 : 0);
})();
