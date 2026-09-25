import type { Intraday } from "../api/data";

export interface SeriesPoint {
  time: number;
  value: number;
}

export interface IntradayData {
  baseline: number;
  prices: SeriesPoint[];
  average: SeriesPoint[];
}

/** The one place an intraday decimal string becomes a number, for the chart only. */
function decimal(value: string): number {
  return Number(value);
}

function unixSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

/** Chart-ready series: the price line, the average-price line and the previous close as baseline. */
export function toIntradayData(intraday: Intraday): IntradayData {
  return {
    baseline: decimal(intraday.prevClose),
    prices: intraday.points.map((p) => ({ time: unixSeconds(p.time), value: decimal(p.price) })),
    average: intraday.points.map((p) => ({ time: unixSeconds(p.time), value: decimal(p.avgPrice) })),
  };
}
