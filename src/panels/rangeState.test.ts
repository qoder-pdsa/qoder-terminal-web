import { describe, expect, it } from "vitest";
import { DEFAULT_HISTORY_RANGE, HISTORY_RANGES, type HistoryRange } from "../api/data";
import type { OpenPanel } from "../layout/slots";
import { isActiveRange, panelRange, selectPanelRange } from "./rangeState";

const gp = (range?: HistoryRange): OpenPanel => ({
  id: 1,
  command: { kind: "function", code: "GP", symbol: "700.HK", range },
});

/** The only range a panel is on; every other range must read as unselected. */
const pressed = (panel: OpenPanel): HistoryRange[] => HISTORY_RANGES.filter((r) => isActiveRange(panel, r));

describe("panelRange", () => {
  it("starts on the range the command was opened with", () => {
    expect(panelRange(gp("6M"))).toBe("6M");
    expect(panelRange(gp("1Y"))).toBe("1Y");
  });

  it("falls back to the contract default when GP carried no range", () => {
    expect(panelRange(gp())).toBe(DEFAULT_HISTORY_RANGE);
  });

  it("prefers the panel's own choice over the command's range", () => {
    expect(panelRange({ ...gp("6M"), range: "1M" })).toBe("1M");
  });

  it.each(HISTORY_RANGES)("only ever returns a contract range (%s)", (range) => {
    expect(HISTORY_RANGES).toContain(panelRange({ ...gp("6M"), range }));
  });
});

describe("selectPanelRange", () => {
  it("returns a new panel carrying the chosen range", () => {
    const panel = gp("6M");
    const next = selectPanelRange(panel, "1M");
    expect(next).not.toBe(panel);
    expect(next).toEqual({ ...panel, range: "1M" });
    expect(panelRange(next)).toBe("1M");
  });

  it("keeps the panel identity and the command object untouched", () => {
    const panel = gp("6M");
    const next = selectPanelRange(panel, "1Y");
    expect(next.id).toBe(panel.id);
    expect(next.command).toBe(panel.command);
    expect(panel.range).toBeUndefined();
    expect(panelRange(panel)).toBe("6M");
  });

  it("survives a frozen panel", () => {
    const panel = Object.freeze(gp("6M"));
    expect(panelRange(selectPanelRange(panel, "1M"))).toBe("1M");
  });

  // Same reference means the graph effect does not re-run, so a settled fetch is neither
  // repeated nor aborted; only a real range change re-runs it and aborts the previous one.
  it("returns the very same panel when that range is already selected", () => {
    const selected = selectPanelRange(gp("6M"), "1M");
    expect(selectPanelRange(selected, "1M")).toBe(selected);
  });

  it("returns the very same panel when the opened range is re-selected", () => {
    const opened = gp();
    expect(selectPanelRange(opened, DEFAULT_HISTORY_RANGE)).toBe(opened);
    const explicit = gp("6M");
    expect(selectPanelRange(explicit, "6M")).toBe(explicit);
  });

  it.each(HISTORY_RANGES)("reaches %s from any other range", (range) => {
    const other = HISTORY_RANGES.find((r) => r !== range) as HistoryRange;
    expect(panelRange(selectPanelRange(gp(other), range))).toBe(range);
  });

  it("leaves the other panels of a list alone", () => {
    const panels: OpenPanel[] = [gp("6M"), { ...gp("3M"), id: 2 }];
    const next = panels.map((p) => (p.id === 2 ? selectPanelRange(p, "1Y") : p));
    expect(panels.map(panelRange)).toEqual(["6M", "3M"]);
    expect(next.map(panelRange)).toEqual(["6M", "1Y"]);
    expect(next[0]).toBe(panels[0]);
  });
});

describe("isActiveRange", () => {
  it("marks the opened range as pressed before any click", () => {
    expect(pressed(gp("6M"))).toEqual(["6M"]);
    expect(pressed(gp())).toEqual([DEFAULT_HISTORY_RANGE]);
  });

  it("marks exactly one range as pressed after a switch", () => {
    expect(pressed(selectPanelRange(gp("6M"), "1M"))).toEqual(["1M"]);
  });

  it("restores the opened range when it is selected again", () => {
    expect(pressed(selectPanelRange(selectPanelRange(gp("6M"), "1M"), "6M"))).toEqual(["6M"]);
  });
});
