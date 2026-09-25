import { describe, expect, it } from "vitest";
import {
  back,
  current,
  forward,
  HISTORY_LIMIT,
  push,
  EMPTY_HISTORY,
  type HistoryState,
} from "./history";

const filled = (...entries: string[]): HistoryState =>
  entries.reduce((state, entry) => push(state, entry), EMPTY_HISTORY);

describe("push", () => {
  it("keeps the newest entry first", () => {
    expect(filled("700 Q", "9988.HK GP").entries).toEqual(["9988.HK GP", "700 Q"]);
  });

  it("caps the history at HISTORY_LIMIT entries, dropping the oldest", () => {
    const total = HISTORY_LIMIT + 5;
    const state = Array.from({ length: total }, (_, i) => `cmd ${i}`).reduce(
      (acc, entry) => push(acc, entry),
      EMPTY_HISTORY,
    );
    expect(state.entries).toHaveLength(HISTORY_LIMIT);
    expect(state.entries[0]).toBe(`cmd ${total - 1}`);
    expect(state.entries[HISTORY_LIMIT - 1]).toBe(`cmd ${total - HISTORY_LIMIT}`);
  });

  it("does not duplicate an entry identical to the newest one", () => {
    const state = push(push(EMPTY_HISTORY, "700 Q"), "700 Q");
    expect(state.entries).toEqual(["700 Q"]);
  });

  it("keeps an older duplicate so it can still be recalled twice apart", () => {
    expect(filled("700 Q", "GP", "700 Q").entries).toEqual(["700 Q", "GP", "700 Q"]);
  });

  it("never stores blank input", () => {
    expect(push(EMPTY_HISTORY, "").entries).toEqual([]);
    expect(push(EMPTY_HISTORY, "   ").entries).toEqual([]);
    expect(push(filled("700 Q"), "  ").entries).toEqual(["700 Q"]);
  });

  it("stores the trimmed entry", () => {
    expect(push(EMPTY_HISTORY, "  700 Q  ").entries).toEqual(["700 Q"]);
  });

  it("returns a new state and leaves the previous one untouched", () => {
    const prev = filled("700 Q");
    const next = push(prev, "9988.HK GP");
    expect(next).not.toBe(prev);
    expect(prev.entries).toEqual(["700 Q"]);
    expect(prev.cursor).toBe(-1);
  });
});

describe("back", () => {
  it("recalls the newest entry first, then walks toward the oldest", () => {
    const state = filled("700 Q", "9988.HK GP", "ASK compare");
    const first = back(state);
    expect(current(first)).toBe("ASK compare");
    expect(current(back(first))).toBe("9988.HK GP");
    expect(current(back(back(first)))).toBe("700 Q");
  });

  it("changes nothing at the oldest end", () => {
    const oldest = back(back(filled("700 Q", "9988.HK GP")));
    expect(current(oldest)).toBe("700 Q");
    expect(current(back(oldest))).toBe("700 Q");
    expect(back(oldest).cursor).toBe(oldest.cursor);
  });

  it("changes nothing when the history is empty", () => {
    expect(current(back(EMPTY_HISTORY))).toBe("");
    expect(back(EMPTY_HISTORY).cursor).toBe(-1);
  });

  it("returns a new state without mutating the previous one", () => {
    const prev = filled("700 Q", "9988.HK GP");
    const next = back(prev);
    expect(next).not.toBe(prev);
    expect(prev.cursor).toBe(-1);
  });
});

describe("forward", () => {
  it("walks back toward the newest entry", () => {
    const state = back(back(filled("700 Q", "9988.HK GP")));
    expect(current(state)).toBe("700 Q");
    expect(current(forward(state))).toBe("9988.HK GP");
  });

  it("restores the draft the user was typing once past the newest entry", () => {
    const typed: HistoryState = { ...filled("700 Q"), draft: "700 G" };
    const recalled = back(typed);
    expect(current(recalled)).toBe("700 Q");
    const restored = forward(recalled);
    expect(current(restored)).toBe("700 G");
    expect(restored.cursor).toBe(-1);
  });

  it("changes nothing when not navigating", () => {
    const state = filled("700 Q");
    expect(forward(state).cursor).toBe(-1);
    expect(current(forward(state))).toBe("");
  });

  it("returns a new state without mutating the previous one", () => {
    const prev = back(filled("700 Q"));
    const next = forward(prev);
    expect(next).not.toBe(prev);
    expect(prev.cursor).toBe(0);
  });
});

describe("navigation resets", () => {
  it("starts from the newest entry again after a command is pushed", () => {
    const navigated = back(filled("700 Q"));
    expect(current(push(navigated, "9988.HK GP"))).toBe("");
    expect(current(back(push(navigated, "9988.HK GP")))).toBe("9988.HK GP");
  });

  it("pushing a blank entry still ends the navigation", () => {
    const navigated = back(filled("700 Q"));
    expect(current(push(navigated, "   "))).toBe("");
  });
});
