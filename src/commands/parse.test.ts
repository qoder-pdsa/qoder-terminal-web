import { describe, expect, it } from "vitest";
import { normalizeSymbol, parseCommand } from "./parse";

describe("normalizeSymbol", () => {
  it.each([
    ["700", "700.HK"],
    ["0700", "700.HK"],
    ["0700.HK", "700.HK"],
    ["9988.HK", "9988.HK"],
    ["AAPL.US", "AAPL.US"],
    ["600519.SH", "600519.SH"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSymbol(input)).toBe(expected);
  });

  it.each(["TENCENT", "700.XX", "1234567"])("rejects %s", (input) => {
    expect(normalizeSymbol(input)).toBeNull();
  });
});

describe("parseCommand", () => {
  it.each([
    ["700 Q", { kind: "function", code: "Q", symbol: "700.HK" }],
    ["  9988.hk gp ", { kind: "function", code: "GP", symbol: "9988.HK" }],
    ["N", { kind: "function", code: "N" }],
    ["3690 N", { kind: "function", code: "N", symbol: "3690.HK" }],
    ["ASK compare Tencent and Alibaba", { kind: "ask", question: "compare Tencent and Alibaba" }],
  ])("parses %j", (input, expected) => {
    expect(parseCommand(input)).toEqual(expected);
  });

  it.each(["", "ASK", "GP", "700 XYZ", "700 Q EXTRA", "TENCENT Q"])("rejects %j", (input) => {
    expect(parseCommand(input).kind).toBe("invalid");
  });
});
