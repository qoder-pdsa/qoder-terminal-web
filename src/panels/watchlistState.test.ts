import { describe, expect, it } from "vitest";
import type { Quote } from "../api/data";
import {
  ariaSort,
  compareDecimal,
  flashDirections,
  nextSort,
  selectGroup,
  sortRows,
  type SortDirection,
  type SortKey,
  type WatchlistRow,
  type WatchlistSort,
} from "./watchlistState";

/** The session range mirrors the price so it stays inert; this suite sorts on price and changePercent. */
function quote(symbol: string, price: string, changePercent = "0"): Quote {
  return {
    symbol,
    price,
    change: "0",
    changePercent,
    open: price,
    high: price,
    low: price,
    volume: 1,
    turnover: price,
    currency: "HKD",
    asOf: "2026-09-25T00:00:00Z",
  };
}

/** A row whose quote has not arrived yet (options, a short reply) renders `…` and has no numbers to compare. */
function row(symbol: string, price: string | null, changePercent = "0"): WatchlistRow {
  return { symbol, name: symbol, quote: price === null ? null : quote(symbol, price, changePercent) };
}

function symbols(rows: readonly WatchlistRow[]): string[] {
  return rows.map((r) => r.symbol);
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

describe("sortRows", () => {
  // Price order and change order deliberately differ, so a wrong key cannot pass.
  const rows = [
    row("700.HK", "438.4000", "-2.50"),
    row("9988.HK", "109.4000", "1.25"),
    row("3690.HK", "120.0000", "0.75"),
  ];

  const byPrice: Array<[SortDirection, string[]]> = [
    ["descending", ["700.HK", "3690.HK", "9988.HK"]],
    ["ascending", ["9988.HK", "3690.HK", "700.HK"]],
  ];
  const byChange: Array<[SortDirection, string[]]> = [
    ["descending", ["9988.HK", "3690.HK", "700.HK"]],
    ["ascending", ["700.HK", "3690.HK", "9988.HK"]],
  ];

  it("keeps the watchlist's own order when nothing is sorted", () => {
    const sorted = sortRows(rows, null);
    expect(symbols(sorted)).toEqual(["700.HK", "9988.HK", "3690.HK"]);
    expect(sorted).not.toBe(rows);
  });

  it.each(byPrice)("sorts by price %s", (direction, expected) => {
    expect(symbols(sortRows(rows, { key: "price", direction }))).toEqual(expected);
  });

  it.each(byChange)("sorts the CHANGE column by changePercent %s", (direction, expected) => {
    expect(symbols(sortRows(rows, { key: "changePercent", direction }))).toEqual(expected);
  });

  it("keeps the original order of equal values", () => {
    const tied = [row("A", "10.0000", "1.00"), row("B", "10.0000", "2.00"), row("C", "10.0000", "0.50")];
    expect(symbols(sortRows(tied, { key: "price", direction: "descending" }))).toEqual(["A", "B", "C"]);
  });

  it("does not mutate the rows it was given", () => {
    const before = [...rows];
    sortRows(rows, { key: "price", direction: "descending" });
    expect(rows).toEqual(before);
  });

  it("compares decimal strings past float precision", () => {
    // Number() maps both to 438.4 and would silently fall back to the original order.
    const precise = [row("A", "438.4000000000000001"), row("B", "438.4000000000000002")];
    expect(symbols(sortRows(precise, { key: "price", direction: "descending" }))).toEqual(["B", "A"]);
  });

  const unquoted: Array<[SortDirection, string[]]> = [
    ["descending", ["700.HK", "9988.HK", "MSFT261016P420000.US"]],
    ["ascending", ["9988.HK", "700.HK", "MSFT261016P420000.US"]],
  ];

  it.each(unquoted)("puts a row whose quote is still … last when %s", (direction, expected) => {
    const withOption = [
      row("MSFT261016P420000.US", null),
      row("700.HK", "438.4000", "-2.50"),
      row("9988.HK", "109.4000", "1.25"),
    ];
    expect(symbols(sortRows(withOption, { key: "price", direction }))).toEqual(expected);
  });

  it("keeps several unquoted rows in watchlist order", () => {
    const mixed = [row("OPT1.US", null), row("700.HK", "1.0000"), row("OPT2.US", null)];
    expect(symbols(sortRows(mixed, { key: "price", direction: "descending" }))).toEqual([
      "700.HK",
      "OPT1.US",
      "OPT2.US",
    ]);
  });

  it("sorts an empty list to an empty list", () => {
    expect(sortRows([], { key: "price", direction: "descending" })).toEqual([]);
  });
});

describe("nextSort", () => {
  it("starts descending and flips on every further click of the same header", () => {
    expect(nextSort(null, "price")).toEqual({ key: "price", direction: "descending" });
    expect(nextSort({ key: "price", direction: "descending" }, "price")).toEqual({
      key: "price",
      direction: "ascending",
    });
    expect(nextSort({ key: "price", direction: "ascending" }, "price")).toEqual({
      key: "price",
      direction: "descending",
    });
  });

  it("restarts descending when the click moves to the other header", () => {
    expect(nextSort({ key: "price", direction: "ascending" }, "changePercent")).toEqual({
      key: "changePercent",
      direction: "descending",
    });
  });
});

describe("ariaSort", () => {
  const cases: Array<[WatchlistSort | null, SortKey, string]> = [
    [null, "price", "none"],
    [null, "changePercent", "none"],
    [{ key: "price", direction: "descending" }, "price", "descending"],
    [{ key: "price", direction: "descending" }, "changePercent", "none"],
    [{ key: "changePercent", direction: "ascending" }, "changePercent", "ascending"],
    [{ key: "changePercent", direction: "ascending" }, "price", "none"],
  ];

  it.each(cases)("reports the direction of the sorted header only", (sort, key, expected) => {
    expect(ariaSort(sort, key)).toBe(expected);
  });
});
