import type { ReactNode } from "react";
import { ThemeContext, useThemeState } from "./useTheme";

/** Sits above the app so the top bar can toggle the theme and the panels can follow it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const state = useThemeState();
  return <ThemeContext.Provider value={state}>{children}</ThemeContext.Provider>;
}
