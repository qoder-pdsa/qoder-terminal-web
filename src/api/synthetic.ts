import type { AgentEvent } from "./analyst";
import type {
  Candle,
  CapitalFlow,
  HistoryRange,
  IndicatorKind,
  IndicatorSeries,
  Intraday,
  NewsItem,
  Quote,
  Watchlist,
} from "./data";

/**
 * Deterministic contract-shaped data for synthetic preview builds (VITE_SYNTHETIC=1), so a plain
 * browser on a temporary preview renders a live-looking terminal without any backend. Every amount
 * is produced as a 4dp-scaled integer and formatted into a decimal string — no float ever carries
 * a price — and each symbol always yields the same numbers.
 */

/** FNV-1a over the text; the preview's only source of variety. */
function seedOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Format a non-negative 4dp-scaled integer as a contract decimal string. */
function d4(scaledValue: number): string {
  const text = String(scaledValue).padStart(5, "0");
  return `${text.slice(0, -4)}.${text.slice(-4)}`;
}

function sd4(scaledValue: number): string {
  return scaledValue < 0 ? `-${d4(-scaledValue)}` : d4(scaledValue);
}

function d2(hundredths: number): string {
  const text = String(Math.abs(hundredths)).padStart(3, "0");
  return `${hundredths < 0 ? "-" : ""}${text.slice(0, -2)}.${text.slice(-2)}`;
}

const CURRENCIES: Record<string, string> = { HK: "HKD", US: "USD", SH: "CNY", SZ: "CNY" };

function currencyOf(symbol: string): string {
  return CURRENCIES[symbol.split(".").pop() ?? ""] ?? "HKD";
}

/** Base price of a symbol as a 4dp-scaled integer in [100.0000, 999.9999]. */
function baseOf(symbol: string): number {
  return 1_000_000 + (seedOf(symbol) % 9_000_000);
}

/** Minute timestamp `i` minutes after the preview session's anchor, RFC 3339 UTC. */
function minuteAt(anchorMs: number, i: number): string {
  return `${new Date(anchorMs + i * 60_000).toISOString().slice(0, 19)}Z`;
}

const SESSION_ANCHOR_MS = Date.UTC(2026, 9, 26, 1, 30, 0);
const DAY_ANCHOR_MS = Date.UTC(2026, 9, 26);
const DAY_MS = 86_400_000;

export function syntheticQuote(symbol: string): Quote {
  const base = baseOf(symbol);
  const change = (seedOf(`${symbol}:change`) % 40_000) - 20_000;
  const price = base + change;
  const spread = (seedOf(`${symbol}:spread`) % 500) + 50;
  const volume = 1_000_000 + (seedOf(`${symbol}:volume`) % 12_000_000);
  // percent = change / open at 2dp; BigInt division truncates toward zero, so round half away
  // from zero explicitly to keep negative changes within half a unit.
  const num = BigInt(change) * 10_000n;
  const baseBig = BigInt(base);
  const hundredths = Number(num >= 0n ? (num + baseBig / 2n) / baseBig : (num - baseBig / 2n) / baseBig);
  // The session range must contain both the open and the last price, like the data service mock.
  const top = Math.max(base, price);
  const bottom = Math.min(base, price);
  return {
    symbol,
    price: d4(price),
    change: sd4(change),
    changePercent: d2(hundredths),
    open: d4(base),
    high: d4(top + spread),
    low: d4(bottom - spread),
    volume,
    turnover: d4(price * volume),
    currency: currencyOf(symbol),
    asOf: "2026-10-26T06:30:00Z",
  };
}

export function syntheticIntraday(symbol: string): Intraday {
  const base = baseOf(symbol);
  const price = syntheticQuote(symbol).price;
  let walk = 0;
  const walks = Array.from({ length: 30 }, (_, i) => {
    walk += ((seedOf(`${symbol}:m${i}`) % 2_000) - 1_000) | 0;
    return walk;
  });
  // Shift the walk so the line ends exactly at the quote's price; one preview, one last price.
  const offset = Number(price.replace(".", "")) - (base + walks[walks.length - 1]);
  let sum = 0;
  const points = walks.map((w, i) => {
    const point = base + w + offset;
    sum += point;
    return {
      time: minuteAt(SESSION_ANCHOR_MS, i),
      price: d4(point),
      avgPrice: d4(Math.trunc(sum / (i + 1))),
      volume: 10_000 + (seedOf(`${symbol}:v${i}`) % 90_000),
    };
  });
  return { symbol, currency: currencyOf(symbol), prevClose: d4(base), points };
}

