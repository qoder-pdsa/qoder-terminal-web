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

// Characterization of the command grammar as it exists before BL-02. The GP cases are the
// behaviour BL-02 intentionally changes (a range argument); the Q cases pin the boundary of
// that change and must keep rejecting a third token.
describe("parseCommand (pre-BL-02 characterization)", () => {
  it("returns a GP command with no range field", () => {
    const command = parseCommand("700 GP");
    expect(command).toEqual({ kind: "function", code: "GP", symbol: "700.HK" });
    expect(command).not.toHaveProperty("range");
  });

  it.each(["700 GP 3M", "700 GP 6M", "700 GP 1Y", "700 gp 6m"])("rejects a GP range argument %j", (input) => {
    const command = parseCommand(input);
    expect(command.kind).toBe("invalid");
    if (command.kind === "invalid") expect(command.reason).toBe("Unknown command");
  });

  it.each(["700 Q 6M", "700 Q 3M", "700 N 1Y"])("keeps rejecting a range on non-GP codes %j", (input) => {
    expect(parseCommand(input).kind).toBe("invalid");
  });

  it("keeps the missing-symbol reason for a bare GP", () => {
    const command = parseCommand("GP");
    expect(command).toEqual({
      kind: "invalid",
      input: "GP",
      reason: "GP requires a symbol, e.g. 700 GP",
    });
  });
});
