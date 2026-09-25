import { useEffect, useState } from "react";
import { fetchQuotes, fetchWatchlists, type Quote, type Watchlist } from "../api/data";
import { formatChange } from "./quoteFormat";
import { flashDirections, selectGroup, WATCHLIST_POLL_MS, type FlashDirection } from "./watchlistState";

type ListsState = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; lists: Watchlist[] };

interface QuotesState {
  quotes: Quote[] | null;
  flashes: Record<string, FlashDirection>;
  tick: number;
  error: string | null;
}

const INITIAL_QUOTES: QuotesState = { quotes: null, flashes: {}, tick: 0, error: null };

/** Watchlist groups with live prices; the quotes of the shown group are re-polled every few seconds. */
export function WatchlistPanel({ onOpen }: { onOpen: (command: string) => void }) {
  const [lists, setLists] = useState<ListsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuotesState>(INITIAL_QUOTES);

  useEffect(() => {
    const controller = new AbortController();
    fetchWatchlists(controller.signal)
      .then((data) => setLists({ status: "ok", lists: data }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setLists({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => controller.abort();
  }, []);

  const group = lists.status === "ok" ? selectGroup(lists.lists, selectedId) : null;
  const symbolsKey = group?.symbols.map((s) => s.symbol).join(",") ?? "";

  useEffect(() => {
    if (symbolsKey === "") return;
    const symbols = symbolsKey.split(",");
    const controller = new AbortController();
    setQuotes(INITIAL_QUOTES);
    const poll = () =>
      fetchQuotes(symbols, controller.signal)
        .then((next) =>
          setQuotes((prev) => ({ quotes: next, flashes: flashDirections(prev.quotes, next), tick: prev.tick + 1, error: null })),
        )
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setQuotes((prev) => ({ ...prev, error: err instanceof Error ? err.message : String(err) }));
          }
        });
    void poll();
    const timer = setInterval(() => void poll(), WATCHLIST_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [symbolsKey]);

  if (lists.status === "loading") return <p className="muted">LOADING WATCHLISTS…</p>;
  if (lists.status === "error") return <p className="down" data-testid="watchlist-error">ERROR: {lists.message}</p>;
  if (!group) return <p className="muted" data-testid="watchlist-empty">NO WATCHLIST GROUPS</p>;

  const bySymbol = new Map((quotes.quotes ?? []).map((q) => [q.symbol, q]));
  return (
    <div data-testid="watchlist-panel">
      {lists.lists.length > 1 && (
        <div className="panel-toolbar">
          {lists.lists.map((l) => (
            <button
              key={l.id}
              type="button"
              data-testid={`watchlist-group-${l.id}`}
              aria-pressed={l.id === group.id}
              onClick={() => setSelectedId(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
      {quotes.error && <p className="down" data-testid="watchlist-quotes-error">ERROR: {quotes.error}</p>}
      {group.symbols.length === 0 ? (
        <p className="muted" data-testid="watchlist-empty">EMPTY GROUP {group.name}</p>
      ) : (
        <table className="watchlist">
          <tbody>
            {group.symbols.map((s) => {
              const q = bySymbol.get(s.symbol);
              const change = q ? formatChange(q.change, q.changePercent) : null;
              return (
                <tr key={s.symbol} data-testid="watchlist-row" onClick={() => onOpen(`${s.symbol} Q`)}>
                  <td className="symbol">{s.symbol}</td>
                  <td className="muted name">{s.name}</td>
                  <td className="num">
                    <span
                      key={`${s.symbol}-${quotes.tick}`}
                      className="price"
                      data-testid="watchlist-price"
                      data-flash={quotes.flashes[s.symbol]}
                    >
                      {q ? q.price : "…"}
                    </span>
                  </td>
                  <td className="num quote-change" data-direction={change?.direction} data-testid="watchlist-change">
                    {change ? change.text : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
