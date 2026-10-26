import type { HistoryRange } from "../api/data";
import type { Command } from "../commands/parse";

/** The terminal uses a fixed 2x2 grid. */
export const GRID_SLOTS = 4;

export type RunnableCommand = Exclude<Command, { kind: "invalid" }>;

export interface OpenPanel {
  id: number;
  command: RunnableCommand;
  /** This panel's own GP range choice; unset until a range button is clicked. */
  range?: HistoryRange;
}

/** New panels go first; when the grid is full, the oldest panel is dropped. */
export function openPanel(prev: readonly OpenPanel[], panel: OpenPanel): OpenPanel[] {
  return [panel, ...prev].slice(0, GRID_SLOTS);
}

/** How an open that must not evict anything ended up. */
export type KeepingOutcome = "opened" | "reused" | "grid-full";

export interface KeepingOpen {
  readonly outcome: KeepingOutcome;
  readonly panels: OpenPanel[];
}

/**
 * Open a panel without ever dropping one: a panel matched by `same` is reused, a full grid
 * refuses with a signal so the caller can prompt instead, and only a free slot actually opens.
 * The command bar's direct execution path keeps using `openPanel` and its eviction rule.
 */
export function openKeeping(
  prev: readonly OpenPanel[],
  panel: OpenPanel,
  same: (open: OpenPanel) => boolean,
): KeepingOpen {
  if (prev.some(same)) return { outcome: "reused", panels: [...prev] };
  if (prev.length >= GRID_SLOTS) return { outcome: "grid-full", panels: [...prev] };
  return { outcome: "opened", panels: [panel, ...prev] };
}

/** Close one panel; its slot becomes empty again and the others keep their order. */
export function closePanel(prev: readonly OpenPanel[], id: number): OpenPanel[] {
  return prev.filter((panel) => panel.id !== id);
}

/** Map the panel list onto the fixed slots; unused slots are null. */
export function toSlots(panels: readonly OpenPanel[]): (OpenPanel | null)[] {
  return Array.from({ length: GRID_SLOTS }, (_, i) => panels[i] ?? null);
}
