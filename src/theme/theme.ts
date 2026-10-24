/** The two themes the terminal offers; `data-theme` on the root element carries the active one. */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "qoder-terminal-theme";

/** The media query whose answer is the system preference; light only when it explicitly says so. */
export const SYSTEM_LIGHT_QUERY = "(prefers-color-scheme: light)";

/** The part of `localStorage` the theme needs, so the rules are testable without a DOM. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The part of `matchMedia(...)` the theme needs, for the same reason. */
export interface SystemPreference {
  readonly matches: boolean;
  addEventListener(type: "change", listener: SystemPreferenceListener): void;
  removeEventListener(type: "change", listener: SystemPreferenceListener): void;
}

export type SystemPreferenceListener = (event: { readonly matches: boolean }) => void;

/** What start-up learns from storage. */
export interface StoredPreference {
  /** The choice a previous session saved, or null when there is nothing usable to honour. */
  readonly choice: Theme | null;
  /** False when storage refused to answer, so nothing written now could be read back later. */
  readonly usable: boolean;
}

/** Only a theme this app saved is a preference; anything else in storage is ignored. */
function asTheme(saved: string | null): Theme | null {
  return saved === "light" || saved === "dark" ? saved : null;
}

/**
 * What storage holds, and whether it answered at all. A refusal reads the same as an empty store —
 * a visitor whose browser blocks storage still gets a terminal, and no error to dismiss — but it is
 * reported separately, because what cannot be read back is not worth writing (AC-09).
 */
export function readStoredPreference(store: KeyValueStore): StoredPreference {
  try {
    return { choice: asTheme(store.getItem(THEME_STORAGE_KEY)), usable: true };
  } catch {
    return { choice: null, usable: false };
  }
}

/** The stored choice alone, for callers that only need to know what to render. */
export function readStoredTheme(store: KeyValueStore): Theme | null {
  return readStoredPreference(store).choice;
}

/** Remember a choice, unless storage refuses — then it stays a choice for this session only. */
export function saveTheme(store: KeyValueStore, theme: Theme): void {
  try {
    store.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Silently memory-only. Losing a preference is not worth interrupting the session for.
  }
}

function systemTheme(prefersLight: boolean): Theme {
  return prefersLight ? "light" : "dark";
}

/**
 * The theme to render: a human choice — saved before this load or made during it — wins; with none
 * the system preference decides, and keeps deciding for as long as the page stays open (AC-01b).
 */
export function resolveTheme(choice: Theme | null, systemPrefersLight: boolean): Theme {
  return choice ?? systemTheme(systemPrefersLight);
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Follow the system preference from now on, calling `onChange` on every change; the returned
 * function stops following. Subscribing is not itself a change, so nothing is reported up front.
 */
export function followSystemPreference(
  query: SystemPreference,
  onChange: (prefersLight: boolean) => void,
): () => void {
  const listener: SystemPreferenceListener = (event) => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
