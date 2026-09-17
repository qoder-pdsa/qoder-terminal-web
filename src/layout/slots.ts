import type { Command } from "../commands/parse";

/** 终端固定 2x2 分屏。 */
export const GRID_SLOTS = 4;

export type RunnableCommand = Exclude<Command, { kind: "invalid" }>;

export interface OpenPanel {
  id: number;
  command: RunnableCommand;
}

/** 新面板放在最前；超出格子数时丢弃最早打开的面板。 */
export function openPanel(prev: readonly OpenPanel[], panel: OpenPanel): OpenPanel[] {
  return [panel, ...prev].slice(0, GRID_SLOTS);
}

/** 把面板列表映射到固定格子，未占用的格子为 null。 */
export function toSlots(panels: readonly OpenPanel[]): (OpenPanel | null)[] {
  return Array.from({ length: GRID_SLOTS }, (_, i) => panels[i] ?? null);
}
