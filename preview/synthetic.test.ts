import { describe, expect, it } from "vitest";
import { emitsSyntheticApi, SYNTHETIC_FIXTURES, SYNTHETIC_ROOT, syntheticAssets } from "./synthetic";
import type { CapitalFlow, Intraday, NewsItem, Quote, Watchlist } from "../src/api/data";

/**
 * The paths a preview build can request and answer. The app builds them in src/api/data.ts, and the production
 * gateway serves anything under /preview/<slug>/ from the published bundle, so a missing fixture would fall back
 * to index.html and a panel would parse HTML as JSON. The batch collection `data/v1/quotes` is deliberately
 * absent: its path is the directory holding `data/v1/quotes/<symbol>`, which one filesystem cannot express.
 */
const REQUESTED_PATHS = [
  "data/v1/quotes/700.HK",
  "data/v1/quotes/9988.HK",
  "data/v1/intraday/700.HK",
  "data/v1/intraday/9988.HK",
  "data/v1/history/700.HK",
  "data/v1/history/9988.HK",
  "data/v1/indicators/700.HK",
  "data/v1/indicators/9988.HK",
  "data/v1/capital-flow/700.HK",
  "data/v1/capital-flow/9988.HK",
  "data/v1/news",
  "data/v1/watchlists",
];

/** Every string value in every fixture, with the key and path it came from. */
function strings(
  value: unknown,
  at: string,
  key: string,
  out: { at: string; key: string; value: string }[] = [],
): { at: string; key: string; value: string }[] {
  if (typeof value === "string") out.push({ at, key, value });
  else if (Array.isArray(value)) value.forEach((item, i) => strings(item, `${at}[${i}]`, key, out));
  else if (value !== null && typeof value === "object") {
    for (const [k, item] of Object.entries(value)) strings(item, `${at}.${k}`, k, out);
  }
  return out;
}

/** The contract's decimal-string fields; everything else (symbols, timestamps, headlines) is not a price. */
const PRICE_FIELDS = new Set([
  "price",
  "open",
  "high",
  "low",
  "close",
  "prevClose",
  "avgPrice",
  "change",
  "changePercent",
  "turnover",
  "inflow",
  "large",
  "medium",
  "small",
  "value",
]);

describe("emitsSyntheticApi", () => {
  it("is true for a preview base, which is the only build that must not reach the real backend", () => {
    expect(emitsSyntheticApi("/preview/demo-10082-20261123091900/")).toBe(true);
    expect(emitsSyntheticApi("/preview/main/")).toBe(true);
  });

  it("is false for every other base, so production and dev bundles stay exactly as they are", () => {
    expect(emitsSyntheticApi("/")).toBe(false);
    expect(emitsSyntheticApi("")).toBe(false);
    expect(emitsSyntheticApi("/terminal/")).toBe(false);
    expect(emitsSyntheticApi("https://qoder.live/")).toBe(false);
  });
});

