"use client";

import { useEffect, useRef, useState } from "react";
import { CopyLinkButton } from "./copy-link-button";

export function ShareMenu({
  currentHref,
  jsonHref,
  atomHref,
}: {
  currentHref: string;
  jsonHref: string;
  atomHref: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="share-menu" ref={rootRef} data-open={open ? "true" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="btn-secondary btn-small share-menu-trigger"
        aria-expanded={open}
        aria-controls="feed-share-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Share &amp; export</span>
        <span aria-hidden="true" className="disclosure-chevron" />
      </button>

      {open && (
        <div id="feed-share-menu" className="share-menu-panel" role="group" aria-label="Share and export">
          <p className="share-menu-caption">Share this view</p>
          <CopyLinkButton relativeHref={currentHref} />
          <a href={jsonHref} className="share-menu-item" onClick={() => setOpen(false)}>
            <span>JSON feed</span>
            <span className="share-menu-hint">Current filters, machine-readable</span>
          </a>
          <a href={atomHref} className="share-menu-item" onClick={() => setOpen(false)}>
            <span>Atom feed</span>
            <span className="share-menu-hint">Subscribe by topic</span>
          </a>
        </div>
      )}
    </div>
  );
}
