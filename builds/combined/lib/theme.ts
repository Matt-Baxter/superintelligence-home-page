export type ThemeMode = "light" | "dark";

export function normalizeTheme(raw: string | undefined): ThemeMode {
  return raw === "dark" || raw === "tactical" ? "dark" : "light";
}
