import { isSyntheticBuild } from "./buildMode";

/** Resolve a base URL from a build-time variable; unset, empty, or blank values fall back to the default. */
export function resolveBaseUrl(value: string | undefined, fallback: string): string {
  return value && value.trim() ? value : fallback;
}

// @__PURE__ so synthetic builds, which never read these constants, drop the fallback literals too.
export const DATA_URL: string = /* @__PURE__ */ resolveBaseUrl(import.meta.env.VITE_DATA_URL, "http://localhost:8081");
export const ANALYST_URL: string = /* @__PURE__ */ resolveBaseUrl(import.meta.env.VITE_ANALYST_URL, "http://localhost:8082");

/**
 * Synthetic preview mode: see ./buildMode for the derivation. vite.config.ts folds the flag to "1"
 * for preview builds so the dead real-fetch paths drop out of the published bundle.
 */
export const SYNTHETIC: boolean = isSyntheticBuild(import.meta.env.VITE_SYNTHETIC, import.meta.env.VITE_BASE);
