import type { NewsItem } from "../api/data";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Symbols `N` falls back to when the watchlist is unavailable or empty. */
export const DEFAULT_NEWS_SYMBOLS = ["700.HK", "9988.HK", "3690.HK", "1810.HK"] as const;

/** How many symbols a symbol-less `N` merges; each one is a separate upstream call. */
export const MAX_NEWS_SYMBOLS = 6;

/** Coarse "3h ago" wording; anything in the future (clock skew) reads as "just now". */
export function relativeTime(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const elapsed = now.getTime() - then;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  return `${Math.floor(elapsed / DAY)}d ago`;
}

/** Merge per-symbol feeds: one entry per url with the union of symbols, newest first. */
export function mergeNews(feeds: readonly (readonly NewsItem[])[]): NewsItem[] {
  const byUrl = new Map<string, NewsItem>();
  for (const feed of feeds) {
    for (const item of feed) {
      const seen = byUrl.get(item.url);
      byUrl.set(
        item.url,
        seen ? { ...seen, symbols: [...new Set([...(seen.symbols ?? []), ...(item.symbols ?? [])])] } : { ...item },
      );
    }
  }
  return [...byUrl.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
