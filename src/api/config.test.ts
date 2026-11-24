import { describe, expect, it } from "vitest";
import { isolatedDemoFlag, resolveBaseUrl } from "./config";

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
