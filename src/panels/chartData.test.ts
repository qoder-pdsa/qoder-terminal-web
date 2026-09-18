import { describe, expect, it } from "vitest";
import type { Candle, IndicatorSeries } from "../api/data";
import { toChartData } from "./chartData";

const candle = (time: string, open: string, high: string, low: string, close: string): Candle => ({
  time,
  open,
  high,
  low,
  close,
  volume: 1_000_000,
});

const sma = (window: number, values: (string | null)[]): IndicatorSeries => ({
  symbol: "700.HK",
  kind: "sma",
  window,
  points: values.map((value, i) => ({ time: `2026-09-0${i + 1}T00:00:00Z`, value })),
});

describe("toChartData", () => {
  it("converts decimal strings to numbers and maps ISO time to the chart date", () => {
    const { candles } = toChartData(
      [
        candle("2026-09-16T00:00:00Z", "605.0000", "612.5000", "604.5000", "611.2500"),
        candle("2026-09-17T00:00:00Z", "611.2500", "615.0000", "608.7500", "609.0000"),
      ],
      [],
    );
    expect(candles).toEqual([
      { time: "2026-09-16", open: 605, high: 612.5, low: 604.5, close: 611.25 },
      { time: "2026-09-17", open: 611.25, high: 615, low: 608.75, close: 609 },
    ]);
  });

  it("drops the null points the contract emits before the window is filled", () => {
    const { overlays } = toChartData([], [sma(20, [null, null, "610.2500", "611.5000"])]);
    expect(overlays).toEqual([
      {
        label: "SMA20",
        points: [
          { time: "2026-09-03", value: 610.25 },
          { time: "2026-09-04", value: 611.5 },
        ],
      },
    ]);
  });

  it("keeps every overlay, in the order requested, labelled by its window", () => {
    const { overlays } = toChartData([], [sma(20, ["1.5"]), sma(50, ["2.5"])]);
    expect(overlays.map((o) => o.label)).toEqual(["SMA20", "SMA50"]);
    expect(overlays.map((o) => o.points[0].value)).toEqual([1.5, 2.5]);
  });

  it("keeps an overlay with nothing plottable as an empty series", () => {
    // SMA50 over a 1M range has fewer than 50 trading days, so every point is null.
    const { overlays } = toChartData([], [sma(50, [null, null, null])]);
    expect(overlays).toEqual([{ label: "SMA50", points: [] }]);
  });

  it("reports the candle count so the panel can tell empty from ok", () => {
    expect(toChartData([], [sma(20, [null])]).candles).toEqual([]);
    expect(toChartData([candle("2026-09-17T00:00:00Z", "1", "2", "0.5", "1.5")], []).candles).toHaveLength(1);
  });
});
