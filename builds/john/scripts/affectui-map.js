#!/usr/bin/env node
// Background map of the affectUI kits (components, blocks, screens, illustrations, motion) onto our own parts:
// json-render blocks, intents (modules/lab/intent.js), decision models (Verdict/Scorecard, JEV/CLEF judges), agent
// surfaces and pages. Nothing here is shipped to readers: it is a lookup table for Studio, code mode and agents, so a
// request like "show the run as a waterfall" resolves to a known part instead of new UI.
//
//   node scripts/affectui-map.js /path/to/unzipped/affectui   -> writes docs/affectui-map.json
//
// The kits are not vendored; each entry records the file name so it can be copied in when a surface needs it.
const fs = require("node:fs"), path = require("node:path");

const INTENTS = ["build-dashboard", "analyze-media", "summarize-paper", "run-experiment", "build-app", "refuse", "clarify"];
const DECISION = ["Verdict", "Scorecard"];
const SURFACES = {
  traces: "Signed-in agent traces: a review's reasoning and the daily spot-check (/m/review, /m/evidence)",
  evidence: "Evidence and dossiers: papers, citations, verdicts (/m/evidence, /m/dossier)",
  decide: "Decisions and judges: JEV/CLEF verdicts, arena (/m/decide, /m/arena)",
  dashboard: "Metrics and briefs built by the build-dashboard intent (/brief.html, /m/view)",
  graph: "Knowledge graph and code map (/m/map, /m/knowledge, /m/codemap)",
  agents: "Agent runs and the lab (/m/lab, /m/control)",
  cost: "Cost guards: free small models daily, a larger model for periodic spot-checks (/m/admin)",
  feed: "Feed reading, votes and discussion (/, /story.html)",
  reference: "Reference only: our client surfaces stay plain HTML; copy in when a surface needs it",
};
// Ordered rules: the first that matches the asset name wins. use: "block" = json-render block (existing or proposed),
// "pattern" = page layout to follow, "reference" = not used on reader surfaces.
const RULES = [
  [/^(trace-waterfall|agent-trail|agent-ledger|agent-sequence|agent-timing|agent-checkpoints|commit-trail|diff-timeline|run-inspector|agent-run|agent-run-detail|agent-tool-calls|agent-activity|tool-call-card)$/, { surface: "traces", use: "block", block: "Trace", intent: "run-experiment" }],
  [/^(reasoning-summary|thinking-state|thinking-loader|agent-steering|change-summary|inline-diff)$/, { surface: "traces", use: "block", block: "Trace", intent: "run-experiment" }],
  [/^(cited-answer|ai-answer|response-stream|writing-assistant)$/, { surface: "evidence", use: "block", block: "Quote", intent: "summarize-paper" }],
  [/^(decision-card|decision-tree|decision-inbox|judge-bracket|approval-card|approval-gates|review-center|conflict-radar|root-cause-tree|parallel-attempts|plan-vs-actual|experiment-card|evals)$/, { surface: "decide", use: "block", block: "Verdict", decision: "Verdict", intent: "run-experiment" }],
  [/^(smart-recommendation|rating)$/, { surface: "decide", use: "block", block: "Scorecard", decision: "Scorecard" }],
  [/^(stat-card|kpi-chart|kpi-board|number-ticker)$/, { surface: "dashboard", use: "block", block: "Metric", intent: "build-dashboard" }],
  [/^(trend-chart|breakdown-chart|compact-breakdown|metrics-dashboard|analytics)$/, { surface: "dashboard", use: "block", block: "BarList", intent: "build-dashboard" }],
  [/^(data-table)$/, { surface: "dashboard", use: "block", block: "Table", intent: "build-dashboard" }],
  [/^(mission-timeline|progress-tracker)$/, { surface: "dashboard", use: "block", block: "Ladder", intent: "build-dashboard" }],
  [/^(cost-waterfall|metering-chart|usage-meter|model-usage|rate-limit-planner|model-router|model-picker|fallback-chain|autonomy-dial|agent-router|agent-usage|context-window|settings-models)$/, { surface: "cost", use: "pattern", intent: "build-dashboard" }],
  [/^(memory-graph|context-map|repo-map|agent-graph|tool-access-map|agent-overlap-map|tree-view|agent-memory)$/, { surface: "graph", use: "pattern", intent: "build-app" }],
  [/^(agent-|agents$|delegate-board|fan-out-grid|handoff-swimlanes|running-now|scheduled-runs|run-controls|permission-request|agent-permissions|agent-schedules|agent-skills|agent-tasks|agent-orchestration|workflow-builder|flow-builder|mission-control|task-board|live-session)/, { surface: "agents", use: "pattern", intent: "build-app" }],
  [/^(comment-thread|comments-panel|reaction-bar|collaboration-stream|notification-stack|away-summary)$/, { surface: "feed", use: "pattern" }],
  [/^(badge)$/, { surface: "feed", use: "block", block: "Badge" }],
  [/^(button|icon-button)$/, { surface: "feed", use: "block", block: "Button" }],
  [/^(card|project-card)$/, { surface: "feed", use: "block", block: "Card" }],
  [/^(separator)$/, { surface: "feed", use: "block", block: "Divider" }],
  [/^(tips-panel|empty-state|setup-guide)$/, { surface: "feed", use: "block", block: "Callout" }],
];
const BLOCKS_DIRS = ["modules/blocks-core/blocks", "modules/decision/blocks"];
const existingBlocks = () => new Set(BLOCKS_DIRS.flatMap((d) => { const p = path.join(__dirname, "..", d); return fs.existsSync(p) ? fs.readdirSync(p).filter((n) => !n.startsWith("_")) : []; }));

