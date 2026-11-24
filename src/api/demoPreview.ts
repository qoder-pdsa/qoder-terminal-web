/**
 * The preview slugs of this work item's demo branch. `deploy/preview-lib.sh` derives the plain one from
 * the branch name and `deploy.sh preview <branch> isolated` derives the `-iso` one, but the deployment
 * host still runs tooling that predates the isolated mode and passes no mode argument, so the bundle has
 * to recognize its own base path to stay isolated there.
 */
export const DEMO_PREVIEW_SLUGS: readonly string[] = ["demo-10081-xray-20261123", "demo-10081-xray-20261123-iso"];

/** One path segment of the shape `preview_validate_slug` accepts, and nothing after it. */
const PREVIEW_BASE = /^\/preview\/([a-z0-9-]{1,40})\/$/;

/** The slug a bundle is served under, or null when the base is not a single preview path. */
export function previewSlugOf(base: string): string | null {
  return PREVIEW_BASE.exec(base)?.[1] ?? null;
}

export function isDemoPreviewBase(base: string): boolean {
  const slug = previewSlugOf(base);
  return slug !== null && DEMO_PREVIEW_SLUGS.includes(slug);
}

/** A path inside the bundle's own base: the gateway serves it statically, so it can never reach a service. */
export function noBackendPath(base: string): string {
  return `${base.endsWith("/") ? base : `${base}/`}no-backend`;
}
