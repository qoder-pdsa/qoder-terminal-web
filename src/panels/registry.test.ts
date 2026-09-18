import { describe, expect, it } from "vitest";
import { panelTitle } from "./registry";

// Characterization of the panel heading as it exists before BL-02. The GP case is the
// behaviour BL-02 intentionally changes; Q / N / ASK must keep their current headings.
describe("panelTitle (pre-BL-02 characterization)", () => {
  it("renders `SYMBOL CODE` for GP with no range segment", () => {
    expect(panelTitle({ kind: "function", code: "GP", symbol: "700.HK" })).toBe("700.HK GP");
  });

  it("renders `SYMBOL CODE` for Q", () => {
    expect(panelTitle({ kind: "function", code: "Q", symbol: "700.HK" })).toBe("700.HK Q");
  });

  it("renders only the code when the command carries no symbol", () => {
    expect(panelTitle({ kind: "function", code: "N" })).toBe("N");
  });

  it("renders ASK for ask commands", () => {
    expect(panelTitle({ kind: "ask", question: "compare Tencent and Alibaba" })).toBe("ASK");
  });
});
