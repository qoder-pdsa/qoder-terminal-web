import { describe, expect, it } from "vitest";
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
