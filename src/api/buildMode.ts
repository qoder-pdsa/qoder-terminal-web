/**
 * Build-mode derivation shared by the app and by vite.config.ts. Kept free of import.meta.env so
 * the vite config can import it while bundling.
 */
export const PREVIEW_BASE = /^\/preview\/[a-z0-9-]{1,40}\//;

export function isPreviewBase(viteBase: string | undefined): boolean {
  return PREVIEW_BASE.test(viteBase ?? "/");
}

/**
 * Synthetic preview mode serves contract-shaped synthetic data in-process, so a plain browser on a
 * temporary preview never contacts the real business APIs. The deploy host builds previews with its
 * own Dockerfile.preview, which injects the preview base but never VITE_SYNTHETIC and cannot be
 * changed from a branch, so a preview base selects synthetic data too. Production and local builds
 * keep base "/" and the real fetch path.
 */
export function isSyntheticBuild(viteSynthetic: string | undefined, viteBase: string | undefined): boolean {
  return viteSynthetic === "1" || isPreviewBase(viteBase);
}
