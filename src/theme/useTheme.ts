import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import { initialTheme, nextTheme, saveTheme, type Theme } from "./theme";

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
 * Owns the theme: starts from the saved choice or the system preference, and keeps
 * `data-theme` on the document element in step with it. A layout effect, so the first
 * paint already carries the resolved theme instead of flashing the default one.
 */
export function useThemeState(): ThemeState {
  const [theme, setTheme] = useState<Theme>(() =>
    initialTheme(localStorage, window.matchMedia("(prefers-color-scheme: light)").matches),
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(localStorage, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((prev) => nextTheme(prev)), []);
  return { theme, toggleTheme };
}
