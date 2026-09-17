import { DATA_URL } from "./config";

/** 与 qoder-terminal-data/api/openapi.yaml Quote 对齐，数值均为十进制字符串。 */
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
