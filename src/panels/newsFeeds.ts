import type { NewsItem } from "../api/data";
import { mergeNews } from "./newsFormat";

/** How many symbol feeds a bare `N` may have in flight at once; each one is a separate upstream call. */
export const NEWS_CONCURRENCY = 2;

/** One symbol's news feed. `fetchNews` in `../api/data` matches this exactly. */
export type NewsFetcher = (symbol: string, limit: number, signal: AbortSignal) => Promise<NewsItem[]>;

/**
 * Fetch one feed per symbol and merge them, at most `concurrency` at a time: a bare `N` used to
 * start all six requests at once and Longbridge answered the burst with HTTP 429, which the data
 * service surfaces as 502. A feed that fails is dropped so the panel still shows the rest; only when
 * every feed fails does the caller see an error, which is the first one in symbol order.
 */
export async function loadMergedNews(
  symbols: readonly string[],
  limit: number,
  fetchFeed: NewsFetcher,
  signal: AbortSignal,
  concurrency: number = NEWS_CONCURRENCY,
): Promise<NewsItem[]> {
  const feeds = new Array<PromiseSettledResult<NewsItem[]>>(symbols.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < symbols.length) {
      const i = next++;
      feeds[i] = await fetchFeed(symbols[i], limit, signal).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, symbols.length)) }, () => worker()));

  const ok = feeds.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length === 0) {
    const first = feeds.find((r) => r.status === "rejected");
    throw first && first.status === "rejected" ? first.reason : new Error("no news feeds available");
  }
  return mergeNews(ok);
}
