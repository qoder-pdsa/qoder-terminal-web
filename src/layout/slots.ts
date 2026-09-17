import type { Command } from "../commands/parse";

/** The terminal uses a fixed 2x2 grid. */
export const GRID_SLOTS = 4;

export type RunnableCommand = Exclude<Command, { kind: "invalid" }>;

export interface OpenPanel {
  id: number;
  command: RunnableCommand;
}

/** New panels go first; when the grid is full, the oldest panel is dropped. */
export function openPanel(prev: readonly OpenPanel[], panel: OpenPanel): OpenPanel[] {
  return [panel, ...prev].slice(0, GRID_SLOTS);
}

/** Map the panel list onto the fixed slots; unused slots are null. */
export function toSlots(panels: readonly OpenPanel[]): (OpenPanel | null)[] {
  return Array.from({ length: GRID_SLOTS }, (_, i) => panels[i] ?? null);
}
