"use client";

import { useState } from "react";

export function CopyLinkButton({ relativeHref }: { relativeHref: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const fullUrl = new URL(relativeHref, window.location.origin).toString();
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="btn-secondary">
      {copied ? "Copied link" : "Copy link"}
    </button>
  );
}
