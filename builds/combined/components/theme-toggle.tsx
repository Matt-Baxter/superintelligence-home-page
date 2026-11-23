"use client";

import { useState } from "react";

export type ThemeMode = "dark" | "light" | "tactical";

const THEME_ORDER: ThemeMode[] = ["dark", "tactical", "light"];
const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  tactical: "Tactical",
  light: "Light",
};

export function ThemeToggle({ initialTheme }: { initialTheme: ThemeMode }) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `si_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    try {
      window.localStorage.setItem("si_theme", next);
    } catch {
      // Cookie already persists theme across SSR requests
    }
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="btn-secondary"
      aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`}
      title="Cycle theme: Dark / Tactical Monochrome / Light"
    >
      Theme: {THEME_LABELS[theme]}
    </button>
  );
}
