import { describe, expect, it } from "vitest";
import type { NewsItem } from "../api/data";
import { mergeNews, relativeTime } from "./newsFormat";

const NOW = new Date("2026-09-25T08:00:00Z");

function item(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: "x",
    headline: "h",
    source: "s",
    url: "https://example.com/x",
    symbols: ["700.HK"],
    publishedAt: "2026-09-25T07:00:00Z",
    ...overrides,
  };
}

describe("relativeTime", () => {
  it.each([
    ["2026-09-25T07:59:40Z", "just now"],
    ["2026-09-25T07:55:00Z", "5m ago"],
    ["2026-09-25T05:00:00Z", "3h ago"],
    ["2026-09-23T08:00:00Z", "2d ago"],
    ["2026-08-01T08:00:00Z", "55d ago"],
    ["2026-09-25T09:00:00Z", "just now"], // clock skew: never "in 1h"
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, NOW)).toBe(expected);
  });

  it("returns the raw string for an unparseable timestamp", () => {
    expect(relativeTime("not a date", NOW)).toBe("not a date");
  });
});

describe("mergeNews", () => {
  it("de-duplicates by url, keeps the newest first and unions the symbols", () => {
    const merged = mergeNews([
      [item({ id: "a", url: "https://n/1", publishedAt: "2026-09-25T06:00:00Z", symbols: ["700.HK"] })],
      [
        item({ id: "b", url: "https://n/1", publishedAt: "2026-09-25T06:00:00Z", symbols: ["9988.HK"] }),
        item({ id: "c", url: "https://n/2", publishedAt: "2026-09-25T07:30:00Z", symbols: ["9988.HK"] }),
      ],
    ]);
    expect(merged.map((n) => n.id)).toEqual(["c", "a"]);
    expect(merged[1].symbols).toEqual(["700.HK", "9988.HK"]);
  });

  it("does not mutate its inputs", () => {
    const first = [item({ id: "a", url: "https://n/1", symbols: ["700.HK"] })];
    const second = [item({ id: "b", url: "https://n/1", symbols: ["9988.HK"] })];
    mergeNews([first, second]);
    expect(first[0].symbols).toEqual(["700.HK"]);
  });

  it("returns [] for no input", () => {
    expect(mergeNews([])).toEqual([]);
  });
});
