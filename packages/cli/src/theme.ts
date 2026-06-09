export interface ThemeColors {
  primary: string;
  aiPrefix: string;
  userPrefix: string;
  border: string;
  accent: string;
  muted: string;
  error: string;
}

const dark: ThemeColors = {
  primary: "#c0392b",
  aiPrefix: "#50c878",
  userPrefix: "#f0c040",
  border: "#333",
  accent: "#50c878",
  muted: "#555",
  error: "#e94560",
};

const light: ThemeColors = {
  primary: "#2563eb",
  aiPrefix: "#059669",
  userPrefix: "#d97706",
  border: "#ccc",
  accent: "#2563eb",
  muted: "#888",
  error: "#dc2626",
};

const cyber: ThemeColors = {
  primary: "#ff006e",
  aiPrefix: "#00f5d4",
  userPrefix: "#fee440",
  border: "#666",
  accent: "#00f5d4",
  muted: "#888",
  error: "#ff006e",
};

export const THEMES: Record<string, ThemeColors> = { dark, light, cyber };
export const DEFAULT_THEME = "dark";

export function getThemeColors(name: string): ThemeColors {
  return THEMES[name] ?? THEMES[DEFAULT_THEME];
}
