"use client";

import { useState } from "react";
import type { ThemeMode } from "@/lib/theme";

export type { ThemeMode };

export function ThemeToggle({ initialTheme }: { initialTheme: ThemeMode }) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const next: ThemeMode = theme === "light" ? "dark" : "light";

  function toggleTheme() {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `si_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="nav-link"
      style={{ background: "none", border: 0, cursor: "pointer" }}
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
