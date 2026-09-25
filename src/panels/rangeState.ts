import { DEFAULT_HISTORY_RANGE, type HistoryRange } from "../api/data";
import type { OpenPanel } from "../layout/slots";

/** The range a panel shows: its own choice, else the range the command was opened with. */
export function panelRange(panel: OpenPanel): HistoryRange {
  if (panel.range !== undefined) return panel.range;
  const { command } = panel;
  return command.kind === "function" && command.range !== undefined ? command.range : DEFAULT_HISTORY_RANGE;
}

export function isActiveRange(panel: OpenPanel, range: HistoryRange): boolean {
  return panelRange(panel) === range;
}

/**
 * Immutable per-panel range selection. Re-selecting the range already shown returns the same
 * panel, so the graph effect does not re-run; a real change returns a new panel, and the effect's
 * cleanup aborts the previous range's in-flight history and indicator requests.
 */
export function selectPanelRange(panel: OpenPanel, range: HistoryRange): OpenPanel {
  if (isActiveRange(panel, range)) return panel;
  return { ...panel, range };
}
