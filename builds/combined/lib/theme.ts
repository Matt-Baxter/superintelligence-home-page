import { z } from "zod";

export const THEME_MODES = ["light", "dark", "atelier"] as const;
export const ThemeModeSchema = z.enum(THEME_MODES);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export interface ThemeSlotSpec {
  id: ThemeMode;
  label: string;
  shortLabel: string;
  isDarkScheme: boolean;
  description: string;
  swatchHex: string;
}

export const THEME_SPECS: Record<ThemeMode, ThemeSlotSpec> = {
  light: {
    id: "light",
    label: "Paper (Light)",
    shortLabel: "Paper",
    isDarkScheme: false,
    description: "Warm archival newsprint with crisp 0.5px ink hairlines and antique brass accents.",
    swatchHex: "#f6f5f1",
  },
  dark: {
    id: "dark",
    label: "Obsidian (Dark)",
    shortLabel: "Obsidian",
    isDarkScheme: true,
    description: "Low-glare charcoal observatory surface with burnished brass telemetry.",
    swatchHex: "#131312",
  },
  atelier: {
    id: "atelier",
    label: "Atelier (Tactical Slate)",
    shortLabel: "Atelier",
    isDarkScheme: true,
    description: "Cool monochrome slate instrumentation with high-contrast silver rules and restrained gold.",
    swatchHex: "#0d1015",
  },
};

export const SLOTTED_CSS_TOKENS = [
  "--aui-panel",
  "--aui-card",
  "--aui-card-elevated",
  "--aui-chip",
  "--aui-border",
  "--aui-border-strong",
  "--aui-ink",
  "--aui-text",
  "--aui-muted",
  "--aui-primary",
  "--aui-on-primary",
  "--aui-accent",
  "--aui-sage",
  "--aui-warning",
  "--aui-danger",
  "--aui-landmark-bg",
  "--aui-landmark-fg",
  "--aui-landmark-border",
  "--aui-focus",
  "--aui-shadow-card",
  "--aui-radius-sm",
  "--aui-radius-md",
] as const;

export function normalizeTheme(raw?: string | null): ThemeMode {
  if (raw === "dark") return "dark";
  if (raw === "atelier" || raw === "tactical") return "atelier";
  return "light";
}

export function nextThemeMode(current: ThemeMode): ThemeMode {
  const idx = THEME_MODES.indexOf(current);
  return THEME_MODES[(idx + 1) % THEME_MODES.length] ?? "light";
}

export function applyDocumentTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const spec = THEME_SPECS[mode];
  root.setAttribute("data-theme", mode);
  root.classList.toggle("dark", spec.isDarkScheme);
  document.cookie = `si_theme=${mode}; path=/; max-age=31536000; samesite=lax`;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ThemeMode>("si:theme-change", { detail: mode }));
  }
}

export interface EmblemLayerSpec {
  id: "containment-ring" | "alignment-horizon" | "zenith-point";
  index: string;
  name: string;
  geometry: string;
  meaning: string;
}

export const EMBLEM_LAYERS: readonly EmblemLayerSpec[] = [
  {
    id: "containment-ring",
    index: "01",
    name: "Containment Ring",
    geometry: "Unbroken circular boundary (r = 9.5)",
    meaning:
      "Institutional governance, reproducible verification, and constitutional safety bounds enclosing every advance.",
  },
  {
    id: "alignment-horizon",
    index: "02",
    name: "Verification Frame",
    geometry: "Inscribed 45° Euclidean diamond",
    meaning:
      "Four-axis empirical audit—capability, alignment, rigor, and multi-source corroboration—anchoring claims inside the outer ring.",
  },
  {
    id: "zenith-point",
    index: "03",
    name: "Aligned Core",
    geometry: "Centered brass focal point (r = 2.05)",
    meaning:
      "Frontier intelligence held in symmetrical equilibrium at the center of verification and governance.",
  },
];
