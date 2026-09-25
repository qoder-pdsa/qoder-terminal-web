import type { Quote, Watchlist } from "../api/data";

export type FlashDirection = "up" | "down";

/** Refresh interval of the W panel's batch quote poll. */
export const WATCHLIST_POLL_MS = 5_000;

/**
 * Compare two contract decimal strings without going through floating point:
 * scale both to the same number of fraction digits and compare as BigInt.
 */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const [ua, ub] = scaled(a, b);
  return ua < ub ? -1 : ua > ub ? 1 : 0;
}

function scaled(a: string, b: string): [bigint, bigint] {
  const [ia, fa = ""] = a.split(".");
  const [ib, fb = ""] = b.split(".");
  const digits = Math.max(fa.length, fb.length);
  return [BigInt(ia + fa.padEnd(digits, "0")), BigInt(ib + fb.padEnd(digits, "0"))];
}

/** Which symbols moved between two polls; the first poll flashes nothing. */
export function flashDirections(
  prev: readonly Quote[] | null,
  next: readonly Quote[],
): Record<string, FlashDirection> {
  if (!prev) return {};
  const before = new Map(prev.map((q) => [q.symbol, q.price]));
  const flashes: Record<string, FlashDirection> = {};
  for (const q of next) {
    const old = before.get(q.symbol);
    if (old === undefined) continue;
    const cmp = compareDecimal(q.price, old);
    if (cmp !== 0) flashes[q.symbol] = cmp > 0 ? "up" : "down";
  }
  return flashes;
}

/** The group to show: the selected id when it exists, otherwise the first group. */
export function selectGroup(lists: readonly Watchlist[], selectedId: string | null): Watchlist | null {
  return lists.find((l) => l.id === selectedId) ?? lists[0] ?? null;
}

/** The sortable columns; CHANGE sorts on the percentage, not the absolute change. */
export type SortKey = "price" | "changePercent";
export type SortDirection = "descending" | "ascending";
export type AriaSort = SortDirection | "none";

export interface WatchlistSort {
  key: SortKey;
  direction: SortDirection;
}

/** One row of the W table: the watched symbol plus its quote, `null` while the quote is still `…`. */
export interface WatchlistRow {
  symbol: string;
  name: string;
  quote: Quote | null;
}

/**
 * Orders the rows for the current sort without touching the input. A row whose quote has not
 * arrived has no number to compare and stays last in both directions; `sort` is stable, so equal
 * values keep the watchlist's own order.
 */
export function sortRows(rows: readonly WatchlistRow[], sort: WatchlistSort | null): WatchlistRow[] {
  if (!sort) return [...rows];
  return [...rows].sort((a, b) => {
    const left = a.quote?.[sort.key];
    const right = b.quote?.[sort.key];
    if (left === undefined && right === undefined) return 0;
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    const cmp = compareDecimal(left, right);
    return sort.direction === "descending" ? -cmp : cmp;
  });
}

/** A header click: the first click sorts descending, the next one flips, another key restarts. */
export function nextSort(current: WatchlistSort | null, key: SortKey): WatchlistSort {
  const direction: SortDirection =
    current?.key === key && current.direction === "descending" ? "ascending" : "descending";
  return { key, direction };
}

/** `aria-sort` of one header: only the sorted key reports a direction. */
export function ariaSort(sort: WatchlistSort | null, key: SortKey): AriaSort {
  return sort?.key === key ? sort.direction : "none";
}
