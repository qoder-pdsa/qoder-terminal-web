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
