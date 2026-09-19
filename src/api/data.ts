import { DATA_URL } from "./config";

/** Mirrors Quote in qoder-terminal-data/api/openapi.yaml; numbers are decimal strings. */
export interface Quote {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  currency: string;
  asOf: string;
}

/** Mirrors the `range` query parameter in qoder-terminal-data/api/openapi.yaml. */
export const HISTORY_RANGES = ["1M", "3M", "6M", "1Y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
export const DEFAULT_HISTORY_RANGE: HistoryRange = "3M";

/** Mirrors Candle; the contract's `time` is UTC midnight of the trading day. */
export interface Candle {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

/** Mirrors IndicatorSeries; `value` is null until the window is filled. */
export interface IndicatorPoint {
  time: string;
  value: string | null;
}

export interface IndicatorSeries {
  symbol: string;
  kind: IndicatorKind;
  window: number;
  points: IndicatorPoint[];
}

export type IndicatorKind = "sma" | "ema" | "rsi";

/** Map the contract's Error body onto a thrown Error, falling back to the HTTP status. */
async function apiError(resp: Response): Promise<Error> {
  const body = (await resp.json().catch(() => null)) as { message?: string } | null;
  return new Error(body?.message ?? `HTTP ${resp.status}`);
}

export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  const resp = await fetch(`${DATA_URL}/v1/quotes/${encodeURIComponent(symbol)}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as Quote;
}

export async function fetchHistory(
  symbol: string,
  range: HistoryRange,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const query = new URLSearchParams({ range });
  const resp = await fetch(`${DATA_URL}/v1/history/${encodeURIComponent(symbol)}?${query}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as Candle[];
}

export async function fetchIndicator(
  symbol: string,
  kind: IndicatorKind,
  window: number,
  range: HistoryRange,
  signal?: AbortSignal,
): Promise<IndicatorSeries> {
  const query = new URLSearchParams({ kind, window: String(window), range });
  const resp = await fetch(`${DATA_URL}/v1/indicators/${encodeURIComponent(symbol)}?${query}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as IndicatorSeries;
}
