import { useEffect, useState } from "react";
import { fetchNews, fetchWatchlists, type NewsItem } from "../api/data";
import { loadMergedNews } from "./newsFeeds";
import { DEFAULT_NEWS_SYMBOLS, MAX_NEWS_SYMBOLS, relativeTime } from "./newsFormat";

const PER_SYMBOL_LIMIT = 20;
const MERGED_PER_SYMBOL_LIMIT = 10;

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; items: NewsItem[] };

/** `700 N` lists one symbol's news; a bare `N` merges the first watchlist group (or the defaults). */
export function NewsPanel({ symbol }: { symbol?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    const load = symbol
      ? fetchNews(symbol, PER_SYMBOL_LIMIT, controller.signal)
      : mergedNews(controller.signal);
    load
      .then((items) => setState({ status: "ok", items }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") return <p className="muted">LOADING NEWS{symbol ? ` ${symbol}` : ""}…</p>;
  if (state.status === "error") return <p className="down" data-testid="news-error">ERROR: {state.message}</p>;
  if (state.items.length === 0) return <p className="muted" data-testid="news-empty">NO NEWS{symbol ? ` FOR ${symbol}` : ""}</p>;

  const now = new Date();
  return (
    <ul className="news-list" data-testid="news-panel">
      {state.items.map((item) => (
        <li key={item.url} data-testid="news-item">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.headline}
          </a>
          <div className="muted news-meta">
            {item.source} · {(item.symbols ?? []).join(" ")} · {relativeTime(item.publishedAt, now)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Merged news for the first watchlist group, fetched a bounded number of symbols at a time. */
async function mergedNews(signal: AbortSignal): Promise<NewsItem[]> {
  const symbols = await watchlistSymbols(signal);
  return loadMergedNews(symbols, MERGED_PER_SYMBOL_LIMIT, fetchNews, signal);
}

/** Symbols of the first watchlist group, falling back to the defaults. */
async function watchlistSymbols(signal: AbortSignal): Promise<string[]> {
  try {
    const lists = await fetchWatchlists(signal);
    const symbols = lists[0]?.symbols.map((s) => s.symbol) ?? [];
    if (symbols.length > 0) return symbols.slice(0, MAX_NEWS_SYMBOLS);
  } catch {
    // The watchlist is a convenience for choosing symbols; news must still show without it.
  }
  return [...DEFAULT_NEWS_SYMBOLS];
}
