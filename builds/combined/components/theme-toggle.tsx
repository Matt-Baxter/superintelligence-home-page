"use client";

import { useEffect, useState } from "react";
import { applyDocumentTheme, nextThemeMode, THEME_SPECS, type ThemeMode } from "@/lib/theme";

export function ThemeToggle({ initialTheme }: { initialTheme: ThemeMode }) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const next = nextThemeMode(theme);
  const currentSpec = THEME_SPECS[theme];
  const nextSpec = THEME_SPECS[next];

  useEffect(() => {
    const onExternalTheme = (ev: Event) => {
      const custom = ev as CustomEvent<ThemeMode>;
      if (custom.detail) setTheme(custom.detail);
    };
    window.addEventListener("si:theme-change", onExternalTheme);
    return () => window.removeEventListener("si:theme-change", onExternalTheme);
  }, []);

  function cycleTheme() {
    setTheme(next);
    applyDocumentTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="theme-toggle-btn"
      title={`Current theme: ${currentSpec.label}. Click or press T for ${nextSpec.label}.`}
      aria-label={`Theme: ${currentSpec.shortLabel}. Switch to ${nextSpec.label}`}
    >
      <span
        className="theme-swatch-dot"
        data-mode={theme}
        aria-hidden="true"
      />
      <span>{currentSpec.shortLabel}</span>
    </button>
  );
}
