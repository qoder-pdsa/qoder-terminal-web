import { describe, expect, it } from "vitest";
import { toIntradayData } from "./intradayData";

describe("toIntradayData", () => {
  it("maps minutes to unix seconds and keeps the previous close as the baseline", () => {
    const data = toIntradayData({
      symbol: "700.HK",
      currency: "HKD",
      prevClose: "441.0000",
      points: [
        { time: "2026-09-25T01:30:00Z", price: "440.2000", avgPrice: "440.2000", volume: 1000 },
        { time: "2026-09-25T01:31:00Z", price: "442.0000", avgPrice: "441.1000", volume: 2000 },
      ],
    });
    expect(data.baseline).toBe(441);
    expect(data.prices).toEqual([
      { time: 1790299800, value: 440.2 },
      { time: 1790299860, value: 442 },
    ]);
    expect(data.average).toEqual([
      { time: 1790299800, value: 440.2 },
      { time: 1790299860, value: 441.1 },
    ]);
  });

  it("returns empty series before the first trade", () => {
    const data = toIntradayData({ symbol: "700.HK", currency: "HKD", prevClose: "441.0000", points: [] });
    expect(data.prices).toEqual([]);
    expect(data.average).toEqual([]);
    expect(data.baseline).toBe(441);
  });
});
