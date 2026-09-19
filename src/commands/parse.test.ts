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
    ["  9988.hk gp ", { kind: "function", code: "GP", symbol: "9988.HK", range: "3M" }],
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

// BL-02 adds a range argument to GP. Compared with the pre-BL-02 characterization committed at
// db9d8af, exactly three expectations change, each authorized by an acceptance criterion: GP now
// carries a default range, a GP range token parses instead of being rejected, and the GP panel
// heading gains the range segment. Everything else below is unchanged regression protection.
describe("parseCommand GP range (BL-02)", () => {
  it.each([
    ["700 GP", "700.HK", "3M"],
    ["700 gp", "700.HK", "3M"],
    ["700.HK GP", "700.HK", "3M"],
    ["0700 GP 3M", "700.HK", "3M"],
    ["700 GP 1M", "700.HK", "1M"],
    ["700 GP 6M", "700.HK", "6M"],
    ["700 GP 1Y", "700.HK", "1Y"],
    ["  9988.hk gp 6m  ", "9988.HK", "6M"],
  ])("%s → %s %s", (input, symbol, range) => {
    expect(parseCommand(input)).toEqual({ kind: "function", code: "GP", symbol, range });
  });

  it.each([
    ["700 GP 2M", "GP range must be one of 1M, 3M, 6M, 1Y; got 2M"],
    ["700 gp 2m", "GP range must be one of 1M, 3M, 6M, 1Y; got 2M"],
    ["700 GP 1W", "GP range must be one of 1M, 3M, 6M, 1Y; got 1W"],
    ["700 GP DAILY", "GP range must be one of 1M, 3M, 6M, 1Y; got DAILY"],
  ])("%s is invalid with a clear reason", (input, reason) => {
    expect(parseCommand(input)).toEqual({ kind: "invalid", input, reason });
  });

  it("keeps rejecting a third token on codes that take no range", () => {
    expect(parseCommand("700 Q 6M").kind).toBe("invalid");
    expect(parseCommand("700 Q 3M").kind).toBe("invalid");
    expect(parseCommand("700 N 1Y").kind).toBe("invalid");
    expect(parseCommand("700 Q EXTRA").kind).toBe("invalid");
  });

  it("leaves Q behaviour unchanged, with no range field", () => {
    const command = parseCommand("700 Q");
    expect(command).toEqual({ kind: "function", code: "Q", symbol: "700.HK" });
    expect(command).not.toHaveProperty("range");
  });

  it("keeps the missing-symbol reason for a bare GP", () => {
    expect(parseCommand("GP")).toEqual({
      kind: "invalid",
      input: "GP",
      reason: "GP requires a symbol, e.g. 700 GP",
    });
  });
});
