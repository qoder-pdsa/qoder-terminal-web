import { FUNCTION_CODES, REQUIRES_SYMBOL, type FunctionCode } from "../commands/parse";

export interface HelpFunctionRow {
  readonly code: FunctionCode;
  readonly syntax: string;
  readonly blurb: string;
}

const BLURBS: Record<FunctionCode, string> = {
  HELP: "open this quick help panel",
  Q: "quote — e.g. 700 Q",
  GP: "candlestick chart — e.g. 700 GP 6M",
  N: "news; without a symbol, merged watchlist news",
  W: "watchlist groups with live prices",
  CF: "intraday capital flow — e.g. 700 CF",
  CLEAR: "close all panels",
  ASK: "ask the AI analyst",
};

/** Syntax label derived from the parser rules: which codes need a symbol, a range, or a question. */
function syntaxOf(code: FunctionCode): string {
  if (code === "ASK") return "ASK TEXT";
  if (code === "N") return "N [SYM]";
  const parts: string[] = [code];
  if (REQUIRES_SYMBOL.has(code)) parts.push("SYM");
  if (code === "GP") parts.push("RANGE");
  return parts.join(" ");
}

/** The top bar hint and the help panel list the same codes, both derived from FUNCTION_CODES. */
export const TOPBAR_HINT = [...FUNCTION_CODES].join(" · ");

export const HELP_FUNCTION_ROWS: readonly HelpFunctionRow[] = FUNCTION_CODES.map((code) => ({
  code,
  syntax: syntaxOf(code),
  blurb: BLURBS[code],
}));

export const HELP_SYMBOL_LINES: readonly string[] = [
  "700 / 0700.HK → 700.HK (HKD · default)",
  "AAPL.US",
  "600519.SH · 000001.SZ",
  "up to 20 chars — e.g. MSFT261016P420000.US",
];

export const HELP_COMMAND_BAR_LINES: readonly string[] = [
  "Tab / Shift+Tab — complete & cycle",
  "↑ / ↓ — command history",
];

/** Clickable examples; each runs through the same command path as the command bar. */
export const HELP_EXAMPLES: readonly string[] = ["700 Q", "700 GP", "N", "W", "700 CF", "ASK Compare Tencent and Alibaba"];
