// ApprovalGates: an agent run's approval requests as a stack. The request to decide now sits on top with who asks,
// what exactly and why, the diff or arguments; approve, reject (with an optional reason) or edit the arguments first.
// It drops into a decided list while the next one rises. Improvements: shortcuts (A, R, E) work only while focus is in
// the stack and never while typing; edited arguments must parse as JSON before they can be approved; every decision
// can be undone for a few seconds; high-risk requests need a second confirmation; focus moves to the next request so
// keyboard users never lose their place; and a request can hold back the steps queued behind it (`blocks`).
import * as React from "react";
import { ago, cx, useAnnouncer, useScopedKeys } from "./lib";

export type Risk = "low" | "medium" | "high";
export type ApprovalRequest = {
  id: string; agent: string; action: string; why?: string; risk: Risk; at?: number;
  /** Unified-diff-like lines ("+ added", "- removed", "  context") or plain text. */
  diff?: string[];
  args?: Record<string, unknown>;
  /** How many later steps wait on this decision. */
  blocks?: number;
};
export type Decision = { id: string; decision: "approved" | "rejected"; args?: Record<string, unknown>; reason?: string; at: number };
export type ApprovalGatesProps = {
  requests: ApprovalRequest[];
  onDecide: (d: Decision) => void;
  onUndo?: (d: Decision) => void;
  undoMs?: number;
  className?: string;
};

const RISK: Record<Risk, string> = { low: "good", medium: "warn", high: "bad" };

export function ApprovalCard({ req, onDecide, active = true }: { req: ApprovalRequest; onDecide: (d: Omit<Decision, "at">) => void; active?: boolean }) {
  const [mode, setMode] = React.useState<"view" | "edit" | "reject" | "confirm">("view");
  const [text, setText] = React.useState(() => JSON.stringify(req.args ?? {}, null, 2));
  const [reason, setReason] = React.useState("");
  const parsed = React.useMemo(() => { try { return { ok: true as const, v: JSON.parse(text) }; } catch (e) { return { ok: false as const, err: String((e as Error).message) }; } }, [text]);
  const ref = React.useRef<HTMLDivElement>(null);
  const approve = () => {
    if (mode === "edit" && !parsed.ok) return;
    if (req.risk === "high" && mode !== "confirm") { setMode("confirm"); return; }
    onDecide({ id: req.id, decision: "approved", args: mode === "edit" || mode === "confirm" ? (parsed.ok ? parsed.v : req.args) : req.args });
  };
  useScopedKeys(ref, { a: approve, r: () => setMode("reject"), e: () => req.args && setMode("edit"), escape: () => setMode("view") }, active);
  return (
    <div ref={ref} className={cx("aui-card aui-gate", `risk-${req.risk}`)} role="group" aria-label={`Approval request from ${req.agent}: ${req.action}`}>
      <div className="aui-row">
        <span className={cx("aui-badge", RISK[req.risk])}>{req.risk} risk</span>
        <span className="aui-sm aui-muted aui-grow aui-trunc">{req.agent}{req.at ? ` · ${ago(req.at)}` : ""}</span>
        {req.blocks ? <span className="aui-xs aui-muted">holds {req.blocks} step{req.blocks > 1 ? "s" : ""}</span> : null}
      </div>
      <p className="aui-gate-action">{req.action}</p>
      {req.why ? <p className="aui-sm aui-muted aui-gate-why">Why: {req.why}</p> : null}
      {req.diff?.length ? (
        <pre className="aui-gate-diff" aria-label="Proposed change">{req.diff.map((l, i) => <span key={i} className={l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : ""}>{l}{"\n"}</span>)}</pre>
      ) : null}
      {mode === "edit" ? (
        <label className="aui-gate-edit aui-sm">Arguments (JSON)
          <textarea className="aui-input aui-mono" rows={Math.min(12, text.split("\n").length + 1)} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!parsed.ok} />
          {!parsed.ok ? <span className="aui-xs" style={{ color: "var(--aui-bad)" }}>Not valid JSON: {parsed.err}</span> : null}
        </label>
      ) : req.args ? (
        <pre className="aui-gate-args aui-mono aui-xs">{JSON.stringify(req.args, null, 2)}</pre>
      ) : null}
      {mode === "reject" ? (
        <form className="aui-row" onSubmit={(e) => { e.preventDefault(); onDecide({ id: req.id, decision: "rejected", reason: reason.trim() || undefined }); }}>
          <input className="aui-input aui-grow" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the agent (optional)" aria-label="Reason" />
          <button className="aui-btn danger" type="submit">Reject</button>
          <button className="aui-btn ghost" type="button" onClick={() => setMode("view")}>Cancel</button>
        </form>
      ) : mode === "confirm" ? (
        <div className="aui-row aui-gate-confirm" role="alert">
          <span className="aui-sm aui-grow">High risk. Approve this exactly as shown?</span>
          <button className="aui-btn primary" type="button" autoFocus onClick={approve}>Yes, approve</button>
          <button className="aui-btn ghost" type="button" onClick={() => setMode("view")}>Back</button>
        </div>
      ) : (
        <div className="aui-row aui-gate-actions">
          <button className="aui-btn primary" type="button" onClick={approve} disabled={mode === "edit" && !parsed.ok}>{mode === "edit" ? "Approve edited" : "Approve"} <kbd className="aui-kbd">A</kbd></button>
          <button className="aui-btn" type="button" onClick={() => setMode("reject")}>Reject <kbd className="aui-kbd">R</kbd></button>
          {req.args && mode !== "edit" ? <button className="aui-btn ghost" type="button" onClick={() => setMode("edit")}>Edit first <kbd className="aui-kbd">E</kbd></button> : null}
          {mode === "edit" ? <button className="aui-btn ghost" type="button" onClick={() => { setMode("view"); setText(JSON.stringify(req.args ?? {}, null, 2)); }}>Discard edits</button> : null}
        </div>
      )}
    </div>
  );
}

