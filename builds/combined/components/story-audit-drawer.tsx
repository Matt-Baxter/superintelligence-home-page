"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { StoryAuditPayloadSchema, type StoryAuditPayload } from "@/lib/jit";

type ReadingLevel = "intuitive" | "technical" | "institutional";

interface StoreSnapshot {
  status: "idle" | "loading" | "ready" | "error";
  data: StoryAuditPayload | null;
  error: string | null;
}

const IDLE_SNAPSHOT: StoreSnapshot = { status: "idle", data: null, error: null };
const auditCache = new Map<string, StoreSnapshot>();
const inflightRequests = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

function subscribeAuditStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getAuditSnapshot(storyId: string): StoreSnapshot {
  return auditCache.get(storyId) ?? IDLE_SNAPSHOT;
}

function triggerJitAuditFetch(storyId: string, force = false): void {
  const existing = auditCache.get(storyId);
  if (!force && existing && (existing.status === "ready" || existing.status === "loading")) {
    return;
  }
  if (inflightRequests.has(storyId)) return;

  auditCache.set(storyId, {
    status: "loading",
    data: existing?.data ?? null,
    error: null,
  });
  notifyListeners();

  const req = (async () => {
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/audit`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Audit endpoint returned ${res.status}`);
      }
      const raw = await res.json();
      const parsed = StoryAuditPayloadSchema.parse(raw);
      auditCache.set(storyId, { status: "ready", data: parsed, error: null });
    } catch (err) {
      auditCache.set(storyId, {
        status: "error",
        data: null,
        error: err instanceof Error ? err.message : "Unable to load story audit.",
      });
    } finally {
      inflightRequests.delete(storyId);
      notifyListeners();
    }
  })();

  inflightRequests.set(storyId, req);
}

/**
 * Just-In-Time Progressive-Disclosure 3-Level Reading & Score Audit Drawer.
 * Keeps initial RSC payload minimal (~92% smaller per card) and synthesizes full multi-level
 * explanations + score waterfall strictly on demand with hover/focus intent prefetch.
 */
export function StoryAuditDrawer({
  storyId,
  storyTitle,
}: {
  storyId: string;
  storyTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<ReadingLevel>("intuitive");
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshot = useSyncExternalStore(
    subscribeAuditStore,
    () => getAuditSnapshot(storyId),
    () => IDLE_SNAPSHOT,
  );

  function handleIntentEnter() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      triggerJitAuditFetch(storyId);
    }, 110);
  }

  function handleIntentLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      triggerJitAuditFetch(storyId);
    }
  }

  const audit = snapshot.data;

  return (
    <div className="audit-drawer-wrap">
      <button
        type="button"
        className={`audit-trigger-btn${open ? " open" : ""}`}
        onMouseEnter={handleIntentEnter}
        onMouseLeave={handleIntentLeave}
        onFocus={() => triggerJitAuditFetch(storyId)}
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={`Explain "${storyTitle}" at 3 levels and audit score`}
      >
        <span>{open ? "Hide explanation & score audit" : "Explain at 3 levels & audit score"}</span>
        <span aria-hidden="true" className="audit-chevron">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="audit-drawer-panel">
          <div className="audit-level-tabs" role="tablist" aria-label="Explanation reading level">
            <button
              type="button"
              role="tab"
              aria-selected={level === "intuitive"}
              className={`seg-btn${level === "intuitive" ? " active" : ""}`}
              onClick={() => setLevel("intuitive")}
            >
              01 · Public Intuition
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={level === "technical"}
              className={`seg-btn${level === "technical" ? " active" : ""}`}
              onClick={() => setLevel("technical")}
            >
              02 · Technical Signal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={level === "institutional"}
              className={`seg-btn${level === "institutional" ? " active" : ""}`}
              onClick={() => setLevel("institutional")}
            >
              03 · Rigor &amp; Audit
            </button>
          </div>

          {snapshot.status === "loading" && !audit && (
            <div className="jit-audit-status" role="status" aria-live="polite">
              <span className="mono-kicker brass-dot">Synthesizing 3-level audit on demand…</span>
            </div>
          )}

          {snapshot.status === "error" && !audit && (
            <div className="inline-feedback-banner error" role="alert">
              <span>{snapshot.error ?? "Unable to load on-demand audit."}</span>
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => triggerJitAuditFetch(storyId, true)}
              >
                Retry
              </button>
            </div>
          )}

          {audit && (
            <>
              <p className="audit-explanation-copy">{audit.levels[level]}</p>

              <div className="audit-columns">
                <div className="audit-col">
                  <div className="mono-kicker">Score Waterfall ({audit.significanceScore}/100)</div>
                  <ul className="waterfall-mini-list">
                    {audit.why.map((w, idx) => (
                      <li key={`${w.factor}-${idx}`} className="waterfall-mini-row">
                        <span
                          className={`waterfall-pts ${w.points >= 0 ? "pos" : "neg"}`}
                        >
                          {w.points >= 0 ? `+${w.points}` : w.points}
                        </span>
                        <span>
                          <strong>{w.factor}:</strong> {w.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="audit-col">
                  <div className="mono-kicker">Empirical Rigor &amp; Ontology Lineage</div>
                  {audit.presentMarkers.length > 0 ? (
                    <div className="rigor-marker-chips">
                      {audit.presentMarkers.map((m) => (
                        <span key={m.id} className="rigor-chip" title={m.snippet || m.label}>
                          ✓ {m.label} (+{m.points})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint">
                      Abstract snippet contains qualitative framing; open full source to inspect body tables.
                    </p>
                  )}

                  {audit.topics.length > 0 && (
                    <ul className="lineage-mini-list">
                      {audit.topics.slice(0, 4).map((t) => (
                        <li key={t.id}>
                          <strong>{t.label}</strong>
                          {t.matched.length > 0 && (
                            <span className="muted"> — matched “{t.matched.slice(0, 2).join('", "')}”</span>
                          )}
                          {t.via && <span className="muted"> (rolled up from {t.via})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="audit-drawer-links">
                <Link href={`/stories/${storyId}`}>Full provenance &amp; judge trail →</Link>
                <Link
                  href={`/analysis?tab=live-inspector&title=${encodeURIComponent(audit.title)}&url=${encodeURIComponent(audit.url)}&summary=${encodeURIComponent(audit.summary.slice(0, 360))}`}
                >
                  Open in Interactive Paper Attribution Lab →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
