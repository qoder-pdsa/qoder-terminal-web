/** Session-only command bar history: newest entry first, never persisted. */
export const HISTORY_LIMIT = 20;

export interface HistoryState {
  /** Submitted commands, newest first, at most HISTORY_LIMIT entries. */
  readonly entries: readonly string[];
  /** Index of the entry being recalled; -1 means the user is on their own draft. */
  readonly cursor: number;
  /** What the user had typed before recalling started. */
  readonly draft: string;
}

export const EMPTY_HISTORY: HistoryState = { entries: [], cursor: -1, draft: "" };

/** Record a submitted command: blank input is never stored, an exact repeat of the newest entry is dropped. */
export function push(state: HistoryState, entry: string): HistoryState {
  const value = entry.trim();
  const entries =
    value === "" || state.entries[0] === value
      ? state.entries
      : [value, ...state.entries].slice(0, HISTORY_LIMIT);
  return { entries, cursor: -1, draft: "" };
}

/** Recall the next older command; nothing changes at the oldest entry. */
export function back(state: HistoryState): HistoryState {
  const cursor = state.cursor + 1;
  return cursor >= state.entries.length ? { ...state } : { ...state, cursor };
}

/** Recall the next newer command; past the newest entry the draft is restored. */
export function forward(state: HistoryState): HistoryState {
  return state.cursor === -1 ? { ...state } : { ...state, cursor: state.cursor - 1 };
}

/** The text the command bar shows: the recalled entry, or the draft when not recalling. */
export function current(state: HistoryState): string {
  return state.cursor === -1 ? state.draft : (state.entries[state.cursor] ?? state.draft);
}
