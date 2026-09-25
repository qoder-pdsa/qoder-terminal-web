import { describe, expect, it } from "vitest";
import { exchangeTimeZone, formatAmount, formatClock, netSign, toFlowBars } from "./capitalFlowData";

describe("toFlowBars", () => {
  it("maps minutes to unix seconds and colors by sign", () => {
    const bars = toFlowBars(
      [
        { time: "2026-09-25T01:30:00Z", inflow: "-1200.5000" },
        { time: "2026-09-25T01:31:00Z", inflow: "300.0000" },
        { time: "2026-09-25T01:32:00Z", inflow: "0.0000" },
      ],
      { positive: "red", negative: "green" },
    );
    expect(bars).toEqual([
      { time: 1790299800, value: -1200.5, color: "green" },
      { time: 1790299860, value: 300, color: "red" },
      { time: 1790299920, value: 0, color: "red" },
    ]);
  });
});

describe("formatAmount", () => {
  it.each([
    ["0.0000", "0"],
    ["950.0000", "950"],
    ["12345.0000", "12.3K"],
    ["-12345.0000", "-12.3K"],
    ["12345678.0000", "12.3M"],
    ["1234567890.0000", "1.23B"],
  ])("%s → %s", (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });
});

describe("netSign", () => {
  it.each([
    ["12.5", "up"],
    ["-0.0001", "down"],
    ["0.0000", "flat"],
    ["-0", "flat"],
  ])("%s → %s", (input, expected) => {
    expect(netSign(input)).toBe(expected);
  });
});

describe("exchange clock", () => {
  it.each([
    ["700.HK", "Asia/Hong_Kong"],
    ["600519.SH", "Asia/Shanghai"],
    ["000001.SZ", "Asia/Shanghai"],
    ["AAPL.US", "America/New_York"],
  ])("%s → %s", (symbol, tz) => {
    expect(exchangeTimeZone(symbol)).toBe(tz);
  });

  it("formats a unix timestamp as HH:mm in the exchange's zone", () => {
    // 2026-09-25T01:18:00Z is 09:18 in Hong Kong and 21:18 the previous evening in New York
    expect(formatClock(1790299080, "Asia/Hong_Kong")).toBe("09:18");
    expect(formatClock(1790299080, "America/New_York")).toBe("21:18");
  });
});
