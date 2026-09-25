import { describe, expect, it } from "vitest";
import type { Time } from "lightweight-charts";
import type { Candle, IndicatorSeries } from "../api/data";
import { crosshairDay, formatCandleReadout, toChartData, volumeBarColor, type VolumeColors } from "./chartData";

const COLORS: VolumeColors = { up: "#ff4d4d", down: "#3ad17a" };

const candle = (
  time: string,
  open: string,
  high: string,
  low: string,
  close: string,
  volume = 1_000_000,
): Candle => ({
  time,
  open,
  high,
  low,
  close,
  volume,
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
      COLORS,
    );
    expect(candles).toEqual([
      { time: "2026-09-16", open: 605, high: 612.5, low: 604.5, close: 611.25 },
      { time: "2026-09-17", open: 611.25, high: 615, low: 608.75, close: 609 },
    ]);
  });

  it("drops the null points the contract emits before the window is filled", () => {
    const { overlays } = toChartData([], [sma(20, [null, null, "610.2500", "611.5000"])], COLORS);
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
    const { overlays } = toChartData([], [sma(20, ["1.5"]), sma(50, ["2.5"])], COLORS);
    expect(overlays.map((o) => o.label)).toEqual(["SMA20", "SMA50"]);
    expect(overlays.map((o) => o.points[0].value)).toEqual([1.5, 2.5]);
  });

  it("keeps an overlay with nothing plottable as an empty series", () => {
    // SMA50 over a 1M range has fewer than 50 trading days, so every point is null.
    const { overlays } = toChartData([], [sma(50, [null, null, null])], COLORS);
    expect(overlays).toEqual([{ label: "SMA50", points: [] }]);
  });

  it("reports the candle count so the panel can tell empty from ok", () => {
    expect(toChartData([], [sma(20, [null])], COLORS).candles).toEqual([]);
    expect(
      toChartData([candle("2026-09-17T00:00:00Z", "1", "2", "0.5", "1.5")], [], COLORS).candles,
    ).toHaveLength(1);
  });
});

describe("volumeBarColor", () => {
  it.each([
    ["close above open", "605.0000", "611.2500", COLORS.up],
    ["close equal to open", "605.0000", "605.0000", COLORS.up],
    ["close below open", "611.2500", "609.0000", COLORS.down],
    ["unequal fraction digits, still up", "605.0", "605.00001", COLORS.up],
    ["unequal fraction digits, still down", "605.00001", "605.0", COLORS.down],
  ])("colors a candle whose %s with its own direction color", (_label, open, close, expected) => {
    expect(volumeBarColor(open, close, COLORS)).toBe(expected);
  });
});

describe("toChartData volume", () => {
  it("emits one bar per candle on the candle's business day, colored by direction", () => {
    const { volume } = toChartData(
      [
        candle("2026-09-16T00:00:00Z", "605.0000", "612.5000", "604.5000", "611.2500", 12_345_678),
        candle("2026-09-17T00:00:00Z", "611.2500", "615.0000", "608.7500", "609.0000", 999),
      ],
      [],
      COLORS,
    );
    expect(volume).toEqual([
      { time: "2026-09-16", value: 12_345_678, color: COLORS.up },
      { time: "2026-09-17", value: 999, color: COLORS.down },
    ]);
  });

  it("keeps volume the contract integer: no scaling, no decimal conversion", () => {
    const { volume } = toChartData(
      [
        candle("2026-09-16T00:00:00Z", "1", "2", "0.5", "1.5", 0),
        candle("2026-09-17T00:00:00Z", "1", "2", "0.5", "0.5", 1_234_567_890_123),
      ],
      [],
      COLORS,
    );
    expect(volume.map((bar) => bar.value)).toEqual([0, 1_234_567_890_123]);
  });

  it("has no bars when there are no candles", () => {
    expect(toChartData([], [sma(20, [null])], COLORS).volume).toEqual([]);
  });
});

describe("formatCandleReadout", () => {
  it("renders the hovered candle as one crosshair line", () => {
    expect(
      formatCandleReadout(candle("2026-09-22T00:00:00Z", "431.6000", "437.2000", "430.8000", "436.6000", 9_110_000)),
    ).toEqual({
      date: "2026-09-22",
      open: "431.6000",
      high: "437.2000",
      low: "430.8000",
      close: "436.6000",
      volume: "9.11M",
      direction: "up",
    });
  });

  it.each([
    ["close is above the open", "431.6000", "436.6000", "up"],
    ["close is below the open", "436.6000", "431.6000", "down"],
    ["candle is a doji", "431.6000", "431.6000", "flat"],
    ["fraction digits differ but it is still up", "431.6", "431.60001", "up"],
    ["fraction digits differ but it is still down", "431.60001", "431.6", "down"],
  ])("reports `flat` only when the %s", (_label, open, close, expected) => {
    const readout = formatCandleReadout(candle("2026-09-22T00:00:00Z", open, "437.2000", "430.8000", close));
    expect(readout.direction).toBe(expected);
  });

  it("passes the contract's decimal strings through, keeping every trailing zero", () => {
    const readout = formatCandleReadout(candle("2026-09-22T00:00:00Z", "0.0500", "1.0000", "0.0010", "0.0700"));
    expect([readout.open, readout.high, readout.low, readout.close]).toEqual([
      "0.0500",
      "1.0000",
      "0.0010",
      "0.0700",
    ]);
  });

  it("takes the date from the contract's UTC-midnight timestamp", () => {
    expect(formatCandleReadout(candle("2026-01-05T00:00:00Z", "1", "2", "0.5", "1.5")).date).toBe("2026-01-05");
  });

  it.each([
    [0, "0"],
    [999, "999"],
    [9_110_000, "9.11M"],
    [1_500_000_000, "1.5B"],
  ])("compacts volume %i to `%s` with formatAmount", (volume, expected) => {
    expect(formatCandleReadout(candle("2026-09-22T00:00:00Z", "1", "2", "0.5", "1.5", volume)).volume).toBe(expected);
  });
});

describe("crosshairDay", () => {
  it("reads the business-day object the chart library hands back, zero-padded", () => {
    expect(crosshairDay({ year: 2026, month: 9, day: 22 })).toBe("2026-09-22");
    expect(crosshairDay({ year: 2026, month: 12, day: 5 })).toBe("2026-12-05");
  });

  it("accepts a business-day string as well", () => {
    expect(crosshairDay("2026-09-22")).toBe("2026-09-22");
  });

  it("is undefined when the crosshair left the data, so the caller falls back to the last candle", () => {
    expect(crosshairDay(undefined)).toBeUndefined();
    // GP plots business days only; a timestamp scale has no contract candle to look up.
    expect(crosshairDay(1_790_000_000 as unknown as Time)).toBeUndefined();
  });
});
