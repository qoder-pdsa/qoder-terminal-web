/** Storage the first-visit check reads and writes; injected so tests and blocked storage both work. */
export interface HelpStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const HELP_SEEN_KEY = "qoder-terminal:help-seen";

export type FirstVisitHelp = "auto-open" | "already-seen" | "skip";

/**
 * Decide whether this load should open the help panel by itself: once per browser, recorded in
 * storage. A browser that blocks storage (private mode) can throw just reading the property, so
 * the caller passes a thunk and every access happens inside a guard; any throw degrades to
 * "skip". The marker is written before the caller opens anything, so a double mount decides
 * "already-seen" the second time and never opens a second panel.
 */
export function firstVisitHelp(getStorage: () => HelpStorage): FirstVisitHelp {
  let storage: HelpStorage;
  try {
    storage = getStorage();
  } catch {
    return "skip";
  }
  let seen: string | null;
  try {
    seen = storage.getItem(HELP_SEEN_KEY);
  } catch {
    return "skip";
  }
  if (seen !== null) return "already-seen";
  try {
    storage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    return "skip";
  }
  return "auto-open";
}
