import { DATA_URL } from "./config";

/** Mirrors Quote in qoder-terminal-data/api/openapi.yaml; numbers are decimal strings. */
export interface Quote {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  currency: string;
  asOf: string;
}

export async function fetchQuote(symbol: string, signal?: AbortSignal): Promise<Quote> {
  const resp = await fetch(`${DATA_URL}/v1/quotes/${encodeURIComponent(symbol)}`, { signal });
  if (!resp.ok) {
    const body = (await resp.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `HTTP ${resp.status}`);
  }
  return (await resp.json()) as Quote;
}
