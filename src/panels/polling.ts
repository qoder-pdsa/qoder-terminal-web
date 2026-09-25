import { ApiError } from "../api/data";

/**
 * Whether a failed refresh is worth repeating.
 *
 * A 404 means the data service looked the symbol up and it does not exist, so every later poll is an
 * upstream call that cannot succeed. Anything else — a gateway 502, a rate limit, a dropped connection —
 * is transient, and the panel keeps polling with the last good data still on screen.
 */
export function shouldKeepPolling(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status !== 404 && error.code !== "not_found";
}
