import { describe, expect, it } from "vitest";
import { apiBaseUrls, previewSyntheticBase, resolveBaseUrl } from "./config";

describe("resolveBaseUrl", () => {
  it("uses the configured value", () => {
    expect(resolveBaseUrl("/api/data", "http://localhost:8081")).toBe("/api/data");
  });

  it.each([undefined, "", "   "])("falls back when the value is %j", (value) => {
    // Docker builds without a build arg set the variable to an empty string
    expect(resolveBaseUrl(value, "http://localhost:8081")).toBe("http://localhost:8081");
  });
});

// Workitem 10082: a preview is served by the production gateway, whose /api/* routes proxy to the real
// services, so a preview build resolves its API base to the synthetic responses bundled with itself.
describe("previewSyntheticBase", () => {
  it("points a preview build at its own bundled synthetic API", () => {
    expect(previewSyntheticBase("/preview/demo-10082-20261123091900/")).toBe(
      "/preview/demo-10082-20261123091900/synthetic",
    );
    expect(previewSyntheticBase("/preview/main/")).toBe("/preview/main/synthetic");
  });

  it("is null for every other base, so production and dev keep their configured backend", () => {
    expect(previewSyntheticBase("/")).toBeNull();
    expect(previewSyntheticBase("")).toBeNull();
    expect(previewSyntheticBase("/terminal/")).toBeNull();
    expect(previewSyntheticBase("https://qoder.live/")).toBeNull();
  });
});

describe("apiBaseUrls", () => {
  const configured = { dataUrl: "/api/data", analystUrl: "/api/analyst" };

  it("ignores the configured gateway routes inside a preview", () => {
    expect(apiBaseUrls("/preview/demo-10082-20261123091900/", configured)).toEqual({
      data: "/preview/demo-10082-20261123091900/synthetic/data",
      analyst: "/preview/demo-10082-20261123091900/synthetic/analyst",
    });
  });

  it("never resolves a preview to an absolute origin or a gateway API path", () => {
    const absolute = { dataUrl: "https://qoder.live/api/data", analystUrl: "https://qoder.live/api/analyst" };
    for (const urls of [apiBaseUrls("/preview/s/", configured), apiBaseUrls("/preview/s/", absolute)]) {
      for (const value of Object.values(urls)) {
        expect(value.startsWith("/preview/s/synthetic/")).toBe(true);
        expect(value).not.toContain("/api/");
        expect(value).not.toContain("://");
      }
    }
  });

  it("keeps the configured bases for a production build", () => {
    expect(apiBaseUrls("/", configured)).toEqual({ data: "/api/data", analyst: "/api/analyst" });
  });

  it("keeps the local defaults when nothing is configured", () => {
    expect(apiBaseUrls("/", {})).toEqual({ data: "http://localhost:8081", analyst: "http://localhost:8082" });
  });
});