function classify(kit, name) {
  for (const [re, t] of RULES) if (re.test(name)) return { ...t };
  // Illustrations, motion and generic form primitives are decoration or inputs we already have as plain HTML.
  return { surface: "reference", use: "reference", why: kit === "motion" ? "motion is kept off reader surfaces" : kit === "illustrations" ? "decorative" : "plain HTML already covers it" };
}

function parseReadme(text) {
  const out = [];
  for (const m of text.matchAll(/^- \*\*(.+?)\*\* \(`([^`]+)\.tsx`\) – (.+)$/gm)) {
    if (/-clean$/.test(m[2])) continue;
    out.push({ title: m[1], name: m[2], summary: m[3].split(/ – |; /)[0].slice(0, 160) });
  }
  return out;
}

function build(root) {
  const have = existingBlocks(), entries = [];
  for (const kit of ["components", "blocks", "screens", "illustrations", "motion"]) {
    const readme = path.join(root, kit, `affectui-${kit}`, "README.md");
    if (!fs.existsSync(readme)) continue;
    for (const a of parseReadme(fs.readFileSync(readme, "utf8"))) {
      const t = classify(kit, a.name);
      entries.push({ kit, ...a, file: `affectui-${kit}/${a.name}.tsx`, ...t, ...(t.block ? { blockStatus: have.has(t.block) ? "existing" : "proposed" } : {}) });
    }
  }
  const count = (k) => entries.reduce((o, e) => ((o[e[k] || "none"] = (o[e[k] || "none"] || 0) + 1), o), {});
  return { generated: "scripts/affectui-map.js", intents: INTENTS, decisionModels: DECISION, surfaces: SURFACES, totals: { assets: entries.length, bySurface: count("surface"), byUse: count("use") }, entries };
}

module.exports = { build, classify, parseReadme, INTENTS, DECISION, SURFACES };
if (require.main === module) {
  const root = process.argv[2] || "/tmp/affectui";
  const map = build(root);
  if (!map.entries.length) { console.error(`no affectUI READMEs under ${root}`); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, "../docs/affectui-map.json"), JSON.stringify(map, null, 2) + "\n");
  console.log(`mapped ${map.totals.assets} assets`, map.totals.bySurface);
}
