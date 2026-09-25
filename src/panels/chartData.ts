import type { Candle, IndicatorSeries } from "../api/data";
import { compareDecimal } from "./watchlistState";

/** A candle the chart library can plot: numbers, and a `YYYY-MM-DD` business day. */
export interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartOverlay {
  label: string;
  points: { time: string; value: number }[];
}

/** One volume histogram bar; `value` is the contract integer, never rescaled. */
export interface VolumeBar {
  time: string;
  value: number;
  color: string;
}

/** The stylesheet's up/down candle colors, which the canvas cannot read as `var()`. */
export interface VolumeColors {
  up: string;
  down: string;
}

export interface ChartData {
  candles: ChartCandle[];
  overlays: ChartOverlay[];
  volume: VolumeBar[];
}

/** The one place a contract decimal string becomes a number (AGENTS.md forbids `parseFloat` on prices). */
function decimal(value: string): number {
  return Number(value);
}

/** The contract's `time` is UTC midnight of the trading day; the chart wants the bare `YYYY-MM-DD`. */
function chartDate(iso: string): string {
  return iso.slice(0, 10);
}

/** A volume bar takes the candle's own direction color; a doji counts as up, as the candles do. */
export function volumeBarColor(open: string, close: string, colors: VolumeColors): string {
  return compareDecimal(close, open) >= 0 ? colors.up : colors.down;
}

/**
 * Convert contract payloads into chart-ready series: decimal strings to numbers, ISO timestamps
 * to business days, and the `null` points the contract emits before an indicator window is
 * filled are dropped so the overlay starts where it first has a value.
 */
export function toChartData(
  candles: readonly Candle[],
  overlays: readonly IndicatorSeries[],
  colors: VolumeColors,
): ChartData {
  return {
    candles: candles.map((candle) => ({
      time: chartDate(candle.time),
      open: decimal(candle.open),
      high: decimal(candle.high),
      low: decimal(candle.low),
      close: decimal(candle.close),
    })),
    overlays: overlays.map((series) => ({
      label: `${series.kind.toUpperCase()}${series.window}`,
      points: series.points.flatMap((point) =>
        point.value === null ? [] : [{ time: chartDate(point.time), value: decimal(point.value) }],
      ),
    })),
    volume: candles.map((candle) => ({
      time: chartDate(candle.time),
      value: candle.volume,
      color: volumeBarColor(candle.open, candle.close, colors),
    })),
  };
}
