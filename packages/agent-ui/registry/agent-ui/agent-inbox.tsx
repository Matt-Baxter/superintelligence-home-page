// AgentInbox: every background agent task in one list. Filter tabs with counts, live clocks on running tasks, status
// tags, rows that unfold to the last steps with Approve, Reject, Retry or Open. Improvements: "Needs you" sorts first
// by default; the list is a single tab stop with arrow-key navigation (roving tabindex) and Enter to unfold; search
// matches title and agent; counts are announced when a filter changes; clocks tick only while something runs.
import * as React from "react";
import { Dot, Status, STATUS_LABEL, ago, cx, elapsed, useAnnouncer, useNow } from "./lib";

export type InboxTask = {
  id: string; title: string; agent: string; status: Status;
  startedAt?: number; endedAt?: number; updatedAt: number;
  lastSteps?: string[]; error?: string; href?: string;
};
export type InboxAction = "approve" | "reject" | "retry" | "open";
export type AgentInboxProps = { tasks: InboxTask[]; onAction?: (task: InboxTask, action: InboxAction) => void; className?: string };

const TABS: Array<{ id: string; label: string; test: (t: InboxTask) => boolean }> = [
  { id: "all", label: "All", test: () => true },
  { id: "needs", label: "Needs you", test: (t) => t.status === "waiting" },
  { id: "running", label: "Running", test: (t) => t.status === "running" },
  { id: "failed", label: "Failed", test: (t) => t.status === "failed" },
  { id: "done", label: "Done", test: (t) => t.status === "done" },
];
const ORDER: Record<Status, number> = { waiting: 0, failed: 1, running: 2, pending: 3, done: 4, skipped: 5 };
const TAG: Record<Status, string> = { waiting: "warn", failed: "bad", running: "accent", done: "good", pending: "", skipped: "" };

export function AgentInbox({ tasks, onAction, className }: AgentInboxProps) {
  const [tab, setTab] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const now = useNow(tasks.some((t) => t.status === "running"));
  const [region, announce] = useAnnouncer();
  const rows = React.useRef<Array<HTMLDivElement | null>>([]);
  const list = tasks.filter(TABS.find((x) => x.id === tab)!.test)
    .filter((t) => !q || `${t.title} ${t.agent}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.updatedAt - a.updatedAt);
  React.useEffect(() => { setCursor(0); }, [tab, q]);
  const focusRow = (i: number) => { const j = Math.max(0, Math.min(list.length - 1, i)); setCursor(j); rows.current[j]?.focus(); };
  const act = (t: InboxTask, a: InboxAction) => { onAction?.(t, a); announce(`${a} sent for ${t.title}`); };
  return (
    <section className={cx("aui aui-card aui-inbox", className)} aria-label="Agent tasks">
      <div className="aui-row aui-inbox-top">
        <div role="tablist" aria-label="Filter tasks" className="aui-inbox-tabs">
          {TABS.map((x) => { const n = tasks.filter(x.test).length; return (
            <button key={x.id} role="tab" type="button" aria-selected={tab === x.id} className={cx("aui-tab", tab === x.id && "is-on")}
              onClick={() => { setTab(x.id); announce(`${x.label}: ${n} task${n === 1 ? "" : "s"}`); }}>
              {x.label} <span className="aui-mono aui-xs">{n}</span></button>); })}
        </div>
        <input className="aui-input aui-inbox-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search tasks" />
      </div>
      <div role="list" className="aui-inbox-list">
        {list.length ? list.map((t, i) => {
          const isOpen = open === t.id;
          return (
            <div role="listitem" key={t.id} className={cx("aui-inbox-row", isOpen && "is-open")}>
              <div ref={(el) => { rows.current[i] = el; }} tabIndex={i === cursor ? 0 : -1} className="aui-row aui-inbox-head" aria-expanded={isOpen}
                aria-label={`${t.title}, ${t.agent}, ${STATUS_LABEL[t.status]}`}
                onClick={() => setOpen(isOpen ? null : t.id)} onFocus={() => setCursor(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); focusRow(i + 1); } else if (e.key === "ArrowUp") { e.preventDefault(); focusRow(i - 1); }
                  else if (e.key === "Home") { e.preventDefault(); focusRow(0); } else if (e.key === "End") { e.preventDefault(); focusRow(list.length - 1); }
                  else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(isOpen ? null : t.id); }
                }}>
                <Dot status={t.status} />
                <span className="aui-grow aui-trunc"><b>{t.title}</b> <span className="aui-muted aui-sm">· {t.agent}</span></span>
                <span className={cx("aui-badge", TAG[t.status])}>{STATUS_LABEL[t.status]}</span>
                <span className="aui-xs aui-muted aui-mono aui-inbox-time">{t.status === "running" ? elapsed(t.startedAt, undefined, now) : ago(t.updatedAt, now)}</span>
              </div>
              {isOpen ? (
                <div className="aui-inbox-body">
                  {t.error ? <p className="aui-sm" style={{ color: "var(--aui-bad)", margin: 0 }}>{t.error}</p> : null}
                  {t.lastSteps?.length ? <ol className="aui-sm aui-muted aui-inbox-steps">{t.lastSteps.map((s, k) => <li key={k}>{s}</li>)}</ol> : null}
                  <div className="aui-row" style={{ flexWrap: "wrap" }}>
                    {t.status === "waiting" ? <><button className="aui-btn primary" type="button" onClick={() => act(t, "approve")}>Approve</button><button className="aui-btn" type="button" onClick={() => act(t, "reject")}>Reject</button></> : null}
                    {t.status === "failed" ? <button className="aui-btn primary" type="button" onClick={() => act(t, "retry")}>Retry</button> : null}
                    {t.href ? <a className="aui-btn ghost" href={t.href} onClick={() => act(t, "open")}>Open</a> : <button className="aui-btn ghost" type="button" onClick={() => act(t, "open")}>Open</button>}
                  </div>
                </div>
              ) : null}
            </div>
          );
        }) : <p className="aui-sm aui-muted" style={{ margin: "8px 0" }}>{q ? "No task matches that search." : "Nothing here."}</p>}
      </div>
      {region}
    </section>
  );
}
