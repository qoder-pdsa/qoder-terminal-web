import { describe, expect, it } from "vitest";
import { DEMO_PREVIEW_SLUGS, isDemoPreviewBase, noBackendPath, previewSlugOf } from "./demoPreview";

describe("previewSlugOf", () => {
  it.each([
    ["/preview/demo-10081-xray-20261123/", "demo-10081-xray-20261123"],
    ["/preview/demo-10081-xray-20261123-iso/", "demo-10081-xray-20261123-iso"],
    ["/preview/main/", "main"],
    ["/preview/a/", "a"],
    ["/preview/bl02-graph-price-panel-20260918123222/", "bl02-graph-price-panel-20260918123222"],
  ])("reads the slug out of the base %j", (base, slug) => {
    expect(previewSlugOf(base)).toBe(slug);
  });

  // The shape deploy/preview-lib.sh validates: one path segment of [a-z0-9-]{1,40} and nothing after it.
  it.each([
    "/",
    "",
    "/preview/",
    "/preview//",
    "preview/main/",
    "/preview/UPPER/",
    "/preview/has space/",
    "/preview/semi;colon/",
    "/preview/../../etc/",
    "/preview/main/extra/",
    `/preview/${"a".repeat(41)}/`,
    "http://localhost:5173/",
  ])("returns null for %j", (base) => {
    expect(previewSlugOf(base)).toBeNull();
  });
});

describe("isDemoPreviewBase", () => {
  it("lists exactly the slugs the host publishes for this work item's branch", () => {
    // The plain slug is what the unmodified host tooling produces from the branch name; the -iso slug is
    // what deploy.sh preview <branch> isolated produces once the host carries that mode.
    expect(DEMO_PREVIEW_SLUGS).toEqual(["demo-10081-xray-20261123", "demo-10081-xray-20261123-iso"]);
  });

  it("is true for both of this work item's own preview bases", () => {
    for (const slug of DEMO_PREVIEW_SLUGS) {
      expect(isDemoPreviewBase(`/preview/${slug}/`)).toBe(true);
    }
  });

  it.each([
    "/",
    "",
    "/preview/main/",
    "/preview/bl02-graph-price-panel-20260918123222/",
    "/preview/demo-10082-20261123091900/",
    "/preview/demo-10081-xray-202611230/",
    "http://localhost:5173/",
  ])("is false for %j, so no other preview or production build is affected", (base) => {
    expect(isDemoPreviewBase(base)).toBe(false);
  });
});

describe("noBackendPath", () => {
  it.each([
    ["/preview/demo-10081-xray-20261123/", "/preview/demo-10081-xray-20261123/no-backend"],
    ["/preview/demo-10081-xray-20261123-iso/", "/preview/demo-10081-xray-20261123-iso/no-backend"],
    ["/", "/no-backend"],
    ["/preview/x", "/preview/x/no-backend"],
  ])("points %j at a path inside the bundle's own base", (base, expected) => {
    expect(noBackendPath(base)).toBe(expected);
  });
});
