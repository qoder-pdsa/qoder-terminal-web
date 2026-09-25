import { DEFAULT_HISTORY_RANGE, HISTORY_RANGES, type HistoryRange } from "../api/data";

export const FUNCTION_CODES = ["Q", "GP", "N", "W", "CF", "CLEAR", "ASK"] as const;
export type FunctionCode = (typeof FUNCTION_CODES)[number];

export type Command =
  | { kind: "function"; code: Exclude<FunctionCode, "ASK">; symbol?: string; range?: HistoryRange }
  | { kind: "ask"; question: string }
  | { kind: "invalid"; input: string; reason: string };

// Up to 20 characters so option symbols from a watchlist (MSFT261016P420000.US) round-trip through W → Q.
const FULL_SYMBOL = /^([0-9A-Z]{1,20})\.(HK|US|SH|SZ)$/;
const HK_SHORT = /^\d{1,5}$/;
export const REQUIRES_SYMBOL: ReadonlySet<FunctionCode> = new Set(["Q", "GP", "CF"]);
// CLEAR acts on the whole grid rather than on one symbol, so it never takes one.
const REJECTS_SYMBOL: ReadonlySet<FunctionCode> = new Set(["CLEAR"]);

function isCode(token: string): token is FunctionCode {
  return (FUNCTION_CODES as readonly string[]).includes(token);
}

function isHistoryRange(token: string): token is HistoryRange {
  return (HISTORY_RANGES as readonly string[]).includes(token);
}

/** GP is the only code that takes a range argument; omitted, it uses the contract default. */
function parseGpRange(input: string, symbol: string, token: string | undefined): Command {
  if (token === undefined) {
    return { kind: "function", code: "GP", symbol, range: DEFAULT_HISTORY_RANGE };
  }
  if (!isHistoryRange(token)) {
    return {
      kind: "invalid",
      input,
      reason: `GP range must be one of ${HISTORY_RANGES.join(", ")}; got ${token}`,
    };
  }
  return { kind: "function", code: "GP", symbol, range: token };
}

/**
 * Normalize a symbol: `700` / `0700` / `0700.HK` → `700.HK`; non-HK symbols stay as-is; unrecognized input returns null.
 * Hong Kong is the default market, so bare numbers are treated as HK codes.
 */
export function normalizeSymbol(token: string): string | null {
  if (HK_SHORT.test(token)) return `${Number(token)}.HK`;
  const match = FULL_SYMBOL.exec(token);
  if (!match) return null;
  const [, code, market] = match;
  return market === "HK" && HK_SHORT.test(code) ? `${Number(code)}.HK` : token;
}

/** Parse command bar input. Syntax: `[SYMBOL] <CODE>`, `SYMBOL GP [RANGE]`, or `ASK <question>`. */
export function parseCommand(raw: string): Command {
  const input = raw.trim();
  const upper = input.toUpperCase();

  if (upper === "ASK" || upper.startsWith("ASK ")) {
    const question = input.slice(3).trim();
    return question
      ? { kind: "ask", question }
      : { kind: "invalid", input, reason: "ASK requires a question" };
  }

  const tokens = upper.split(/\s+/).filter(Boolean);
  const [first, second, third] = tokens;
  if (tokens.length === 1 && first && isCode(first) && first !== "ASK") {
    return REQUIRES_SYMBOL.has(first)
      ? { kind: "invalid", input, reason: `${first} requires a symbol, e.g. 700 ${first}` }
      : { kind: "function", code: first };
  }
  if ((tokens.length === 2 || tokens.length === 3) && first && second && isCode(second) && second !== "ASK") {
    const symbol = normalizeSymbol(first);
    if (symbol && REJECTS_SYMBOL.has(second)) {
      return { kind: "invalid", input, reason: `${second} takes no symbol, e.g. ${second}` };
    }
    if (symbol && second === "GP") return parseGpRange(input, symbol, third);
    if (symbol && tokens.length === 2) return { kind: "function", code: second, symbol };
  }
  return { kind: "invalid", input, reason: "Unknown command" };
}
