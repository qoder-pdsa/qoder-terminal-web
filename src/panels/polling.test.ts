import { describe, expect, it } from "vitest";
import { ApiError } from "../api/data";
import { shouldKeepPolling } from "./polling";

describe("shouldKeepPolling", () => {
  it.each([
    ["a 404 not_found", new ApiError(404, "not_found", "symbol not found"), false],
    ["a 404 whose body could not be parsed", new ApiError(404, "", "HTTP 404"), false],
    ["a 502 from the gateway", new ApiError(502, "upstream_error", "bad gateway"), true],
    ["a 429 rate limit", new ApiError(429, "rate_limit", "too many requests"), true],
    ["a 500 from the data service", new ApiError(500, "internal_error", "boom"), true],
    ["a network failure", new Error("fetch failed"), true],
    ["a non-Error rejection", "socket hang up", true],
    ["nothing at all", undefined, true],
  ])("stops polling only for %s", (_label, error, expected) => {
    expect(shouldKeepPolling(error)).toBe(expected);
  });
});