export function ApprovalGates({ requests, onDecide, onUndo, undoMs = 6000, className }: ApprovalGatesProps) {
  const [decided, setDecided] = React.useState<Array<Decision & { req: ApprovalRequest }>>([]);
  const [region, announce] = useAnnouncer();
  const top = requests.find((r) => !decided.some((d) => d.id === r.id));
  const waiting = requests.filter((r) => r !== top && !decided.some((d) => d.id === r.id));
  const stackRef = React.useRef<HTMLDivElement>(null);
  const [nowTick, setNowTick] = React.useState(Date.now());
  const undoable = decided.filter((d) => nowTick - d.at < undoMs);
  React.useEffect(() => { if (!undoable.length) return; const t = setTimeout(() => setNowTick(Date.now()), 500); return () => clearTimeout(t); });
  const decide = (d: Omit<Decision, "at">) => {
    const req = requests.find((r) => r.id === d.id)!; const full = { ...d, at: Date.now() };
    setDecided((x) => [{ ...full, req }, ...x]); setNowTick(Date.now()); onDecide(full);
    announce(`${d.decision === "approved" ? "Approved" : "Rejected"}: ${req.action}. ${waiting.length ? `${waiting.length} more waiting.` : "Nothing else waiting."}`);
    requestAnimationFrame(() => (stackRef.current?.querySelector(".aui-gate button") as HTMLElement | null)?.focus());
  };
  const undo = (d: Decision & { req: ApprovalRequest }) => { setDecided((x) => x.filter((y) => y.id !== d.id)); onUndo?.(d); announce(`Undone: ${d.req.action} is waiting again`); };
  return (
    <section className={cx("aui aui-gates", className)} aria-label="Approvals">
      <header className="aui-row"><strong className="aui-grow">Approvals</strong><span className="aui-sm aui-muted">{top ? `${waiting.length + 1} waiting` : "All decided"}</span></header>
      <div className="aui-gates-stack" ref={stackRef} data-depth={Math.min(2, waiting.length)}>
        {top ? <ApprovalCard key={top.id} req={top} onDecide={decide} /> : <p className="aui-sm aui-muted aui-card">Nothing waits on you.</p>}
      </div>
      {waiting.length ? <p className="aui-xs aui-muted">Next: {waiting.slice(0, 3).map((w) => w.action).join(" · ")}{waiting.length > 3 ? ` · and ${waiting.length - 3} more` : ""}</p> : null}
      {decided.length ? (
        <ul className="aui-gates-done" aria-label="Decided">
          {decided.map((d) => (
            <li key={d.id} className="aui-row aui-sm">
              <span className={cx("aui-badge", d.decision === "approved" ? "good" : "bad")}>{d.decision}</span>
              <span className="aui-grow aui-trunc">{d.req.action}{d.reason ? <span className="aui-muted"> · {d.reason}</span> : null}</span>
              {undoable.includes(d) ? <button className="aui-btn ghost aui-xs" type="button" onClick={() => undo(d)}>Undo</button> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {region}
    </section>
  );
}
