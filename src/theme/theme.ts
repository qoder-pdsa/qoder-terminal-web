/** The two themes the terminal offers; `data-theme` on the root element carries the active one. */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "qoder-terminal-theme";

/** The part of `localStorage` the theme needs, so the rules are testable without a DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Only a theme this app saved is a preference; anything else in storage is ignored. */
export function readStoredTheme(store: KeyValueStore): Theme | null {
  const saved = store.getItem(THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : null;
}

/** The saved choice wins; with none, the system preference decides (dark when it prefers dark). */
export function initialTheme(store: KeyValueStore, systemPrefersLight: boolean): Theme {
  return readStoredTheme(store) ?? (systemPrefersLight ? "light" : "dark");
}

export function saveTheme(store: KeyValueStore, theme: Theme): void {
  store.setItem(THEME_STORAGE_KEY, theme);
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
