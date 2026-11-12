// Shared helpers for agent-ui. No dependencies beyond React.
import * as React from "react";

export type Status = "pending" | "running" | "waiting" | "done" | "failed" | "skipped";
export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(" ");

/** A clock that ticks only while `active`, so idle lists cost nothing. */
export function useNow(active: boolean, every = 1000): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

/** 4s, 1m 05s, 2h 03m. */
export function duration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}
export const elapsed = (start?: number, end?: number, now = Date.now()) => (start ? duration((end ?? now) - start) : "");

/** "3 minutes ago", "yesterday". */
export function ago(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : `${d} days ago`;
}

const ICON: Record<Status, string> = { pending: "", running: "", waiting: "!", done: "✓", failed: "✕", skipped: "–" };
export const STATUS_LABEL: Record<Status, string> = { pending: "Not started", running: "Running", waiting: "Waiting for you", done: "Done", failed: "Failed", skipped: "Skipped" };
export function Dot({ status }: { status: Status }) {
  return <span className="aui-dot" data-s={status} aria-hidden="true">{ICON[status]}</span>;
}

/** A polite live region: call announce("Step 3 done") and screen readers hear it once. */
export function useAnnouncer(): [React.ReactElement, (msg: string) => void] {
  const [msg, setMsg] = React.useState("");
  const announce = React.useCallback((m: string) => { setMsg(""); requestAnimationFrame(() => setMsg(m)); }, []);
  return [<div className="aui-sr" role="status" aria-live="polite">{msg}</div>, announce];
}

/** Announce when a keyed status changes (not on first render). */
export function useStatusAnnouncements(items: Array<{ id: string; label: string; status: Status }>, announce: (m: string) => void) {
  const prev = React.useRef<Record<string, Status> | null>(null);
  React.useEffect(() => {
    const cur = Object.fromEntries(items.map((i) => [i.id, i.status]));
    if (prev.current) for (const i of items) if (prev.current[i.id] && prev.current[i.id] !== i.status) announce(`${i.label}: ${STATUS_LABEL[i.status]}`);
    prev.current = cur;
  });
}

/** Keyboard shortcuts scoped to an element (only while focus is inside it, never while typing in a field). */
export function useScopedKeys(ref: React.RefObject<HTMLElement | null>, map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const mapRef = React.useRef(map); mapRef.current = map;
  React.useEffect(() => {
    const el = ref.current; if (!el || !enabled) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const fn = mapRef.current[e.key.toLowerCase()]; if (fn) { e.preventDefault(); fn(e); }
    };
    el.addEventListener("keydown", on); return () => el.removeEventListener("keydown", on);
  }, [ref, enabled]);
}
