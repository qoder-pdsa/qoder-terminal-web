import { describe, expect, it } from "vitest";
import { FUNCTION_CODES, REQUIRES_SYMBOL, parseCommand } from "../commands/parse";
import {
  HELP_COMMAND_BAR_LINES,
  HELP_EXAMPLES,
  HELP_FUNCTION_ROWS,
  HELP_SYMBOL_LINES,
  TOPBAR_HINT,
} from "./helpContent";

// DEMO-13 R5/R6: the help panel and the top bar derive from FUNCTION_CODES, so a new code can
// never leave either of them stale, and every syntax label mirrors what the parser enforces.
describe("help content derivation", () => {
  it("lists exactly the function codes, in FUNCTION_CODES order", () => {
    expect(HELP_FUNCTION_ROWS.map((row) => row.code)).toEqual([...FUNCTION_CODES]);
  });

  it("shares one source with the top bar hint", () => {
    expect(TOPBAR_HINT).toBe([...FUNCTION_CODES].join(" · "));
    expect(TOPBAR_HINT.split(" · ")).toEqual([...FUNCTION_CODES]);
  });

  it("labels syntax the way the parser enforces it", () => {
    for (const row of HELP_FUNCTION_ROWS) {
      if (row.code === "ASK") {
        expect(row.syntax).toBe("ASK TEXT");
      } else if (row.code === "N") {
        expect(row.syntax).toBe("N [SYM]");
      } else if (REQUIRES_SYMBOL.has(row.code)) {
        expect(row.syntax).toBe(row.code === "GP" ? "GP SYM RANGE" : `${row.code} SYM`);
      } else {
        expect(row.syntax).toBe(row.code);
      }
      expect(row.blurb.length).toBeGreaterThan(0);
    }
  });

  it("documents symbols and the command bar in English sections", () => {
    const symbols = HELP_SYMBOL_LINES.join(" ");
    expect(symbols).toContain("700.HK");
    expect(symbols).toContain("AAPL.US");
    expect(symbols).toContain("600519.SH");
    expect(symbols).toContain("20");
    const bar = HELP_COMMAND_BAR_LINES.join(" ");
    expect(bar).toContain("Tab");
    expect(bar).toContain("Shift+Tab");
    expect(bar).toContain("↑");
    expect(bar).toContain("↓");
  });

  it("offers only examples the parser accepts as runnable commands", () => {
    expect(HELP_EXAMPLES).toEqual(["700 Q", "700 GP", "N", "W", "700 CF", "ASK Compare Tencent and Alibaba"]);
    for (const example of HELP_EXAMPLES) {
      expect(parseCommand(example).kind).not.toBe("invalid");
    }
  });
});
