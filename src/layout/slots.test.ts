import { describe, expect, it } from "vitest";
import { closePanel, GRID_SLOTS, openKeeping, openPanel, toSlots, type OpenPanel } from "./slots";

const cmd = (code: "Q" | "N") => ({ kind: "function" as const, code });
const help = () => ({ kind: "function" as const, code: "HELP" as const });
const isHelp = (panel: OpenPanel) => panel.command.kind === "function" && panel.command.code === "HELP";

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

// DEMO-13: opening HELP or a clicked example must never drop an open panel; an existing HELP
// panel is reused, and a full grid refuses with a signal so the caller can prompt instead.
describe("openKeeping", () => {
  it("opens into a free slot without dropping anything", () => {
    const prev = [1, 2, 3].map((id) => ({ id, command: cmd("Q") }));
    const next = openKeeping(prev, { id: 4, command: cmd("N") }, () => false);
    expect(next.outcome).toBe("opened");
    expect(next.panels.map((p) => p.id)).toEqual([4, 1, 2, 3]);
  });

  it("keeps every panel element-wise and signals the caller when the grid is full", () => {
    const prev = [4, 3, 2, 1].map((id) => ({ id, command: cmd("Q") }));
    const next = openKeeping(prev, { id: 5, command: cmd("N") }, () => false);
    expect(next.outcome).toBe("grid-full");
    expect(next.panels).toEqual(prev);
    expect(next.panels.map((p) => p.id)).toEqual([4, 3, 2, 1]);
  });

  it("reuses the matched panel instead of opening a second one, even on a full grid", () => {
    const prev: OpenPanel[] = [{ id: 9, command: help() }, ...[3, 2, 1].map((id) => ({ id, command: cmd("Q") }))];
    const next = openKeeping(prev, { id: 10, command: help() }, isHelp);
    expect(next.outcome).toBe("reused");
    expect(next.panels.map((p) => p.id)).toEqual([9, 3, 2, 1]);
  });

  it("opens a help panel into a free slot", () => {
    const prev: OpenPanel[] = [{ id: 1, command: cmd("Q") }];
    const next = openKeeping(prev, { id: 2, command: help() }, isHelp);
    expect(next.outcome).toBe("opened");
    expect(next.panels.map((p) => p.id)).toEqual([2, 1]);
  });

  it("does not mutate the previous list", () => {
    const prev = [{ id: 1, command: cmd("Q") }];
    openKeeping(prev, { id: 2, command: cmd("N") }, () => false);
    expect(prev.map((p) => p.id)).toEqual([1]);
  });
});

// DEMO-13 boundary: the command bar's direct execution path keeps evicting the oldest panel.
describe("openPanel eviction lock (DEMO-13 boundary)", () => {
  it("still drops the oldest panel when a fifth panel is opened", () => {
    const prev = [4, 3, 2, 1].map((id) => ({ id, command: cmd("Q") }));
    expect(openPanel(prev, { id: 5, command: cmd("N") }).map((p) => p.id)).toEqual([5, 4, 3, 2]);
  });
});
