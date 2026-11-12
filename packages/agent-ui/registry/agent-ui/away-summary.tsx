// AwaySummary: "while you were away" for an agent workspace or a chat thread. How long you were gone, then what needs
// you, what failed and what is done, one action per row. "Got it" folds it into a one-line divider that can reopen.
// Improvements: groups with nothing in them are left out instead of showing zeros; the heading says the one thing that
// matters most ("2 need you"); the folded divider keeps the counts; it never steals focus when it appears.
import * as React from "react";
import { cx, duration } from "./lib";

export type AwayItem = { id: string; title: string; kind: "needs" | "failed" | "done"; detail?: string; actionLabel?: string };
export type AwaySummaryProps = { since: number; now?: number; items: AwayItem[]; onAction?: (item: AwayItem) => void; onDismiss?: () => void; defaultFolded?: boolean; className?: string };
const GROUP = { needs: "Needs you", failed: "Failed", done: "Done" } as const;

export function AwaySummary({ since, now = Date.now(), items, onAction, onDismiss, defaultFolded = false, className }: AwaySummaryProps) {
  const [folded, setFolded] = React.useState(defaultFolded);
  const count = (k: AwayItem["kind"]) => items.filter((i) => i.kind === k).length;
  const lead = count("needs") ? `${count("needs")} need${count("needs") === 1 ? "s" : ""} you` : count("failed") ? `${count("failed")} failed` : `${count("done")} done`;
  const gone = duration(now - since);
  if (folded) return (
    <div className={cx("aui aui-away-fold", className)} role="separator" aria-label="While you were away (folded)">
      <button type="button" className="aui-btn ghost aui-xs" onClick={() => setFolded(false)} aria-expanded={false}>
        While you were away ({gone}): {(["needs", "failed", "done"] as const).filter((k) => count(k)).map((k) => `${count(k)} ${GROUP[k].toLowerCase()}`).join(" · ")}
      </button>
    </div>
  );
  return (
    <section className={cx("aui aui-card aui-away", className)} aria-label="While you were away">
      <header className="aui-row"><div className="aui-grow"><strong>While you were away: {lead}</strong><div className="aui-xs aui-muted">Gone {gone}</div></div>
        <button type="button" className="aui-btn" onClick={() => { setFolded(true); onDismiss?.(); }}>Got it</button></header>
      {(["needs", "failed", "done"] as const).filter((k) => count(k)).map((k) => (
        <div key={k} className={cx("aui-away-group", `is-${k}`)}>
          <h4 className="aui-xs aui-muted">{GROUP[k]} · {count(k)}</h4>
          <ul>{items.filter((i) => i.kind === k).map((i) => (
            <li key={i.id} className="aui-row aui-sm">
              <span className="aui-grow"><span className="aui-trunc" style={{ display: "block" }}>{i.title}</span>{i.detail ? <span className="aui-xs aui-muted">{i.detail}</span> : null}</span>
              {onAction ? <button type="button" className={cx("aui-btn aui-xs", k === "needs" && "primary")} onClick={() => onAction(i)}>{i.actionLabel || (k === "needs" ? "Review" : k === "failed" ? "Retry" : "View")}</button> : null}
            </li>))}</ul>
        </div>
      ))}
    </section>
  );
}
