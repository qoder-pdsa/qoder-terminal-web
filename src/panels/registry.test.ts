import { describe, expect, it } from "vitest";
import { panelTitle } from "./registry";

// BL-02 changes the GP heading from "700.HK GP" to "700.HK GP 3M". The Q / N / ASK cases are
// unchanged from the pre-BL-02 characterization committed at db9d8af and guard the rest of the
// 2x2 grid against regressions.
describe("panelTitle", () => {
  it("renders `SYMBOL GP RANGE` for GP", () => {
    expect(panelTitle({ kind: "function", code: "GP", symbol: "700.HK", range: "3M" })).toBe("700.HK GP 3M");
    expect(panelTitle({ kind: "function", code: "GP", symbol: "700.HK", range: "6M" })).toBe("700.HK GP 6M");
  });

  it("falls back to the contract default range when GP carries none", () => {
    expect(panelTitle({ kind: "function", code: "GP", symbol: "700.HK" })).toBe("700.HK GP 3M");
  });

  it("renders `SYMBOL CODE` for Q with no range segment", () => {
    expect(panelTitle({ kind: "function", code: "Q", symbol: "700.HK" })).toBe("700.HK Q");
  });

  it("renders only the code when the command carries no symbol", () => {
    expect(panelTitle({ kind: "function", code: "N" })).toBe("N");
  });

  it("renders ASK for ask commands", () => {
    expect(panelTitle({ kind: "ask", question: "compare Tencent and Alibaba" })).toBe("ASK");
  });
});
