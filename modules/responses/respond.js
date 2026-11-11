// One response package per paper (REQ-056..058, proposed): read -> analyse -> plan -> video -> article and posts.
// Used by scripts/respond.js, the Learn worker's "response" job and the admin route; the web server only ever builds
// the text parts (no rendering on the free tier).
const fs = require("node:fs"), path = require("node:path");
const reader = require("./reader"), { analyse } = require("./analysis"), { plan, check } = require("./plan"), video = require("./video"), write = require("./write");

// The Lab example whose source is this paper, with its precomputed verdict and series (modules/lab/results.json).
function labFor(url) {
  if (!url) return null;
  try {
    const L = require("../lab/lab"), pre = require("../lab/results.json").results, id = (String(url).match(/\d{4}\.\d{4,5}/) || [])[0];
    const e = L.EX.examples.find((x) => x.source && id && x.source.url.includes(id)); if (!e) return null;
    const r = pre[e.id] || L.runExample(e.id);
    const series = [...((r.baseline && r.baseline.series) || []).slice(0, 1).map((s) => ({ ...s, name: `${s.name} (reproduction)` })), ...((r.variant && r.variant.series) || []).slice(0, 1).map((s) => ({ ...s, name: `${s.name} (our hypothesis)` }))];
    return { id: e.id, title: e.title, idea: e.idea, verdict: r.verdict || null, series };
  } catch { return null; }
}

async function respond(input, { meta = {}, out = null, render = false, site = "", offline = false, log = () => {} } = {}) {
  const doc = typeof input === "object" && input.sections ? input : await reader.read(input, { meta, offline });
  const example = labFor(doc.url);
  const a = analyse(doc, { example });
  const p = plan(a, doc, { example });
  const checks = check(p, a, { example });
  const link = site ? `${site}/m/responses?r=${encodeURIComponent(p.slug)}` : "";
  const art = write.article(a, p, { example, site }), social = write.posts(a, p, link);
  const pkg = { slug: p.slug, title: a.title, url: a.url, at: new Date().toISOString().slice(0, 10), analysis: a, plan: p, checks, article: art, posts: social, storyboard: video.playerStoryboard(p), video: null };
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    const put = (f, s) => fs.writeFileSync(path.join(out, f), s);
    put("paper.json", JSON.stringify(doc, null, 2)); put("analysis.json", JSON.stringify(a, null, 2));
    put("plan.md", planMd(p, checks)); put("article.md", art);
    put("social.md", social.map((s) => `## ${s.channel}${s.limit ? ` (${s.length}/${s.limit})` : ""}\n\n${s.text}\n`).join("\n") + "\n(Drafts for a person to post. No Twitter/X.)\n");
    pkg.video = video.build(p, out, { render, log });
    pkg.storyboard = video.playerStoryboard(p); // beats may have stretched to fit the narration
    put("package.json", JSON.stringify({ ...pkg, article: undefined }, null, 2));
  }
  return pkg;
}

function planMd(p, checks) {
  return [`# Plan: ${p.title}`, "", `**Thesis:** ${p.thesis}`, "", `**Audience:** ${p.audience}`, "", `**Budget:** about ${Math.round(p.budget.targetSeconds)} s; ${p.budget.cost}.`, "",
    "## Beats", "", "| # | Beat | Goal | Visual | Seconds |", "| --- | --- | --- | --- | --- |", ...p.beats.map((b, i) => `| ${i + 1} | ${b.id} | ${b.goal} | ${b.visual.kind} | ${b.seconds} |`), "",
    ...p.beats.flatMap((b, i) => [`### ${i + 1}. ${b.id}`, "", `> ${b.narration}`, ""]),
    "## Acceptance", "", ...p.acceptance.map((x) => { const c = checks.find((y) => y.id === x.id); return `- [${c ? (c.ok ? "x" : " ") : " "}] ${x.rule}${c ? ` (${c.why})` : " (a person checks)"}`; }), ""].join("\n");
}

module.exports = { respond, labFor, planMd };
