import type { Candle, CapitalFlow, IndicatorSeries, Intraday, NewsItem, Quote, Watchlist } from "../src/api/data";

/**
 * The synthetic API a preview bundle carries with itself (workitem 10082).
 *
 * The production gateway serves `/preview/<slug>/` from the published bundle and proxies `/api/*` to the real
 * data, analyst and user services. An acceptance preview must be readable in a normal browser without touching
 * them, so a preview build resolves its API base inside itself (`src/api/config.ts`) and these fixtures are
 * emitted next to the bundle by `vite.config.ts`. They are reviewed preview assets, not test-only interception:
 * a normal browser loads them over the same origin as the page.
 *
 * Shapes mirror `qoder-terminal-data/api/openapi.yaml` through the mirrored types in `src/api/data.ts`, so a
 * fixture that drifts from the contract fails `make lint`. Responses are keyed by path only, because the
 * gateway serves them as static files: query parameters (`range`, `window`, `limit`) do not vary a response,
 * the batch collection `GET /v1/quotes?symbols=…` has no fixture at all — its path is the directory that holds
 * `/v1/quotes/<symbol>`, which one filesystem cannot express — and `POST /v1/ask` needs an SSE stream a static
 * bundle cannot answer. Those three limits are documented in `docs/deployment.md`.
 */

export const SYNTHETIC_ROOT = "synthetic";

export interface SyntheticAsset {
  /** Bundle-relative output path, e.g. `synthetic/data/v1/quotes/700.HK`. */
  readonly fileName: string;
  /** The response body as JSON text. */
  readonly source: string;
}

/** Only a preview build carries the synthetic API; production and dev bundles emit nothing. */
export function emitsSyntheticApi(base: string): boolean {
  return base.startsWith("/preview/");
}

/** A decimal string from integer units, so a fixture price never passes through a float. */
function fixed(units: bigint, scale: 2 | 4): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const split = digits.length - scale;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

/** Trading day `i` of the synthetic history window, as the contract's UTC-midnight date. */
function day(i: number): string {
  return new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
}

const HISTORY_DAYS = 30;
const SMA_WINDOW = 20;
const SESSION_TIMES = ["09:30", "10:30", "11:30", "13:30", "14:30", "15:30"] as const;
const AS_OF = "2026-11-23T16:00:00+08:00";

/** The two symbols a preview demonstrates; prices are in units of 1e-4 HKD. */
const SYMBOLS = [
  {
    symbol: "700.HK",
    name: "Tencent (synthetic)",
    price: 5_124_000n,
    prevClose: 5_166_000n,
    open: 5_166_000n,
    high: 5_180_000n,
    low: 5_102_000n,
    change: -42_000n,
    changePercent: -81n,
    turnover: 946_170_000_000n,
    volume: 18_432_010,
    historyBase: 4_800_000n,
  },
  {
    symbol: "9988.HK",
    name: "Alibaba (synthetic)",
    price: 1_286_000n,
    prevClose: 1_297_500n,
    open: 1_297_500n,
    high: 1_301_000n,
    low: 1_282_000n,
    change: -11_500n,
    changePercent: -89n,
    turnover: 183_240_000_000n,
    volume: 32_145_600,
    historyBase: 1_210_000n,
  },
] as const;

function quote(entry: (typeof SYMBOLS)[number]): Quote {
  return {
    symbol: entry.symbol,
    price: fixed(entry.price, 4),
    change: fixed(entry.change, 4),
    changePercent: fixed(entry.changePercent, 2),
    open: fixed(entry.open, 4),
    high: fixed(entry.high, 4),
    low: fixed(entry.low, 4),
    volume: entry.volume,
    turnover: fixed(entry.turnover, 2),
    currency: "HKD",
    asOf: AS_OF,
  };
}

function history(entry: (typeof SYMBOLS)[number]): Candle[] {
  return Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const open = entry.historyBase + BigInt(i) * 12_000n;
    const close = open + 9_000n;
    return {
      time: day(i),
      open: fixed(open, 4),
      high: fixed(close + 15_000n, 4),
      low: fixed(open - 11_000n, 4),
      close: fixed(close, 4),
      volume: 12_000_000 + i * 137_000,
    };
  });
}

