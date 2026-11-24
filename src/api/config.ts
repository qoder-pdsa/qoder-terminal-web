/** Resolve a base URL from a build-time variable; unset, empty, or blank values fall back to the default. */
export function resolveBaseUrl(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

export const DATA_URL: string = resolveBaseUrl(import.meta.env.VITE_DATA_URL, "http://localhost:8081");
export const ANALYST_URL: string = resolveBaseUrl(import.meta.env.VITE_ANALYST_URL, "http://localhost:8082");

/** Whether this bundle was built as an isolated demo preview with no business backend. */
export function isolatedDemoFlag(value: string | undefined): boolean {
  return value?.trim() === "1";
}

/**
 * Stands in for a business-service call in an isolated preview. It carries the contract's 404 shape
 * so the existing error handling and the polling rule treat it as a refusal that will not change.
 */
export class PreviewBackendDisabled extends Error {
  readonly status = 404;
  readonly code = "PREVIEW_NO_BACKEND";
  constructor() {
    super("isolated demo preview: no business backend");
    this.name = "PreviewBackendDisabled";
  }
}

export const ISOLATED_DEMO: boolean = isolatedDemoFlag(import.meta.env.VITE_ISOLATED_DEMO);

/** The app's only fetch boundary: an isolated preview bundle never reaches a business service. */
export function previewFetch(url: string, init?: RequestInit, isolated: boolean = ISOLATED_DEMO): Promise<Response> {
  return isolated ? Promise.reject(new PreviewBackendDisabled()) : fetch(url, init);
}
