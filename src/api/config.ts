/** Resolve a base URL from a build-time variable; unset, empty, or blank values fall back to the default. */
export function resolveBaseUrl(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

export const DATA_URL: string = resolveBaseUrl(import.meta.env.VITE_DATA_URL, "http://localhost:8081");
export const ANALYST_URL: string = resolveBaseUrl(import.meta.env.VITE_ANALYST_URL, "http://localhost:8082");
