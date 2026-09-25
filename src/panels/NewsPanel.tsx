import { useEffect, useState } from "react";
import { fetchNews, fetchWatchlists, type NewsItem } from "../api/data";
import { DEFAULT_NEWS_SYMBOLS, MAX_NEWS_SYMBOLS, mergeNews, relativeTime } from "./newsFormat";

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
      : loadMergedNews(controller.signal);
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

/** Symbols of the first watchlist group, falling back to the defaults; each symbol is one request. */
async function loadMergedNews(signal: AbortSignal): Promise<NewsItem[]> {
  const symbols = await watchlistSymbols(signal);
  const feeds = await Promise.allSettled(symbols.map((s) => fetchNews(s, MERGED_PER_SYMBOL_LIMIT, signal)));
  const ok = feeds.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length === 0) {
    const first = feeds.find((r) => r.status === "rejected");
    throw first && first.status === "rejected" ? first.reason : new Error("no news feeds available");
  }
  return mergeNews(ok);
}

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
