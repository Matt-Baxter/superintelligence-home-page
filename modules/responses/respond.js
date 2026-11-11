// One response package per paper (REQ-056..058, proposed): read -> analyse -> plan -> video -> article and posts.
// Used by scripts/respond.js, the Learn worker's "response" job and the admin route; the web server only ever builds
// the text parts (no rendering on the free tier).
const fs = require("node:fs"), path = require("node:path");
const Prod = require("../lab/production"), reader = require("./reader"), { analyse } = require("./analysis"), { plan, check } = require("./plan"), video = require("./video"), write = require("./write");

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
  const offer = offering(p.search.situation);
  const link = site ? `${site}/m/responses?r=${encodeURIComponent(p.slug)}` : "";
  const art = write.article(a, p, { example, site }), social = write.posts(a, p, link);
  // What re-planning needs from the paper later (the builder's replan action): the method and theory sections and
  // the tables, not the whole text.
  const planInput = { sections: doc.sections.filter((x) => x.kind === "method" || x.kind === "theory").map((x) => ({ heading: x.heading, kind: x.kind, text: x.text.slice(0, 20000) })), tables: doc.tables.slice(0, 6) };
  const pkg = { slug: p.slug, title: a.title, url: a.url, at: new Date().toISOString().slice(0, 10), analysis: a, plan: p, checks, offer, article: art, posts: social, storyboard: video.playerStoryboard(p), video: null, planInput };
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    const put = (f, s) => fs.writeFileSync(path.join(out, f), s);
    put("paper.json", JSON.stringify(doc, null, 2)); put("analysis.json", JSON.stringify(a, null, 2));
    put("plan.md", planMd(p, checks, offer)); put("article.md", art);
    put("social.md", social.map((s) => `## ${s.channel}${s.limit ? ` (${s.length}/${s.limit})` : ""}\n\n${s.text}\n`).join("\n") + "\n(Drafts for a person to post. No Twitter/X.)\n");
    pkg.video = video.build(p, out, { render, log });
    put("plan.md", planMd(p, checks, offer)); // again, with the measured line timings
    pkg.storyboard = video.playerStoryboard(p); // beats may have stretched to fit the narration
    put("package.json", JSON.stringify({ ...pkg, article: undefined }, null, 2));
  }
  return pkg;
}

// What to make for this paper and where, from the Q-learner trained in the channel model (simulation; trained once
// per process, about a third of a second).
const LEARNED = new Map(); // per budget
function offering(situation, budget = Prod.SIM.budgetCpuSecondsPerWeek) {
  if (!LEARNED.has(budget)) LEARNED.set(budget, Prod.policyTable(Prod.qlearn({ budget, seed: 7 }).Q));
  // The learner works on coarse classes ("partial+visual"), not full situation keys (review fix: the lookup by full
  // key never matched, so every plan said "undefined").
  const row = LEARNED.get(budget).find((x) => x.situation === Prod.classOf(situation)) || {};
  return { situation, class: Prod.classOf(situation), budget, ...row, situation_class: row.situation, note: "Learned by Q-learning in a synthetic channel model (modules/lab/production.js): reach x engagement - compute - a trust penalty for overselling thin papers. A suggestion for a person, not audience data." };
}

// Re-plan a stored package (a different length limit, or after edits to the analysis) without re-reading the paper.
function rebuild(pkg, { maxSeconds = 90, site = "" } = {}) {
  const doc = { sections: (pkg.planInput && pkg.planInput.sections) || [], tables: (pkg.planInput && pkg.planInput.tables) || [] };
  const example = labFor(pkg.url), a = pkg.analysis;
  const p = plan(a, doc, { example, maxSeconds }), checks = check(p, a, { example });
  const link = site ? `${site}/m/responses?r=${encodeURIComponent(p.slug)}` : "";
  return { ...pkg, plan: p, checks, offer: offering(p.search.situation), article: write.article(a, p, { example, site }), posts: write.posts(a, p, link), storyboard: video.playerStoryboard(p), video: null, qa: null };
}

function planMd(p, checks, offer) {
  return [`# Plan: ${p.title}`, "", `**Thesis:** ${p.thesis}`, "", `**Audience:** ${p.audience}`, "", `**Budget:** about ${Math.round(p.budget.targetSeconds)} s; ${p.budget.cost}.`, "",
    `**Situation:** ${p.search.situation}. **Beats chosen by A*:** ${p.search.chosen.join(" → ")} (${p.search.expanded} nodes; model viewers still watching at the end: ${Math.round(p.search.modelStay * 100)}%). ${p.search.note}`, "",
    ...(offer ? [`**Suggested offering:** ${offer.offering}, ${offer.voice === "none" ? "no video" : `${offer.voice} voice`}, on ${offer.channel}. ${offer.note}`, ""] : []),
    "## Beats", "", "| # | Beat | Variant | Goal | Visual | Seconds |", "| --- | --- | --- | --- | --- | --- |", ...p.beats.map((b, i) => `| ${i + 1} | ${b.id} | ${b.variant} | ${b.goal} | ${b.visual.kind} | ${b.seconds} |`), "",
    ...p.beats.flatMap((b, i) => [`### ${i + 1}. ${b.id} (${b.variant})`, "", ...b.lines.map((l, j) => `- ${b.slots ? `${b.slots[j]} s · ` : ""}${l.cue === null ? "" : `cue ${l.cue} · `}${l.text}`), ""]),
    "## Acceptance", "", ...p.acceptance.map((x) => { const c = checks.find((y) => y.id === x.id); return `- [${c ? (c.ok ? "x" : " ") : " "}] ${x.rule}${c ? ` (${c.why})` : " (a person checks)"}`; }), ""].join("\n");
}

module.exports = { respond, labFor, planMd, offering };
module.exports.rebuild = rebuild;
