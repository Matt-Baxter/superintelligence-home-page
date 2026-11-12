// AgentTrail: the steps an agent works through, as one trail. Done steps show a check and their time, the running step
// says what it is doing and opens its sub-steps with a live timer, a step that needs a person waits with a dashed ring
// and its own action. Improvements over a plain progress list: the clock ticks only while something runs, status
// changes are announced to screen readers, finished steps fold away once there are many, a failed step offers Retry,
// and the whole trail is an ordered list with aria-current on the active step.
import * as React from "react";
import { Dot, Status, STATUS_LABEL, cx, elapsed, useAnnouncer, useNow, useStatusAnnouncements } from "./lib";

export type TrailStep = {
  id: string; label: string; status: Status;
  startedAt?: number; endedAt?: number;
  /** What it is doing right now (shown on the running step). */
  doing?: string;
  substeps?: TrailStep[];
  /** For a waiting step: what the person is asked. */
  ask?: string;
};
export type AgentTrailProps = {
  task: string;
  steps: TrailStep[];
  /** Fold finished steps into one line when there are more than this many. */
  foldDoneAfter?: number;
  onApprove?: (step: TrailStep) => void;
  onReject?: (step: TrailStep) => void;
  onRetry?: (step: TrailStep) => void;
  className?: string;
};

function StepRow({ s, now, depth, props }: { s: TrailStep; now: number; depth: number; props: AgentTrailProps }) {
  const live = s.status === "running";
  return (
    <li className={cx("aui-trail-step", `is-${s.status}`)} aria-current={live ? "step" : undefined} style={{ ["--d" as any]: depth }}>
      <div className="aui-row">
        <Dot status={s.status} />
        <span className="aui-grow aui-trunc">{s.label}</span>
        <span className="aui-sr">{STATUS_LABEL[s.status]}</span>
        {(s.startedAt && (s.endedAt || live)) ? <span className="aui-xs aui-muted aui-mono">{elapsed(s.startedAt, s.endedAt, now)}</span> : null}
      </div>
      {live && s.doing ? <p className="aui-trail-doing aui-sm aui-muted">{s.doing}</p> : null}
      {s.status === "waiting" ? (
        <div className="aui-trail-ask">
          {s.ask ? <p className="aui-sm">{s.ask}</p> : null}
          <div className="aui-row">
            {props.onApprove ? <button className="aui-btn primary" type="button" onClick={() => props.onApprove!(s)}>Approve</button> : null}
            {props.onReject ? <button className="aui-btn" type="button" onClick={() => props.onReject!(s)}>Reject</button> : null}
          </div>
        </div>
      ) : null}
      {s.status === "failed" && props.onRetry ? <div className="aui-trail-ask"><button className="aui-btn" type="button" onClick={() => props.onRetry!(s)}>Retry from here</button></div> : null}
      {s.substeps?.length && (live || s.status === "waiting" || s.status === "failed") ? (
        <ol className="aui-trail-sub">{s.substeps.map((x) => <StepRow key={x.id} s={x} now={now} depth={depth + 1} props={props} />)}</ol>
      ) : null}
    </li>
  );
}

export function AgentTrail(props: AgentTrailProps) {
  const { task, steps, foldDoneAfter = 4, className } = props;
  const flat = steps.flatMap((s) => [s, ...(s.substeps || [])]);
  const now = useNow(flat.some((s) => s.status === "running"));
  const [region, announce] = useAnnouncer();
  useStatusAnnouncements(steps.map((s) => ({ id: s.id, label: s.label, status: s.status })), announce);
  const [open, setOpen] = React.useState(false);
  const done = steps.filter((s) => s.status === "done").length;
  const firstLive = steps.findIndex((s) => s.status !== "done");
  const leadingDone = firstLive === -1 ? steps.length : firstLive;
  const fold = !open && leadingDone > foldDoneAfter;
  const shown = fold ? steps.slice(leadingDone) : steps;
  const total = steps.reduce((a, s) => a + (s.startedAt ? ((s.endedAt ?? (s.status === "running" ? now : s.startedAt)) - s.startedAt) : 0), 0);
  return (
    <section className={cx("aui aui-card aui-trail", className)} aria-label={`Agent progress: ${task}`}>
      <header className="aui-row aui-trail-head">
        <strong className="aui-grow aui-trunc">{task}</strong>
        <span className="aui-sm aui-muted aui-mono" aria-label={`${done} of ${steps.length} steps done`}>{done}/{steps.length}</span>
      </header>
      <div className="aui-trail-bar" aria-hidden="true"><i style={{ width: `${steps.length ? (100 * done) / steps.length : 0}%` }} /></div>
      {fold ? <button type="button" className="aui-btn ghost aui-sm" onClick={() => setOpen(true)}>Show {leadingDone} finished steps · {elapsed(1, 1 + total)}</button> : null}
      <ol className="aui-trail-list">{shown.map((s) => <StepRow key={s.id} s={s} now={now} depth={0} props={props} />)}</ol>
      {region}
    </section>
  );
}
