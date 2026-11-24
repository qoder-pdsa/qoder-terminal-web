import { isDemoPreviewBase, noBackendPath } from "./demoPreview";

/** Resolve a base URL from a build-time variable; unset, empty, or blank values fall back to the default. */
export function resolveBaseUrl(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

/** Whether the build was explicitly marked as an isolated demo preview with no business backend. */
export function isolatedDemoFlag(value: string | undefined): boolean {
  return value?.trim() === "1";
}

/**
 * Isolated when the build says so, or when the bundle is served from this work item's own demo preview:
 * the deployment host builds previews with tooling that predates the isolated mode and never sets the
 * flag, so the base path is the one signal the branch itself controls there.
 */
export function isolatedDemo(flag: string | undefined, base: string): boolean {
  return isolatedDemoFlag(flag) || isDemoPreviewBase(base);
}

/**
 * The business base URLs of one build. An isolated demo build points both at a path inside itself, which
 * the gateway serves statically, so nothing in the bundle can reach the shared production backend even
 * though the host's preview tooling injects `/api/data` and `/api/analyst` at build time.
 */
export function serviceUrls(
  isolated: boolean,
  base: string,
  dataUrl: string | undefined,
  analystUrl: string | undefined,
): { data: string; analyst: string } {
  if (isolated) {
    const noBackend = noBackendPath(base);
    return { data: noBackend, analyst: noBackend };
  }
  return {
    data: resolveBaseUrl(dataUrl, "http://localhost:8081"),
    analyst: resolveBaseUrl(analystUrl, "http://localhost:8082"),
  };
}

const BASE_URL: string = import.meta.env.BASE_URL;

export const ISOLATED_DEMO: boolean = isolatedDemo(import.meta.env.VITE_ISOLATED_DEMO, BASE_URL);

const SERVICE_URLS = serviceUrls(
  ISOLATED_DEMO,
  BASE_URL,
  import.meta.env.VITE_DATA_URL,
  import.meta.env.VITE_ANALYST_URL,
);

export const DATA_URL: string = SERVICE_URLS.data;
export const ANALYST_URL: string = SERVICE_URLS.analyst;

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

/** The app's only fetch boundary: an isolated preview bundle never reaches a business service. */
export function previewFetch(url: string, init?: RequestInit, isolated: boolean = ISOLATED_DEMO): Promise<Response> {
  return isolated ? Promise.reject(new PreviewBackendDisabled()) : fetch(url, init);
}
