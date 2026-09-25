import { describe, expect, it } from "vitest";
import type { NewsItem } from "../api/data";
import { NEWS_CONCURRENCY, loadMergedNews, type NewsFetcher } from "./newsFeeds";

const SIGNAL = new AbortController().signal;
const GROUP = ["700.HK", "9988.HK", "3690.HK", "1810.HK", "1211.HK", "2800.HK"];

function item(symbol: string, id: string, publishedAt: string): NewsItem {
  return { id, headline: `headline ${id}`, source: "Longbridge", url: `https://n/${id}`, symbols: [symbol], publishedAt };
}

/**
 * A fake feed fetcher that yields once before settling, so every call it is given really overlaps and
 * the peak number in flight is observable. Feeds are keyed by symbol; an Error makes that symbol fail.
 */
function fakeFetcher(feeds: Record<string, NewsItem[] | Error>) {
  const seen = { inFlight: 0, peak: 0, asked: [] as string[], limits: [] as number[], signals: [] as AbortSignal[] };
  const fetchFeed: NewsFetcher = async (symbol, limit, signal) => {
    seen.asked.push(symbol);
    seen.limits.push(limit);
    seen.signals.push(signal);
    seen.peak = Math.max(seen.peak, ++seen.inFlight);
    await null;
    seen.inFlight--;
    const feed = feeds[symbol];
    if (feed instanceof Error) throw feed;
    return feed;
  };
  return { seen, fetchFeed };
}

function oneItemPerSymbol(symbols: readonly string[]): Record<string, NewsItem[]> {
  return Object.fromEntries(symbols.map((s, i) => [s, [item(s, `${s}-${i}`, `2026-09-25T0${i}:00:00Z`)]]));
}

describe("loadMergedNews", () => {
  it("keeps at most NEWS_CONCURRENCY feeds in flight", async () => {
    const { seen, fetchFeed } = fakeFetcher(oneItemPerSymbol(GROUP));
    const merged = await loadMergedNews(GROUP, 10, fetchFeed, SIGNAL);

    expect(seen.peak).toBeLessThanOrEqual(NEWS_CONCURRENCY);
    expect(seen.asked).toHaveLength(GROUP.length);
    expect([...seen.asked].sort()).toEqual([...GROUP].sort());
    expect(merged).toHaveLength(GROUP.length);
  });

  it("merges every symbol's feed, newest first", async () => {
    const { fetchFeed } = fakeFetcher({
      "700.HK": [item("700.HK", "old", "2026-09-25T05:00:00Z")],
      "9988.HK": [item("9988.HK", "new", "2026-09-25T09:00:00Z")],
    });
    const merged = await loadMergedNews(["700.HK", "9988.HK"], 10, fetchFeed, SIGNAL);
    expect(merged.map((n) => n.id)).toEqual(["new", "old"]);
  });

  it("drops a feed that fails and keeps the others", async () => {
    const { fetchFeed } = fakeFetcher({
      "700.HK": new Error("502 provider_error"),
      "9988.HK": [item("9988.HK", "kept", "2026-09-25T09:00:00Z")],
      "3690.HK": [item("3690.HK", "also-kept", "2026-09-25T08:00:00Z")],
    });
    const merged = await loadMergedNews(["700.HK", "9988.HK", "3690.HK"], 10, fetchFeed, SIGNAL);
    expect(merged.map((n) => n.id)).toEqual(["kept", "also-kept"]);
  });

  it("surfaces the first symbol's failure when every feed fails", async () => {
    const first = new Error("429 request rate limit");
    const { fetchFeed } = fakeFetcher({ "700.HK": first, "9988.HK": new Error("500 upstream") });
    await expect(loadMergedNews(["700.HK", "9988.HK"], 10, fetchFeed, SIGNAL)).rejects.toBe(first);
  });

  it("throws without fetching when there are no symbols", async () => {
    const { seen, fetchFeed } = fakeFetcher({});
    await expect(loadMergedNews([], 10, fetchFeed, SIGNAL)).rejects.toThrow("no news feeds available");
    expect(seen.asked).toEqual([]);
  });

  it("passes the caller's limit and abort signal to every feed", async () => {
    const { seen, fetchFeed } = fakeFetcher(oneItemPerSymbol(GROUP));
    await loadMergedNews(GROUP, 7, fetchFeed, SIGNAL);
    expect(seen.limits).toEqual(GROUP.map(() => 7));
    expect(seen.signals).toEqual(GROUP.map(() => SIGNAL));
  });
});
