export const FUNCTION_CODES = ["Q", "GP", "N", "W", "ASK"] as const;
export type FunctionCode = (typeof FUNCTION_CODES)[number];

export type Command =
  | { kind: "function"; code: Exclude<FunctionCode, "ASK">; symbol?: string }
  | { kind: "ask"; question: string }
  | { kind: "invalid"; input: string; reason: string };

const FULL_SYMBOL = /^([0-9A-Z]{1,6})\.(HK|US|SH|SZ)$/;
const HK_SHORT = /^\d{1,5}$/;
const REQUIRES_SYMBOL: ReadonlySet<FunctionCode> = new Set(["Q", "GP"]);

function isCode(token: string): token is FunctionCode {
  return (FUNCTION_CODES as readonly string[]).includes(token);
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

/** Parse command bar input. Syntax: `[SYMBOL] <CODE>` or `ASK <question>`. */
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
  const [first, second] = tokens;
  if (tokens.length === 1 && first && isCode(first) && first !== "ASK") {
    return REQUIRES_SYMBOL.has(first)
      ? { kind: "invalid", input, reason: `${first} requires a symbol, e.g. 700 ${first}` }
      : { kind: "function", code: first };
  }
  if (tokens.length === 2 && first && second && isCode(second) && second !== "ASK") {
    const symbol = normalizeSymbol(first);
    if (symbol) return { kind: "function", code: second, symbol };
  }
  return { kind: "invalid", input, reason: "Unknown command" };
}
