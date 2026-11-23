/** Resolve a base URL from a build-time variable; unset, empty, or blank values fall back to the default. */
export function resolveBaseUrl(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

/**
 * The synthetic API root a preview carries with itself, or null for every other build. A preview is served by
 * the production gateway, whose `/api/*` routes proxy to the real services, so a preview must read the fixtures
 * emitted next to its own bundle (`preview/synthetic.ts`) instead of the configured backend.
 */
export function previewSyntheticBase(base: string): string | null {
  return base.startsWith("/preview/") ? `${base.replace(/\/+$/, "")}/synthetic` : null;
}

export interface ApiBaseUrls {
  data: string;
  analyst: string;
}

/** The two API bases a build talks to: the bundled synthetic ones inside a preview, the configured ones elsewhere. */
export function apiBaseUrls(base: string, env: { dataUrl?: string; analystUrl?: string }): ApiBaseUrls {
  const synthetic = previewSyntheticBase(base);
  if (synthetic) return { data: `${synthetic}/data`, analyst: `${synthetic}/analyst` };
  return {
    data: resolveBaseUrl(env.dataUrl, "http://localhost:8081"),
    analyst: resolveBaseUrl(env.analystUrl, "http://localhost:8082"),
  };
}

const bases = apiBaseUrls(import.meta.env.BASE_URL, {
  dataUrl: import.meta.env.VITE_DATA_URL,
  analystUrl: import.meta.env.VITE_ANALYST_URL,
});

export const DATA_URL: string = bases.data;
export const ANALYST_URL: string = bases.analyst;
