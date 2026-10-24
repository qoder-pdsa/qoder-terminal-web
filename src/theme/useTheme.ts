import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import {
  followSystemPreference,
  nextTheme,
  readStoredPreference,
  resolveTheme,
  saveTheme,
  SYSTEM_LIGHT_QUERY,
  type StoredPreference,
  type Theme,
} from "./theme";

export interface ThemeState {
  readonly theme: Theme;
  readonly toggleTheme: () => void;
}

/** Panels read this to redraw their canvas, which cannot follow a CSS variable by itself. */
export const ThemeContext = createContext<ThemeState>({ theme: "dark", toggleTheme: () => {} });

export function useTheme(): ThemeState {
  return useContext(ThemeContext);
}

/**
 * Storage is reached only here, and a refusal never becomes an error the visitor has to dismiss
 * (AC-09). Two guards because there are two ways to fail: some privacy modes reject the property
 * access itself, before any method runs, and others only reject the call.
 */
function readStorage(): StoredPreference {
  try {
    return readStoredPreference(localStorage);
  } catch {
    return { choice: null, usable: false };
  }
}

function persist(theme: Theme): void {
  try {
    saveTheme(localStorage, theme);
  } catch {
    // This session only.
  }
}

/**
 * Owns the theme. `choice` is what a human picked — read from storage once, then held in memory —
 * so a visitor who picked nothing keeps following the system, including while the page stays open.
 * Only a real choice is persisted: a theme the system decided is not the visitor's preference, and
 * storing it would quietly end the following. Storage that could not be read at start-up is not
 * written to either, since nothing written there could be read back.
 */
export function useThemeState(): ThemeState {
  const [storage] = useState(readStorage);
  const [choice, setChoice] = useState<Theme | null>(storage.choice);
  const [systemPrefersLight, setSystemPrefersLight] = useState(
    () => window.matchMedia(SYSTEM_LIGHT_QUERY).matches,
  );

  useEffect(
    () => followSystemPreference(window.matchMedia(SYSTEM_LIGHT_QUERY), setSystemPrefersLight),
    [],
  );

  const theme = resolveTheme(choice, systemPrefersLight);

  // A layout effect, so the first paint already carries the resolved theme instead of flashing the
  // default one.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = nextTheme(theme);
    setChoice(next);
    if (storage.usable) persist(next);
  }, [storage, theme]);

  return { theme, toggleTheme };
}
