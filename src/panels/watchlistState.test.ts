import { describe, expect, it } from "vitest";
import type { Quote } from "../api/data";
import { compareDecimal, flashDirections, selectGroup } from "./watchlistState";

function quote(symbol: string, price: string): Quote {
  return { symbol, price, change: "0", changePercent: "0", currency: "HKD", asOf: "2026-09-25T00:00:00Z" };
}

describe("compareDecimal", () => {
  it.each([
    ["438.4000", "438.4000", 0],
    ["438.4", "438.4000", 0],
    ["438.4001", "438.4000", 1],
    ["99.9999", "100.0000", -1],
    ["-0.5", "0.5", -1],
    ["-1.25", "-1.5", 1],
    ["0", "-0.0000", 0],
    ["1000", "999.9999", 1],
  ])("%s vs %s → %d", (a, b, expected) => {
    expect(compareDecimal(a, b)).toBe(expected);
  });
});

describe("flashDirections", () => {
  it("flags symbols whose price moved since the previous poll", () => {
    const prev = [quote("700.HK", "438.4000"), quote("9988.HK", "109.4000"), quote("3690.HK", "120.0000")];
    const next = [quote("700.HK", "438.6000"), quote("9988.HK", "109.2000"), quote("3690.HK", "120.0000")];
    expect(flashDirections(prev, next)).toEqual({ "700.HK": "up", "9988.HK": "down" });
  });

  it("flags nothing on the first poll", () => {
    expect(flashDirections(null, [quote("700.HK", "1")])).toEqual({});
  });
});

describe("selectGroup", () => {
  const lists = [
    { id: "1", name: "A", symbols: [{ symbol: "700.HK", name: "Tencent" }] },
    { id: "2", name: "B", symbols: [] },
  ];
  it("returns the requested group or the first one", () => {
    expect(selectGroup(lists, "2")?.name).toBe("B");
    expect(selectGroup(lists, "missing")?.name).toBe("A");
    expect(selectGroup(lists, null)?.name).toBe("A");
  });
  it("returns null when there are no groups", () => {
    expect(selectGroup([], null)).toBeNull();
  });
});
