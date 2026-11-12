// AgentPlan: an agent's step-by-step plan to review before it runs. Rename a step in place, reorder by dragging or
// from the keyboard (Alt+Up / Alt+Down on a focused step, so it works without a mouse), remove or add steps, then Run.
// While it runs each step shows its status and a live timer; a failed step offers "Retry from here". Editing locks
// while running so the plan the agent follows is the plan you see. Controlled: the parent owns `steps`.
import * as React from "react";
import { Dot, Status, STATUS_LABEL, cx, elapsed, useAnnouncer, useNow } from "./lib";

export type PlanStep = { id: string; label: string; status?: Status; startedAt?: number; endedAt?: number; note?: string };
export type AgentPlanProps = {
  title?: string;
  steps: PlanStep[];
  onChange: (steps: PlanStep[]) => void;
  onRun?: (steps: PlanStep[]) => void;
  onRetryFrom?: (step: PlanStep, index: number) => void;
  running?: boolean;
  newId?: () => string;
  className?: string;
};

export function AgentPlan({ title = "Plan", steps, onChange, onRun, onRetryFrom, running = false, newId = () => Math.random().toString(36).slice(2, 9), className }: AgentPlanProps) {
  const now = useNow(steps.some((s) => s.status === "running"));
  const [region, announce] = useAnnouncer();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const rowRefs = React.useRef<Record<string, HTMLLIElement | null>>({});
  const locked = running;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length || from === to) return;
    const next = steps.slice(); const [x] = next.splice(from, 1); next.splice(to, 0, x); onChange(next);
    announce(`${x.label} moved to position ${to + 1} of ${steps.length}`);
    requestAnimationFrame(() => rowRefs.current[x.id]?.focus());
  };
  const rename = (id: string, label: string) => { const v = label.trim(); if (v) onChange(steps.map((s) => (s.id === id ? { ...s, label: v } : s))); setEditing(null); };
  const remove = (i: number) => { const x = steps[i]; onChange(steps.filter((_, j) => j !== i)); announce(`${x.label} removed`); };
  const add = (e: React.FormEvent) => { e.preventDefault(); const v = draft.trim(); if (!v) return; onChange([...steps, { id: newId(), label: v, status: "pending" }]); setDraft(""); announce(`${v} added`); };

  return (
    <section className={cx("aui aui-card aui-plan", className)} aria-label={title}>
      <header className="aui-row"><strong className="aui-grow">{title}</strong>
        <span className="aui-xs aui-muted">{locked ? "Running: editing is locked" : <>Reorder with <kbd className="aui-kbd">Alt</kbd>+<kbd className="aui-kbd">↑</kbd>/<kbd className="aui-kbd">↓</kbd></>}</span></header>
      <ol className="aui-plan-list">
        {steps.map((s, i) => {
          const st: Status = s.status || "pending";
          return (
            <li key={s.id} ref={(el) => { rowRefs.current[s.id] = el; }} tabIndex={locked ? -1 : 0}
              className={cx("aui-plan-step", `is-${st}`, dragId === s.id && "is-drag")}
              aria-label={`Step ${i + 1}: ${s.label}, ${STATUS_LABEL[st]}`}
              draggable={!locked && editing !== s.id}
              onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragId) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const from = steps.findIndex((x) => x.id === dragId); if (from >= 0) move(from, i); setDragId(null); }}
              onDragEnd={() => setDragId(null)}
              onKeyDown={(e) => {
                if (locked || e.target !== e.currentTarget) return;
                if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); }
                else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); }
                else if (e.key === "ArrowUp") { e.preventDefault(); rowRefs.current[steps[i - 1]?.id]?.focus(); }
                else if (e.key === "ArrowDown") { e.preventDefault(); rowRefs.current[steps[i + 1]?.id]?.focus(); }
                else if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setEditing(s.id); }
                else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(i); }
              }}>
              <span className="aui-plan-handle" aria-hidden="true">{locked ? <Dot status={st} /> : <span className="aui-plan-num aui-mono">{i + 1}</span>}</span>
              {editing === s.id ? (
                <input className="aui-input aui-grow" autoFocus defaultValue={s.label} aria-label={`Rename step ${i + 1}`}
                  onBlur={(e) => rename(s.id, e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") rename(s.id, e.currentTarget.value); if (e.key === "Escape") { setEditing(null); rowRefs.current[s.id]?.focus(); } }} />
              ) : (
                <span className="aui-grow aui-plan-label" onDoubleClick={() => !locked && setEditing(s.id)}>{s.label}{s.note ? <span className="aui-xs aui-muted"> · {s.note}</span> : null}</span>
              )}
              {s.startedAt ? <span className="aui-xs aui-muted aui-mono">{elapsed(s.startedAt, s.endedAt, now)}</span> : null}
              {!locked && editing !== s.id ? (
                <span className="aui-plan-tools">
                  <button type="button" className="aui-btn ghost aui-xs" onClick={() => setEditing(s.id)} aria-label={`Rename ${s.label}`}>Rename</button>
                  <button type="button" className="aui-btn ghost aui-xs danger" onClick={() => remove(i)} aria-label={`Remove ${s.label}`}>Remove</button>
                </span>
              ) : null}
              {st === "failed" && onRetryFrom ? <button type="button" className="aui-btn aui-xs" onClick={() => onRetryFrom(s, i)}>Retry from here</button> : null}
            </li>
          );
        })}
      </ol>
      {!locked ? (
        <form className="aui-row" onSubmit={add}>
          <input className="aui-input aui-grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a step" aria-label="New step" />
          <button className="aui-btn" type="submit" disabled={!draft.trim()}>Add</button>
          {onRun ? <button className="aui-btn primary" type="button" disabled={!steps.length} onClick={() => onRun(steps)}>Run {steps.length} steps</button> : null}
        </form>
      ) : null}
      {region}
    </section>
  );
}
