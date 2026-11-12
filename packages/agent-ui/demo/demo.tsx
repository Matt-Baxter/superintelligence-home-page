// Demo with sample data (test data, invented tasks). Simulates an agent run so timers, statuses and announcements move.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { AgentTrail, AgentPlan, ApprovalGates, AgentInbox, AwaySummary, AIAnswer, TrailStep, PlanStep, InboxTask, Status } from "../registry/agent-ui";

const T0 = Date.now();
const min = (m: number) => T0 - m * 60000;

function TrailDemo() {
  const base: TrailStep[] = [
    { id: "a", label: "Read the three sample feeds", status: "done", startedAt: min(6), endedAt: min(5.6) },
    { id: "b", label: "Tag stories against the ontology", status: "done", startedAt: min(5.6), endedAt: min(4.9) },
    { id: "c", label: "Score each story with the rubric", status: "running", startedAt: min(4.9), doing: "Scoring story 14 of 31",
      substeps: [{ id: "c1", label: "Topics and terms", status: "done", startedAt: min(4.9), endedAt: min(3) }, { id: "c2", label: "Measured claims", status: "running", startedAt: min(3) }] },
    { id: "d", label: "Publish the digest", status: "waiting", ask: "Publish today's sample digest to the research page?" },
    { id: "e", label: "Queue paper-to-code", status: "pending" },
  ];
  const [steps, setSteps] = React.useState(base);
  React.useEffect(() => { const t = setTimeout(() => setSteps((s) => s.map((x) => x.id === "c" ? { ...x, status: "done" as Status, endedAt: Date.now(), substeps: x.substeps!.map((y) => ({ ...y, status: "done" as Status, endedAt: y.endedAt || Date.now() })) } : x)), 6000); return () => clearTimeout(t); }, []);
  return <AgentTrail task="Sample daily paper watch (test data)" steps={steps}
    onApprove={(s) => setSteps((x) => x.map((y) => y.id === s.id ? { ...y, status: "done", startedAt: Date.now(), endedAt: Date.now() } : y.id === "e" ? { ...y, status: "running", startedAt: Date.now() } : y))}
    onReject={(s) => setSteps((x) => x.map((y) => y.id === s.id ? { ...y, status: "skipped" } : y))} />;
}

function PlanDemo() {
  const [steps, setSteps] = React.useState<PlanStep[]>([
    { id: "1", label: "Search arXiv for sparse autoencoder papers" }, { id: "2", label: "Read each abstract page" },
    { id: "3", label: "Score with the superintelligence rubric" }, { id: "4", label: "Write the digest" }]);
  const [running, setRunning] = React.useState(false);
  const run = () => { setRunning(true); let i = 0;
    const tick = () => { setSteps((s) => s.map((x, j) => j < i ? { ...x, status: "done", endedAt: x.endedAt || Date.now() } : j === i ? { ...x, status: i === 2 ? "failed" : "running", startedAt: x.startedAt || Date.now(), note: i === 2 ? "sample failure" : undefined } : { ...x, status: "pending" }));
      if (i < 2) { i++; setTimeout(tick, 1500); } else setRunning(false); };
    tick(); };
  return <AgentPlan title="Sample plan (test data)" steps={steps} onChange={setSteps} onRun={run} running={running}
    onRetryFrom={(_, i) => setSteps((s) => s.map((x, j) => j >= i ? { ...x, status: "pending", note: undefined, startedAt: undefined, endedAt: undefined } : x))} />;
}