function indicator(entry: (typeof SYMBOLS)[number]): IndicatorSeries {
  const candles = history(entry);
  return {
    symbol: entry.symbol,
    kind: "sma",
    window: SMA_WINDOW,
    points: candles.map((candle, i) => ({
      time: candle.time,
      // The window is not filled yet, exactly as the contract describes for the first `window - 1` days.
      value:
        i < SMA_WINDOW - 1
          ? null
          : fixed(
              (entry.historyBase + BigInt(i) * 12_000n + entry.historyBase + BigInt(i - SMA_WINDOW + 1) * 12_000n) /
                2n,
              4,
            ),
    })),
  };
}

function intraday(entry: (typeof SYMBOLS)[number]): Intraday {
  return {
    symbol: entry.symbol,
    currency: "HKD",
    prevClose: fixed(entry.prevClose, 4),
    points: SESSION_TIMES.map((time, i) => ({
      time: `2026-11-23T${time}:00+08:00`,
      price: fixed(entry.price + BigInt(i) * 5_000n, 4),
      avgPrice: fixed(entry.prevClose - BigInt(i) * 2_000n, 4),
      volume: 1_000_000 + i * 137_000,
    })),
  };
}

function capitalFlow(entry: (typeof SYMBOLS)[number]): CapitalFlow {
  return {
    symbol: entry.symbol,
    currency: "HKD",
    asOf: AS_OF,
    flow: SESSION_TIMES.map((time, i) => ({
      time: `2026-11-23T${time}:00+08:00`,
      // Alternating inflow and outflow, in units of 1e-2 HKD.
      inflow: fixed((i % 2 === 0 ? 1n : -1n) * (12_000_000_000n + BigInt(i) * 900_000_000n), 2),
    })),
    distribution: {
      in: { large: "420000000.00", medium: "310000000.00", small: "180000000.00" },
      out: { large: "-390000000.00", medium: "-280000000.00", small: "-160000000.00" },
      net: { large: "30000000.00", medium: "30000000.00", small: "20000000.00" },
    },
  };
}

const NEWS: NewsItem[] = [
  {
    id: "preview-1",
    headline: "Synthetic preview headline A",
    summary: "Served by the preview bundle itself; no backend was contacted.",
    source: "PREVIEW-SYNTHETIC",
    url: "https://preview.invalid/a",
    symbols: ["700.HK"],
    publishedAt: "2026-11-23T08:00:00Z",
  },
  {
    id: "preview-2",
    headline: "Synthetic preview headline B",
    summary: "Served by the preview bundle itself; no backend was contacted.",
    source: "PREVIEW-SYNTHETIC",
    url: "https://preview.invalid/b",
    symbols: ["9988.HK"],
    publishedAt: "2026-11-23T06:30:00Z",
  },
  {
    id: "preview-3",
    headline: "Synthetic preview market wrap",
    summary: "Served by the preview bundle itself; no backend was contacted.",
    source: "PREVIEW-SYNTHETIC",
    url: "https://preview.invalid/wrap",
    symbols: ["700.HK", "9988.HK"],
    publishedAt: "2026-11-23T05:00:00Z",
  },
];

const WATCHLISTS: Watchlist[] = [
  {
    id: "preview-synthetic",
    name: "Preview Synthetic",
    symbols: SYMBOLS.map(({ symbol, name }) => ({ symbol, name })),
  },
];

const fixtures: Record<string, Quote | Candle[] | IndicatorSeries | Intraday | CapitalFlow | NewsItem[] | Watchlist[]> = {
  "data/v1/news": NEWS,
  "data/v1/watchlists": WATCHLISTS,
};
for (const entry of SYMBOLS) {
  fixtures[`data/v1/quotes/${entry.symbol}`] = quote(entry);
  fixtures[`data/v1/intraday/${entry.symbol}`] = intraday(entry);
  fixtures[`data/v1/history/${entry.symbol}`] = history(entry);
  fixtures[`data/v1/indicators/${entry.symbol}`] = indicator(entry);
  fixtures[`data/v1/capital-flow/${entry.symbol}`] = capitalFlow(entry);
}

/** Path under the synthetic root → response body. Insertion order is the emission order. */
export const SYNTHETIC_FIXTURES: Readonly<Record<string, unknown>> = fixtures;

/** The assets a preview build emits; empty for every other build. */
export function syntheticAssets(): SyntheticAsset[] {
  return Object.entries(SYNTHETIC_FIXTURES).map(([path, body]) => ({
    fileName: `${SYNTHETIC_ROOT}/${path}`,
    source: JSON.stringify(body),
  }));
}
