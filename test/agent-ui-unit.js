#!/usr/bin/env node
// packages/agent-ui: every component renders on the server (no window access at import or render), carries its ARIA
// roles and labels, and the registry lists every component file. Sample data only.
const path = require("node:path"), fs = require("node:fs"), esbuild = require("esbuild");
const root = path.join(__dirname, "..", "packages", "agent-ui");
const code = esbuild.buildSync({ entryPoints: [path.join(root, "registry", "agent-ui", "index.ts")], bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic", external: ["react", "react-dom"] }).outputFiles[0].text;
const m = { exports: {} }; new Function("module", "exports", "require", code)(m, m.exports, require); const A = m.exports;
const React = require("react"), { renderToString } = require("react-dom/server");
let pass = 0, fail = 0; const ok = (c, msg) => { c ? pass++ : fail++; console.log(c ? "  ✓" : "  ✗", msg); };
const h = (C, p) => renderToString(React.createElement(C, p)).replace(/<!-- -->/g, "");
const t = Date.now() - 60000;
const trail = h(A.AgentTrail, { task: "Sample task (test data)", steps: [{ id: "a", label: "Sample done", status: "done", startedAt: t, endedAt: t + 5000 }, { id: "b", label: "Sample running", status: "running", startedAt: t, doing: "working" }, { id: "c", label: "Sample wait", status: "waiting", ask: "OK?" }], onApprove() {} });
ok(/aria-current="step"/.test(trail) && /1\/3/.test(trail) && /Approve/.test(trail) && /role="status"/.test(trail), "AgentTrail: active step marked, progress count, approval action, live region");
const plan = h(A.AgentPlan, { steps: [{ id: "1", label: "Sample one" }, { id: "2", label: "Sample two" }], onChange() {}, onRun() {} });
ok(/Run 2 steps/.test(plan) && /aria-label="Step 1: Sample one, Not started"/.test(plan) && /draggable="true"/.test(plan), "AgentPlan: labelled steps, draggable, run button");
ok(!/draggable="true"/.test(h(A.AgentPlan, { steps: [{ id: "1", label: "Sample", status: "running" }], onChange() {}, running: true })), "AgentPlan: editing locks while running");
const gates = h(A.ApprovalGates, { requests: [{ id: "r", agent: "Sample agent", action: "Sample action", risk: "high", args: { a: 1 } }, { id: "s", agent: "Sample", action: "Second sample", risk: "low" }], onDecide() {} });
ok(/high risk/.test(gates) && /2 waiting/.test(gates) && /Edit first/.test(gates) && /Next: Second sample/.test(gates), "ApprovalGates: risk, count, edit, next in line");
const inbox = h(A.AgentInbox, { tasks: [{ id: "x", title: "Sample done", agent: "s", status: "done", updatedAt: t }, { id: "y", title: "Sample needs", agent: "s", status: "waiting", updatedAt: t }] });
ok(/role="tablist"/.test(inbox) && inbox.indexOf("Sample needs") < inbox.indexOf("Sample done") && /tabindex="0"/.test(inbox), "AgentInbox: tabs, needs-you first, one tab stop");
const away = h(A.AwaySummary, { since: t - 3600000, items: [{ id: "n", title: "Sample", kind: "needs" }, { id: "d", title: "Sample done", kind: "done" }] });
ok(/1 needs you/.test(away) && !/Failed/.test(away), "AwaySummary: leads with what needs you and leaves out empty groups");
const ans = h(A.AIAnswer, { answer: "Sample claim [1] and an unsourced one [3]. <b>not html</b>", sources: [{ id: 1, title: "Sample source", url: "https://example.org/a" }] });
ok(/aui-cite is-missing/.test(ans) && /role="tooltip"/.test(ans) && /&lt;b&gt;not html/.test(ans), "AIAnswer: resolved and unresolved citations, previews, model text never rendered as HTML");
const reg = JSON.parse(fs.readFileSync(path.join(root, "registry.json"), "utf8"));
const files = reg.items.flatMap((i) => i.files.map((f) => f.path));
ok(files.every((f) => fs.existsSync(path.join(root, f))) && fs.readdirSync(path.join(root, "registry", "agent-ui")).filter((f) => f.endsWith(".tsx")).every((f) => files.includes(`registry/agent-ui/${f}`)), "registry.json lists every component file and each exists");
console.log(`\nagent-ui unit: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
