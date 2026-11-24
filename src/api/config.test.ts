import { describe, expect, it } from "vitest";
import { isolatedDemo, isolatedDemoFlag, resolveBaseUrl, serviceUrls } from "./config";

describe("resolveBaseUrl", () => {
  it("uses the configured value", () => {
    expect(resolveBaseUrl("/api/data", "http://localhost:8081")).toBe("/api/data");
  });

  it.each([undefined, "", "   "])("falls back when the value is %j", (value) => {
    // Docker builds without a build arg set the variable to an empty string
    expect(resolveBaseUrl(value, "http://localhost:8081")).toBe("http://localhost:8081");
  });
});

describe("isolatedDemoFlag", () => {
  it.each(["1", " 1 "])("turns the isolated preview on for %j", (value) => {
    expect(isolatedDemoFlag(value)).toBe(true);
  });

  // An ordinary preview, a dev server and a production build all leave the variable unset or empty.
  it.each([undefined, "", "   ", "0", "true", "yes"])("stays off for %j", (value) => {
    expect(isolatedDemoFlag(value)).toBe(false);
  });
});

describe("isolatedDemo", () => {
  it("is on when the build flag says so, whatever the base is", () => {
    expect(isolatedDemo("1", "/")).toBe(true);
    expect(isolatedDemo("1", "/preview/anything/")).toBe(true);
  });

  it("is on for this work item's demo preview base even without the flag", () => {
    // The deployment host still builds previews with tooling that predates the isolated mode, so it
    // never sets VITE_ISOLATED_DEMO; the base path is the only thing the branch controls there.
    expect(isolatedDemo(undefined, "/preview/demo-10081-xray-20261123/")).toBe(true);
    expect(isolatedDemo("", "/preview/demo-10081-xray-20261123-iso/")).toBe(true);
  });

  it.each([
    ["/", undefined],
    ["", undefined],
    ["/preview/main/", ""],
    ["/preview/bl02-graph-price-panel-20260918123222/", undefined],
    ["/preview/demo-10082-20261123091900/", "0"],
  ])("stays off for base %j with flag %j", (base, flag) => {
    expect(isolatedDemo(flag, base)).toBe(false);
  });
});

describe("serviceUrls", () => {
  it("keeps the configured URLs of an ordinary build, including another branch's preview", () => {
    expect(serviceUrls(false, "/", "/api/data", "/api/analyst")).toEqual({ data: "/api/data", analyst: "/api/analyst" });
    expect(serviceUrls(false, "/preview/bl02-graph-price-panel-20260918123222/", "/api/data", "/api/analyst")).toEqual({
      data: "/api/data",
      analyst: "/api/analyst",
    });
  });

  it("falls back to the local dev services when nothing is configured", () => {
    expect(serviceUrls(false, "/", undefined, undefined)).toEqual({
      data: "http://localhost:8081",
      analyst: "http://localhost:8082",
    });
    expect(serviceUrls(false, "/", "  ", "")).toEqual({
      data: "http://localhost:8081",
      analyst: "http://localhost:8082",
    });
  });

  it.each(["/preview/demo-10081-xray-20261123/", "/preview/demo-10081-xray-20261123-iso/"])(
    "ignores the host's shared-backend URLs in an isolated demo build of %j",
    (base) => {
      expect(serviceUrls(true, base, "/api/data", "/api/analyst")).toEqual({
        data: `${base}no-backend`,
        analyst: `${base}no-backend`,
      });
    },
  );
});
