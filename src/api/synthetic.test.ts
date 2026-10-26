import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCommand } from "../commands/parse";
import {
  syntheticAskEvents,
  syntheticCapitalFlow,
  syntheticHistory,
  syntheticIndicator,
  syntheticIntraday,
  syntheticNews,
  syntheticQuote,
  syntheticWatchlists,
} from "./synthetic";

const D4 = /^\d+\.\d{4}$/;
const SD4 = /^[+-]?\d+\.\d{4}$/;
const D2 = /^[+-]?\d+\.\d{2}$/;
const SYMBOL = /^[0-9A-Z]{1,20}\.(HK|US|SH|SZ)$/;

/** Decimal string to scaled BigInt so amounts are compared as fixed-point, never floats. */
function scaled(value: string): bigint {
  const [int, frac = ""] = value.replace(/^[+-]/, "").split(".");
  const scaled = BigInt(int + frac.padEnd(4, "0").slice(0, 4));
  return value.startsWith("-") ? -scaled : scaled;
}

describe("synthetic quote", () => {
  it("mirrors the contract shape with decimal strings", () => {
    const quote = syntheticQuote("700.HK");
    expect(quote.symbol).toBe("700.HK");
    for (const field of [quote.price, quote.change, quote.open, quote.high, quote.low, quote.turnover]) {
      expect(field).toMatch(D4);
    }
    expect(quote.changePercent).toMatch(D2);
    expect(Number.isInteger(quote.volume)).toBe(true);
    expect(quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("prices each market in its own currency", () => {
    expect(syntheticQuote("700.HK").currency).toBe("HKD");
    expect(syntheticQuote("AAPL.US").currency).toBe("USD");
    expect(syntheticQuote("600519.SH").currency).toBe("CNY");
  });

  it("is deterministic per symbol and distinct across symbols", () => {
    expect(syntheticQuote("700.HK")).toEqual(syntheticQuote("700.HK"));
    expect(syntheticQuote("700.HK").price).not.toBe(syntheticQuote("9988.HK").price);
  });
});

describe("synthetic intraday and history", () => {
  it("walks ascending minute points around a decimal prev close", () => {
    const intraday = syntheticIntraday("700.HK");
    expect(intraday.prevClose).toMatch(D4);
    expect(intraday.points.length).toBeGreaterThan(1);
    for (const point of intraday.points) {
      expect(point.price).toMatch(D4);
      expect(point.avgPrice).toMatch(D4);
      expect(Number.isInteger(point.volume)).toBe(true);
    }
    const times = intraday.points.map((p) => p.time);
    expect([...times].sort()).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it("lays daily candles on ascending UTC midnights", () => {
    const candles = syntheticHistory("700.HK", "3M");
    expect(candles.length).toBeGreaterThan(1);
    for (const candle of candles) {
      expect(candle.time).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
      for (const field of [candle.open, candle.high, candle.low, candle.close]) expect(field).toMatch(D4);
      expect(Number.isInteger(candle.volume)).toBe(true);
    }
    const times = candles.map((c) => c.time);
    expect([...times].sort()).toEqual(times);
  });

  it("answers indicators with decimal values over the same span", () => {
    const series = syntheticIndicator("700.HK", "sma", 20, "3M");
    expect(series.kind).toBe("sma");
    expect(series.window).toBe(20);
    expect(series.points.length).toBeGreaterThan(0);
    for (const point of series.points) {
      if (point.value !== null) expect(point.value).toMatch(D4);
    }
  });
});

describe("synthetic news, watchlists and capital flow", () => {
  it("lists outbound-linked news for the symbol", () => {
    const news = syntheticNews("700.HK", 5);
    expect(news).toHaveLength(5);
    for (const item of news) {
      expect(item.url).toMatch(/^https?:\/\//);
      expect(item.headline.length).toBeGreaterThan(0);
      expect(item.symbols).toContain("700.HK");
    }
  });

  it("groups watchlists of contract-valid symbols", () => {
    const lists = syntheticWatchlists();
    expect(lists.length).toBeGreaterThan(0);
    for (const list of lists) {
      expect(list.symbols.length).toBeGreaterThan(0);
      for (const watched of list.symbols) expect(watched.symbol).toMatch(SYMBOL);
    }
  });

  it("nets the capital flow distribution with fixed-point arithmetic", () => {
    const flow = syntheticCapitalFlow("700.HK");
    expect(flow.flow.length).toBeGreaterThan(0);
    for (const point of flow.flow) expect(point.inflow).toMatch(SD4);
    const { in: inn, out, net } = flow.distribution;
    for (const buckets of [inn, out, net]) {
      for (const value of [buckets.large, buckets.medium, buckets.small]) expect(value).toMatch(SD4);
    }
    expect(scaled(net.large)).toBe(scaled(inn.large) - scaled(out.large));
    expect(scaled(net.medium)).toBe(scaled(inn.medium) - scaled(out.medium));
    expect(scaled(net.small)).toBe(scaled(inn.small) - scaled(out.small));
  });
});

describe("synthetic analyst stream", () => {
  it("scripts a contract-shaped event sequence ending in a cited answer", () => {
    const events = syntheticAskEvents("compare Tencent and Alibaba");
    expect(events[0].type).toBe("thinking");
    expect(events.some((e) => e.type === "tool_call")).toBe(true);
    expect(events.some((e) => e.type === "open_panel")).toBe(true);
    const answer = events[events.length - 1];
    expect(answer.type).toBe("answer");
    if (answer.type === "answer") {
      expect(answer.markdown.length).toBeGreaterThan(0);
      expect(answer.citations.length).toBeGreaterThan(0);
      for (const citation of answer.citations) expect(citation.url).toMatch(/^https?:\/\//);
    }
    for (const event of events) {
      if (event.type === "open_panel") expect(parseCommand(event.command).kind).not.toBe("invalid");
    }
  });
});

describe("the synthetic gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("serves data in-process without any network call when VITE_SYNTHETIC=1", async () => {
    vi.stubEnv("VITE_SYNTHETIC", "1");
    const fetchSpy = vi.fn(() => {
      throw new Error("synthetic preview must not touch the network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const data = await import("./data");
    const analyst = await import("./analyst");

    const quote = await data.fetchQuote("700.HK");
    expect(quote.price).toMatch(D4);
    const intraday = await data.fetchIntraday("700.HK");
    expect(intraday.points.length).toBeGreaterThan(0);
    const flow = await data.fetchCapitalFlow("700.HK");
    expect(flow.distribution.net.large).toMatch(SD4);
    const lists = await data.fetchWatchlists();
    expect(lists.length).toBeGreaterThan(0);
    const events: unknown[] = [];
    for await (const event of analyst.ask("compare Tencent and Alibaba")) events.push(event);
    expect(events.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps the real fetch path when the flag is unset", async () => {
    const body = { ...syntheticQuote("700.HK") };
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const data = await import("./data");
    const quote = await data.fetchQuote("700.HK");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(quote).toEqual(body);
  });
});