describe("syntheticAssets", () => {
  it("emits one asset per fixture under the synthetic root", () => {
    const assets = syntheticAssets();
    expect(assets).toHaveLength(Object.keys(SYNTHETIC_FIXTURES).length);
    expect(assets.map((a) => a.fileName).sort()).toEqual(
      Object.keys(SYNTHETIC_FIXTURES)
        .map((path) => `${SYNTHETIC_ROOT}/${path}`)
        .sort(),
    );
    expect(SYNTHETIC_ROOT).toBe("synthetic");
  });

  it("covers every path a preview can request", () => {
    expect(Object.keys(SYNTHETIC_FIXTURES).sort()).toEqual([...REQUESTED_PATHS].sort());
  });

  it("covers every symbol the watchlist offers, so a row click never dead-ends", () => {
    const lists = SYNTHETIC_FIXTURES["data/v1/watchlists"] as Watchlist[];
    expect(lists).toHaveLength(1);
    expect(lists[0].symbols.length).toBeGreaterThan(0);
    for (const { symbol } of lists[0].symbols) {
      for (const endpoint of ["quotes", "intraday", "history", "indicators", "capital-flow"]) {
        expect(SYNTHETIC_FIXTURES[`data/v1/${endpoint}/${symbol}`], `${endpoint} ${symbol}`).toBeDefined();
      }
    }
  });

  it("never emits a path that is also a directory of another path, which a filesystem cannot hold", () => {
    const paths = syntheticAssets().map((asset) => asset.fileName);
    for (const path of paths) {
      expect(paths.filter((other) => other.startsWith(`${path}/`)), path).toEqual([]);
    }
    // The batch quotes collection is the one endpoint that would collide, and it stays out.
    expect(paths).not.toContain(`${SYNTHETIC_ROOT}/data/v1/quotes`);
  });

  it("emits valid JSON text and is deterministic", () => {
    const first = syntheticAssets();
    for (const asset of first) {
      expect(() => JSON.parse(asset.source), asset.fileName).not.toThrow();
      expect(asset.source.length).toBeGreaterThan(2);
    }
    expect(syntheticAssets()).toEqual(first);
  });

  it("keeps prices as contract decimal strings, never floats, exponents or residue", () => {
    for (const [path, body] of Object.entries(SYNTHETIC_FIXTURES)) {
      for (const { at, key, value } of strings(body, path, path)) {
        if (!PRICE_FIELDS.has(key)) continue;
        // A price field is a plain decimal string: no exponent, no float residue, no dangling point.
        expect(value, at).not.toMatch(/e[+-]?\d/i);
        expect(value, at).not.toMatch(/NaN|Infinity|\.$/);
        expect(value, at).toMatch(/^-?\d+\.\d+$/);
        // The data service sends fixed scales: four decimals for prices, two for percentages and amounts.
        expect(value, at).toMatch(
          key === "changePercent" || /^(inflow|large|medium|small|turnover)$/.test(key)
            ? /^-?\d+\.\d{2}$/
            : /^-?\d+\.\d{4}$/,
        );
      }
    }
    const quote = SYNTHETIC_FIXTURES["data/v1/quotes/700.HK"] as Quote;
    expect(quote.currency).toBe("HKD");
    expect(Number.isInteger(quote.volume)).toBe(true);
  });

  it("carries no route, host or port of a real service", () => {
    for (const [path, body] of Object.entries(SYNTHETIC_FIXTURES)) {
      const text = JSON.stringify(body);
      for (const banned of ["/api/", "qoder.live", "localhost", ":8081", ":8082", ":8084", "longbridge"]) {
        expect(text, `${path} contains ${banned}`).not.toContain(banned);
      }
    }
  });

  it("keeps the news links on the reserved .invalid domain", () => {
    const news = SYNTHETIC_FIXTURES["data/v1/news"] as NewsItem[];
    expect(news.length).toBeGreaterThan(0);
    for (const item of news) expect(item.url).toMatch(/^https:\/\/[a-z0-9.-]+\.invalid\//);
  });

  it("answers the shapes the panels read", () => {
    const intraday = SYNTHETIC_FIXTURES["data/v1/intraday/700.HK"] as Intraday;
    expect(intraday.currency).toBe("HKD");
    expect(intraday.points.length).toBeGreaterThan(1);
    expect(intraday.points.every((p) => typeof p.price === "string" && typeof p.avgPrice === "string")).toBe(true);

    const flow = SYNTHETIC_FIXTURES["data/v1/capital-flow/700.HK"] as CapitalFlow;
    expect(flow.flow.length).toBeGreaterThan(1);
    for (const bucket of ["in", "out", "net"] as const) {
      for (const size of ["large", "medium", "small"] as const) {
        expect(flow.distribution[bucket][size]).toMatch(/^-?\d+\.\d{2}$/);
      }
    }

    const history = SYNTHETIC_FIXTURES["data/v1/history/700.HK"] as { time: string; close: string }[];
    expect(history.length).toBeGreaterThan(1);
    expect(history.map((c) => c.time)).toEqual([...history.map((c) => c.time)].sort());
    expect(history.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.time))).toBe(true);
  });
});
