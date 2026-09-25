import { useEffect, useState } from "react";
import { fetchQuotes, fetchWatchlists, type Quote, type Watchlist } from "../api/data";
import { shouldKeepPolling } from "./polling";
import { formatChange } from "./quoteFormat";
import {
  ariaSort,
  flashDirections,
  nextSort,
  selectGroup,
  sortRows,
  WATCHLIST_POLL_MS,
  type AriaSort,
  type FlashDirection,
  type SortKey,
  type WatchlistRow,
  type WatchlistSort,
} from "./watchlistState";

type ListsState = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; lists: Watchlist[] };

interface QuotesState {
  quotes: Quote[] | null;
  flashes: Record<string, FlashDirection>;
  tick: number;
  error: string | null;
}

const INITIAL_QUOTES: QuotesState = { quotes: null, flashes: {}, tick: 0, error: null };

const SORT_ARROWS: Record<AriaSort, string> = { descending: " ▼", ascending: " ▲", none: "" };

interface SortHeaderProps {
  label: string;
  testId: string;
  column: SortKey;
  sort: WatchlistSort | null;
  onSort: (key: SortKey) => void;
}

/** A clickable PRICE / CHANGE column header; only the sorted one carries a direction. */
function SortHeader({ label, testId, column, sort, onSort }: SortHeaderProps) {
  const state = ariaSort(sort, column);
  return (
    <th
      className="num sortable"
      data-testid={testId}
      aria-sort={state}
      tabIndex={0}
      onClick={() => onSort(column)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSort(column);
        }
      }}
    >
      {label}
      {SORT_ARROWS[state]}
    </th>
  );
}

/** Watchlist groups with live prices; the quotes of the shown group are re-polled every few seconds. */
export function WatchlistPanel({ onOpen }: { onOpen: (command: string) => void }) {
  const [lists, setLists] = useState<ListsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<QuotesState>(INITIAL_QUOTES);
  const [sort, setSort] = useState<WatchlistSort | null>(null);

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
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = () =>
      fetchQuotes(symbols, controller.signal)
        .then((next) =>
          setQuotes((prev) => ({ quotes: next, flashes: flashDirections(prev.quotes, next), tick: prev.tick + 1, error: null })),
        )
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            const message = err instanceof Error ? err.message : String(err);
            // A group the data service cannot resolve will not resolve later either.
            if (!shouldKeepPolling(err)) clearInterval(timer);
            setQuotes((prev) => ({ ...prev, error: message }));
          }
        });
    void poll();
    timer = setInterval(() => void poll(), WATCHLIST_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [symbolsKey]);

  if (lists.status === "loading") return <p className="muted">LOADING WATCHLISTS…</p>;
  if (lists.status === "error") return <p className="down" data-testid="watchlist-error">ERROR: {lists.message}</p>;
  if (!group) return <p className="muted" data-testid="watchlist-empty">NO WATCHLIST GROUPS</p>;

  const bySymbol = new Map((quotes.quotes ?? []).map((q) => [q.symbol, q]));
  const rows: WatchlistRow[] = group.symbols.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    quote: bySymbol.get(s.symbol) ?? null,
  }));
  // Derived per render, so the 5 s poll re-sorts the rows as prices move.
  const ordered = sortRows(rows, sort);
  const onSort = (key: SortKey) => setSort((prev) => nextSort(prev, key));

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
          <thead>
            <tr className="muted">
              <th>SYMBOL</th>
              <th>NAME</th>
              <SortHeader label="PRICE" testId="sort-price" column="price" sort={sort} onSort={onSort} />
              <SortHeader
                label="CHANGE"
                testId="sort-change"
                column="changePercent"
                sort={sort}
                onSort={onSort}
              />
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const q = r.quote;
              const change = q ? formatChange(q.change, q.changePercent) : null;
              return (
                <tr key={r.symbol} data-testid="watchlist-row" onClick={() => onOpen(`${r.symbol} Q`)}>
                  <td className="symbol">{r.symbol}</td>
                  <td className="muted name">{r.name}</td>
                  <td className="num">
                    <span
                      key={`${r.symbol}-${quotes.tick}`}
                      className="price"
                      data-testid="watchlist-price"
                      data-flash={quotes.flashes[r.symbol]}
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
