import { describe, expect, it } from "vitest";
import { isPreviewBase, isSyntheticBuild } from "./buildMode";
import { resolveBaseUrl } from "./config";

describe("resolveBaseUrl", () => {
  it("uses the configured value", () => {
    expect(resolveBaseUrl("/api/data", "http://localhost:8081")).toBe("/api/data");
  });

  it.each([undefined, "", "   "])("falls back when the value is %j", (value) => {
    // Docker builds without a build arg set the variable to an empty string
    expect(resolveBaseUrl(value, "http://localhost:8081")).toBe("http://localhost:8081");
  });
});

describe("isPreviewBase", () => {
  it("matches the slugs deploy/preview-lib.sh accepts", () => {
    expect(isPreviewBase("/preview/help-quick-entry-20261026071851/")).toBe(true);
    expect(isPreviewBase("/preview/a/")).toBe(true);
  });

  it("rejects production, local and malformed bases", () => {
    expect(isPreviewBase(undefined)).toBe(false);
    expect(isPreviewBase("/")).toBe(false);
    expect(isPreviewBase("/preview/")).toBe(false);
    expect(isPreviewBase("/preview/UPPER/")).toBe(false);
    expect(isPreviewBase(`/preview/${"a".repeat(41)}/`)).toBe(false);
  });
});

describe("isSyntheticBuild", () => {
  it("is on for an explicit VITE_SYNTHETIC=1 on any base", () => {
    expect(isSyntheticBuild("1", "/")).toBe(true);
    expect(isSyntheticBuild("1", "/preview/help-quick-entry-20261026071851/")).toBe(true);
  });

  it("stays off for production and local bases without the flag", () => {
    expect(isSyntheticBuild(undefined, "/")).toBe(false);
    expect(isSyntheticBuild("0", "/")).toBe(false);
    expect(isSyntheticBuild("", "/")).toBe(false);
    expect(isSyntheticBuild(undefined, undefined)).toBe(false);
  });

  // The deploy host builds previews with its own Dockerfile.preview, which injects the preview
  // base but never VITE_SYNTHETIC; a branch cannot change that tooling, so the base path itself
  // must select synthetic data or the published demo would talk to the shared production backend.
  it("is on for a preview base path even without the flag", () => {
    expect(isSyntheticBuild(undefined, "/preview/help-quick-entry-20261026071851/")).toBe(true);
    expect(isSyntheticBuild(undefined, "/preview/clear-all-button-20261102-204648/")).toBe(true);
  });

  it("stays off for base paths that are not a real preview slug", () => {
    expect(isSyntheticBuild(undefined, "/preview/")).toBe(false);
    expect(isSyntheticBuild(undefined, "/preview/UPPER/")).toBe(false);
    expect(isSyntheticBuild(undefined, "/preview/bad slug/")).toBe(false);
    expect(isSyntheticBuild(undefined, "/previewx/help/")).toBe(false);
  });
});
