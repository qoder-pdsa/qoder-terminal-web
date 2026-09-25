import { describe, expect, it } from "vitest";
import { closePanel, GRID_SLOTS, openPanel, toSlots } from "./slots";

const cmd = (code: "Q" | "N") => ({ kind: "function" as const, code });

describe("openPanel", () => {
  it("puts the newest panel first and keeps at most GRID_SLOTS panels", () => {
    const panels = [1, 2, 3, 4, 5].reduce(
      (acc, id) => openPanel(acc, { id, command: cmd("Q") }),
      [] as ReturnType<typeof openPanel>,
    );
    expect(panels.map((p) => p.id)).toEqual([5, 4, 3, 2]);
    expect(panels).toHaveLength(GRID_SLOTS);
  });

  it("does not mutate the previous list", () => {
    const prev = [{ id: 1, command: cmd("N") }];
    openPanel(prev, { id: 2, command: cmd("Q") });
    expect(prev.map((p) => p.id)).toEqual([1]);
  });
});

describe("closePanel", () => {
  it("removes only the panel with that id and keeps the order of the rest", () => {
    const prev = [3, 2, 1].map((id) => ({ id, command: cmd("Q") }));
    expect(closePanel(prev, 2).map((p) => p.id)).toEqual([3, 1]);
  });

  it("frees exactly one slot of a full grid", () => {
    const prev = [4, 3, 2, 1].map((id) => ({ id, command: cmd("N") }));
    const next = closePanel(prev, 4);
    expect(next).toHaveLength(GRID_SLOTS - 1);
    expect(toSlots(next).map((s) => s?.id ?? null)).toEqual([3, 2, 1, null]);
  });

  it("does not mutate the previous list", () => {
    const prev = [1, 2].map((id) => ({ id, command: cmd("Q") }));
    closePanel(prev, 1);
    expect(prev.map((p) => p.id)).toEqual([1, 2]);
  });

  it("keeps every panel when the id is not open", () => {
    const prev = [{ id: 1, command: cmd("Q") }];
    expect(closePanel(prev, 99).map((p) => p.id)).toEqual([1]);
  });
});

describe("toSlots", () => {
  it("pads with nulls so the grid is always full", () => {
    const slots = toSlots([{ id: 1, command: cmd("Q") }]);
    expect(slots).toHaveLength(GRID_SLOTS);
    expect(slots.map((s) => s?.id ?? null)).toEqual([1, null, null, null]);
  });
});
