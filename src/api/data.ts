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

/** Mirrors NewsItem. */
export interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  source: string;
  url: string;
  symbols?: string[];
  publishedAt: string;
}

/** Mirrors Watchlist. */
export interface WatchedSymbol {
  symbol: string;
  name: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: WatchedSymbol[];
}

/** Mirrors CapitalFlow; every amount is a decimal string. */
export interface CapitalFlowPoint {
  time: string;
  inflow: string;
}

export interface CapitalBuckets {
  large: string;
  medium: string;
  small: string;
}

export interface CapitalFlow {
  symbol: string;
  currency: string;
  asOf: string;
  flow: CapitalFlowPoint[];
  distribution: { in: CapitalBuckets; out: CapitalBuckets; net: CapitalBuckets };
}

/** Mirrors Intraday; `points` is empty before the first trade of the session. */
export interface IntradayPoint {
  time: string;
  price: string;
  avgPrice: string;
  volume: number;
}

export interface Intraday {
  symbol: string;
  currency: string;
  prevClose: string;
  points: IntradayPoint[];
}

/** The contract's `symbols` query takes at most this many symbols per call. */
export const MAX_BATCH_SYMBOLS = 20;

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

export async function fetchNews(symbol: string, limit: number, signal?: AbortSignal): Promise<NewsItem[]> {
  const query = new URLSearchParams({ symbol, limit: String(limit) });
  const resp = await fetch(`${DATA_URL}/v1/news?${query}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as NewsItem[];
}

/** One request for a whole watchlist group; the data service makes a single upstream call. */
export async function fetchQuotes(symbols: readonly string[], signal?: AbortSignal): Promise<Quote[]> {
  const query = new URLSearchParams({ symbols: symbols.slice(0, MAX_BATCH_SYMBOLS).join(",") });
  const resp = await fetch(`${DATA_URL}/v1/quotes?${query}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as Quote[];
}

export async function fetchWatchlists(signal?: AbortSignal): Promise<Watchlist[]> {
  const resp = await fetch(`${DATA_URL}/v1/watchlists`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as Watchlist[];
}

export async function fetchCapitalFlow(symbol: string, signal?: AbortSignal): Promise<CapitalFlow> {
  const resp = await fetch(`${DATA_URL}/v1/capital-flow/${encodeURIComponent(symbol)}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as CapitalFlow;
}

export async function fetchIntraday(symbol: string, signal?: AbortSignal): Promise<Intraday> {
  const resp = await fetch(`${DATA_URL}/v1/intraday/${encodeURIComponent(symbol)}`, { signal });
  if (!resp.ok) throw await apiError(resp);
  return (await resp.json()) as Intraday;
}