export function syntheticHistory(symbol: string, range: HistoryRange): Candle[] {
  const days = range === "1M" ? 22 : range === "3M" ? 66 : range === "6M" ? 132 : 252;
  const base = baseOf(symbol);
  const price = syntheticQuote(symbol).price;
  let walk = 0;
  const walks = Array.from({ length: days }, (_, i) => {
    walk += ((seedOf(`${symbol}:d${i}`) % 4_000) - 2_000) | 0;
    return walk;
  });
  // Shift the series so the newest close equals the quote's price.
  const offset = Number(price.replace(".", "")) - (base + walks[days - 1]);
  return walks.map((w, i) => {
    const close = base + w + offset;
    const open = i === 0 ? close - ((seedOf(`${symbol}:o${i}`) % 2_000) - 1_000) : base + walks[i - 1] + offset;
    const high = Math.max(open, close) + (seedOf(`${symbol}:h${i}`) % 800);
    const low = Math.min(open, close) - (seedOf(`${symbol}:l${i}`) % 800);
    return {
      time: `${new Date(DAY_ANCHOR_MS - (days - 1 - i) * DAY_MS).toISOString().slice(0, 19)}Z`,
      open: d4(open),
      high: d4(high),
      low: d4(low),
      close: d4(close),
      volume: 1_000_000 + (seedOf(`${symbol}:dv${i}`) % 9_000_000),
    };
  });
}

export function syntheticIndicator(
  symbol: string,
  kind: IndicatorKind,
  window: number,
  range: HistoryRange,
): IndicatorSeries {
  const history = syntheticHistory(symbol, range);
  // Closes as 4dp-scaled integers; the window sum stays integer arithmetic.
  const closes = history.map((candle) => Number(candle.close.replace(".", "")));
  let sum = 0;
  const points = history.map((candle, i) => {
    sum += closes[i];
    if (i >= window) sum -= closes[i - window];
    const filled = i >= window - 1;
    return { time: candle.time, value: filled ? d4(Math.trunc(sum / window)) : null };
  });
  return { symbol, kind, window, points };
}

const HEADLINES = [
  "posts quarterly results ahead of consensus",
  "announces a share buyback programme",
  "expands its mainland distribution network",
  "names a new chief financial officer",
  "lifts its dividend after a record half",
];

export function syntheticNews(symbol: string, limit: number): NewsItem[] {
  return Array.from({ length: limit }, (_, i) => ({
    id: `syn-${symbol}-${i}`,
    headline: `${symbol} ${HEADLINES[i % HEADLINES.length]}`,
    summary: "Synthetic preview item; no real newsroom is behind this text.",
    source: "Synthetic Wire",
    url: `https://news.example/${symbol.toLowerCase()}/${i}`,
    symbols: [symbol],
    publishedAt: minuteAt(SESSION_ANCHOR_MS, -60 * (i + 1)),
  }));
}

export function syntheticWatchlists(): Watchlist[] {
  return [
    {
      id: "hk",
      name: "Hong Kong",
      symbols: [
        { symbol: "700.HK", name: "Tencent" },
        { symbol: "9988.HK", name: "Alibaba" },
        { symbol: "3690.HK", name: "Meituan" },
      ],
    },
    {
      id: "us",
      name: "US",
      symbols: [
        { symbol: "AAPL.US", name: "Apple" },
        { symbol: "MSFT.US", name: "Microsoft" },
      ],
    },
  ];
}

export function syntheticCapitalFlow(symbol: string): CapitalFlow {
  const base = baseOf(symbol);
  let walk = 0;
  const flow = Array.from({ length: 20 }, (_, i) => {
    walk += ((seedOf(`${symbol}:f${i}`) % 4_000) - 2_000) | 0;
    return { time: minuteAt(SESSION_ANCHOR_MS, i), inflow: sd4(walk * 100) };
  });
  const buckets = (tag: string) => ({
    large: d4(base % 900_000 + seedOf(`${symbol}:${tag}l`) % 100_000),
    medium: d4(base % 90_000 + seedOf(`${symbol}:${tag}m`) % 10_000),
    small: d4(base % 9_000 + seedOf(`${symbol}:${tag}s`) % 1_000),
  });
  const inn = buckets("in");
  const out = buckets("out");
  const sub = (a: string, b: string) =>
    Number(a.replace(".", "")) - Number(b.replace(".", ""));
  return {
    symbol,
    currency: currencyOf(symbol),
    asOf: "2026-10-26T06:30:00Z",
    flow,
    distribution: {
      in: inn,
      out,
      net: { large: sd4(sub(inn.large, out.large)), medium: sd4(sub(inn.medium, out.medium)), small: sd4(sub(inn.small, out.small)) },
    },
  };
}

/** A scripted analyst exchange so ASK demos work without a live LLM. */
export function syntheticAskEvents(question: string): AgentEvent[] {
  return [
    { type: "thinking", text: `Synthetic preview: planning an answer for "${question}".` },
    { type: "tool_call", tool: "quote", args: { symbol: "700.HK" } },
    { type: "tool_result", tool: "quote", ok: true, summary: "700.HK synthetic last price retrieved" },
    { type: "open_panel", command: "700 Q" },
    {
      type: "answer",
      markdown: `Synthetic answer for: ${question}. Every figure on this preview is simulated in the browser.`,
      citations: [{ title: "Synthetic quote reference", url: "https://example.com/synthetic/quote" }],
    },
  ];
}
