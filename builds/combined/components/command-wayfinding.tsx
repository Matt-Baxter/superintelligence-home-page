"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyDocumentTheme,
  nextThemeMode,
  normalizeTheme,
  THEME_MODES,
  THEME_SPECS,
  type ThemeMode,
} from "@/lib/theme";

interface CommandAction {
  id: string;
  group: "Navigate" | "Ontology Pillars" | "Theme Slots";
  label: string;
  subtitle: string;
  href?: string;
  theme?: ThemeMode;
}

const PILLAR_ITEMS: { id: string; label: string; sub: string }[] = [
  { id: "capabilities-agi", label: "Capabilities & AGI", sub: "Frontier reasoning, generality & evaluation milestones" },
  { id: "automating-ai-research", label: "Automating AI Research", sub: "Autonomous ML engineering & scientific R&D agents" },
  { id: "recursive-self-improvement", label: "Recursive Self-Improvement", sub: "Self-improving harnesses, compilers & outer loops" },
  { id: "alignment", label: "Alignment", sub: "Scalable oversight, RLHF, honesty & corrigibility" },
  { id: "interpretability", label: "Mechanistic Interpretability", sub: "Sparse autoencoders, circuits & internal representations" },
  { id: "safety-risk", label: "Safety & Frontier Risk", sub: "Deception, loss-of-control & dangerous-capability evals" },
  { id: "forecasting-timelines", label: "Forecasting & Timelines", sub: "Empirical compute trends & calibrated milestone forecasts" },
  { id: "compute-scaling", label: "Compute & Scaling Laws", sub: "Training clusters, inference scaling & data efficiency" },
  { id: "governance-policy", label: "Governance & Policy", sub: "Compute verification, standards & institutional oversight" },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Header trigger button for the JIT Command Palette.
 */
export function CommandTriggerButton() {
  return (
    <button
      type="button"
      className="cmd-trigger-btn"
      aria-label="Open command and ontology jump menu (Command K)"
      onClick={() => window.dispatchEvent(new CustomEvent("si:open-command"))}
    >
      <span>Search</span>
      <kbd className="cmd-kbd">
        <svg
          width="9"
          height="9"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="cmd-kbd-icon"
        >
          <path
            d="M6 6V3.5a2 2 0 1 0-2 2H6Zm0 0h4m-4 0v4m4-4V3.5a2 2 0 1 1 2 2H10Zm0 0v4m0 0h2.5a2 2 0 1 1-2 2V10Zm0 0H6m0 0v2.5a2 2 0 1 1-2 2H6Z"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        K
      </kbd>
    </button>
  );
}

export function CommandWayfinding({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const actions = useMemo<CommandAction[]>(() => {
    const nav: CommandAction[] = [
      { id: "nav-feed", group: "Navigate", label: "Research Feed", subtitle: "Ranked open-source superintelligence & alignment index", href: "/" },
      { id: "nav-lab", group: "Navigate", label: "Scoring & Perturbation Lab", subtitle: "Interactive paper attribution, SIM outer loop & worked examples", href: "/analysis" },
      { id: "nav-brief", group: "Navigate", label: "14-Day Executive Brief", subtitle: "Landmarks, topic velocity & single-source finds", href: "/brief" },
      { id: "nav-sources", group: "Navigate", label: "Public Sources & OPML", subtitle: "30+ open feeds, zero Twitter/X dependencies", href: "/sources" },
      { id: "nav-method", group: "Navigate", label: "Method & Audit Ledger", subtitle: "Every evaluated item, score band & 2015+ backfill status", href: "/review" },
      { id: "nav-queue", group: "Navigate", label: "Human Review Queue", subtitle: "3-verdict quorum consensus on uncertain items", href: "/queue" },
      { id: "nav-compare", group: "Navigate", label: "Build Comparison", subtitle: "Provenance synthesis across Build A and Build B", href: "/compare" },
      { id: "nav-limits", group: "Navigate", label: "Spend & Quota Governance", subtitle: "Per-tier rate limits and daily AI unit caps", href: "/limits" },
      ...(isSignedIn
        ? [{ id: "nav-saved", group: "Navigate" as const, label: "Saved Stories", subtitle: "Your private persistent reading list & JSON/CSV export", href: "/saved" }]
        : [{ id: "nav-signin", group: "Navigate" as const, label: "Sign In / Join Free", subtitle: "Save stories, vote & participate in review quorum", href: "/signin" }]),
    ];

    const pillars: CommandAction[] = PILLAR_ITEMS.map((p) => ({
      id: `topic-${p.id}`,
      group: "Ontology Pillars",
      label: p.label,
      subtitle: p.sub,
      href: `/?topic=${encodeURIComponent(p.id)}`,
    }));

    const themes: CommandAction[] = THEME_MODES.map((m) => ({
      id: `theme-${m}`,
      group: "Theme Slots",
      label: `Switch Theme: ${THEME_SPECS[m].label}`,
      subtitle: THEME_SPECS[m].description,
      theme: m,
    }));

    return [...nav, ...pillars, ...themes];
  }, [isSignedIn]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    const onOpenEvt = () => {
      setOpen(true);
      setQuery("");
      setActiveIdx(0);
    };
    window.addEventListener("si:open-command", onOpenEvt);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          const next = !prev;
          if (next) {
            setQuery("");
            setActiveIdx(0);
          }
          return next;
        });
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // J/K calm keyboard traversal + T theme cycling when not typing in an input
      if (!open && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditableTarget(e.target)) {
        if (e.key === "t" || e.key === "T") {
          e.preventDefault();
          const current = normalizeTheme(document.documentElement.getAttribute("data-theme") ?? undefined);
          applyDocumentTheme(nextThemeMode(current));
          return;
        }
        if (e.key === "j" || e.key === "k") {
          const cards = Array.from(document.querySelectorAll<HTMLElement>(".story-card"));
          if (cards.length === 0) return;
          e.preventDefault();
          const currentIdx = cards.findIndex((c) => c.dataset.kbdActive === "true");
          const nextIdx =
            e.key === "j"
              ? Math.min(cards.length - 1, currentIdx < 0 ? 0 : currentIdx + 1)
              : Math.max(0, currentIdx <= 0 ? 0 : currentIdx - 1);
          for (let i = 0; i < cards.length; i++) {
            if (i === nextIdx) {
              cards[i].dataset.kbdActive = "true";
              cards[i].scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
              delete cards[i].dataset.kbdActive;
            }
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("si:open-command", onOpenEvt);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function executeAction(item: CommandAction) {
    setOpen(false);
    if (item.theme) {
      applyDocumentTheme(item.theme);
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  }

  const grouped = useMemo(() => {
    const groups: { name: CommandAction["group"]; items: { item: CommandAction; flatIndex: number }[] }[] = [];
    let flatIndex = 0;
    for (const item of filtered) {
      let bucket = groups.find((g) => g.name === item.group);
      if (!bucket) {
        bucket = { name: item.group, items: [] };
        groups.push(bucket);
      }
      bucket.items.push({ item, flatIndex });
      flatIndex++;
    }
    return groups;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="cmd-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="cmd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Jump to section, ontology pillar, or theme slot"
      >
        <div className="cmd-search-bar">
          <span className="mono-kicker">Jump</span>
          <input
            ref={inputRef}
            type="search"
            className="cmd-search-input"
            placeholder="Search pages, 9 ontology pillars, or theme presets…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => (filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0));
              } else if (e.key === "Enter" && filtered[activeIdx]) {
                e.preventDefault();
                executeAction(filtered[activeIdx]);
              }
            }}
          />
          <button type="button" className="btn-ghost btn-small" onClick={() => setOpen(false)}>
            Esc
          </button>
        </div>

        <div className="cmd-list" role="listbox" aria-label="Matching destinations">
          {grouped.length === 0 ? (
            <div className="cmd-group-label">No matching routes, ontology pillars, or theme slots.</div>
          ) : (
            grouped.map((group) => (
              <div key={group.name}>
                <div className="cmd-group-label">{group.name}</div>
                {group.items.map(({ item, flatIndex }) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={flatIndex === activeIdx}
                    data-active={flatIndex === activeIdx ? "true" : undefined}
                    className="cmd-item"
                    onMouseEnter={() => setActiveIdx(flatIndex)}
                    onClick={() => executeAction(item)}
                  >
                    <span className="cmd-item-main">
                      <strong>{item.label}</strong>
                      <span className="cmd-item-sub">{item.subtitle}</span>
                    </span>
                    <span className="cmd-kbd">{item.theme ? "Theme" : "Go ↵"}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span>↑↓ Navigate · ↵ Select · Esc Close</span>
          <span>J / K traverses feed · T cycles theme</span>
        </div>
      </div>
    </div>
  );
}