const requests = [
  { id: "r1", agent: "Sample paper watcher", action: "Push branch feature/paper-watch-sample", why: "All checks passed on the sample run.", risk: "medium" as const, at: min(2),
    diff: ["+ modules/lab/papers.js  (+51 lines)", "+ test/papers-unit.js    (+9 lines)", "- bench/baseline.json   (1 metric replaced)"], args: { branch: "feature/paper-watch-sample", force: false }, blocks: 2 },
  { id: "r2", agent: "Sample review desk", action: "Send 1 review to a person", why: "The guards moved its score by 25 points.", risk: "low" as const, at: min(1) },
  { id: "r3", agent: "Sample deploy helper", action: "Delete 4 stale sample branches", why: "Merged more than 7 days ago.", risk: "high" as const, args: { branches: ["sample-a", "sample-b", "sample-c", "sample-d"] } },
];

const tasks: InboxTask[] = [
  { id: "t1", title: "Sample paper watch", agent: "watcher", status: "running", startedAt: min(3), updatedAt: min(0.2), lastSteps: ["Read 5 sample abstracts", "Scored 3 of 5"] },
  { id: "t2", title: "Sample branch push", agent: "release", status: "waiting", updatedAt: min(2), lastSteps: ["All checks passed", "Waiting for approval"] },
  { id: "t3", title: "Sample dossier: interpretability", agent: "dossier", status: "failed", updatedAt: min(40), error: "Sample error: feed timed out", lastSteps: ["Fetched 2 of 3 feeds"] },
  { id: "t4", title: "Sample explainer video", agent: "studio", status: "done", updatedAt: min(180), lastSteps: ["Rendered 42 s", "Captions checked"] },
];

async function* fakeStream(text: string) { for (const w of text.split(/(?<= )/)) { await new Promise((r) => setTimeout(r, 35)); yield w; } }
const ANSWER = "Sample answer (test data). Sparse autoencoders split a model's activations into many sparse features [1]. Later work traces how those features connect into circuits [2], and a third item has no source [4], so its chip is shown as unresolved.\n\nUse them as one check among several, not as proof [1].";
const SOURCES = [
  { id: 1, title: "Sample source one: dictionary features", url: "https://example.org/sample-one", site: "example.org", snippet: "Sample snippet describing features found by dictionary learning." },
  { id: 2, title: "Sample source two: tracing circuits", url: "https://example.org/sample-two", site: "example.org", snippet: "Sample snippet about attribution graphs." },
];

function App() {
  const [theme, setTheme] = React.useState<"light" | "dark" | undefined>(undefined);
  const dark = theme ? theme === "dark" : typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  const [streamKey, setStreamKey] = React.useState(0);
  const stream = React.useMemo(() => fakeStream(ANSWER), [streamKey]);
  return (
    <div className="aui demo" data-theme={theme}>
      <header className="demo-head"><div><h1>agent-ui</h1><p className="aui-muted">Original React components for agent products. Every task, branch and source below is sample data.</p></div>
        <button className="aui-btn" type="button" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? "Light" : "Dark"} theme</button></header>
      <div className="demo-grid">
        <div><h2>AgentTrail</h2><TrailDemo /></div>
        <div><h2>AgentPlan</h2><PlanDemo /></div>
        <div><h2>ApprovalGates</h2><ApprovalGates requests={requests} onDecide={() => {}} /></div>
        <div><h2>AwaySummary</h2><AwaySummary since={min(250)} items={[{ id: "n1", title: "Sample branch push waits for approval", kind: "needs" }, { id: "f1", title: "Sample dossier failed", kind: "failed", detail: "Feed timed out" }, { id: "d1", title: "Sample explainer rendered", kind: "done" }, { id: "d2", title: "Sample digest written", kind: "done" }]} onAction={() => {}} /></div>
        <div className="wide"><h2>AgentInbox</h2><AgentInbox tasks={tasks} onAction={() => {}} /></div>
        <div className="wide"><h2>AIAnswer</h2><AIAnswer question="What do sparse autoencoders tell us? (sample)" stream={stream} sources={SOURCES} followUps={["How reliable are the features?", "What do attribution graphs add?"]}
          onRegenerate={() => setStreamKey((k) => k + 1)} onFeedback={() => {}} onFollowUp={() => {}} /></div>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
