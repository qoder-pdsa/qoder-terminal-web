import { FUNCTION_CODES, normalizeSymbol, REQUIRES_SYMBOL } from "./parse";

/** What one Tab press produced: the line to show, and every line it could have been. */
export interface Completion {
  /**
   * The completed command line, or the input unchanged when nothing matches. A first token
   * completed to a symbol ends with the space that separates it from the function code.
   */
  readonly text: string;
  /** Every possible completion of the line, in candidate order; empty when nothing matches. */
  readonly matches: readonly string[];
}

// ASK leads a line and CLEAR takes no symbol, so neither can complete a second token.
const AFTER_SYMBOL = FUNCTION_CODES.filter((code) => code !== "ASK" && code !== "CLEAR");
// A first token is a symbol or a code that stands alone, never one that requires a symbol.
const STANDALONE = FUNCTION_CODES.filter((code) => code !== "ASK" && !REQUIRES_SYMBOL.has(code));

function tokensOf(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

/** The index of the token being completed: one past the end once the line ends with a space. */
function tokenIndex(input: string, tokens: readonly string[]): number {
  return tokens.length === 0 || /\s$/.test(input) ? tokens.length : tokens.length - 1;
}

/** The symbols used in this session's commands, most recent first and de-duplicated. */
function historySymbols(entries: readonly string[]): string[] {
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const token of tokensOf(entry)) {
      const symbol = normalizeSymbol(token.toUpperCase());
      if (symbol === null || seen.has(symbol)) continue;
      seen.add(symbol);
      symbols.push(symbol);
    }
  }
  return symbols;
}

/**
 * The candidate pool for the token being completed in `input`: this session's symbols then the
 * codes that stand alone for a first token, the codes that follow a symbol for a second one, and
 * nothing for a third — completing a GP range is out of scope.
 */
export function completionCandidates(input: string, entries: readonly string[]): readonly string[] {
  const tokens = tokensOf(input);
  if (tokens.length === 0) return [];
  const index = tokenIndex(input, tokens);
  if (index === 0) return [...historySymbols(entries), ...STANDALONE];
  return index === 1 ? AFTER_SYMBOL : [];
}

/**
 * Complete the trailing token of `input` by case-insensitive prefix match against `candidates`.
 * `cycle` picks which match wins — Tab steps forward, Shift+Tab backward — and wraps at both ends.
 */
export function complete(input: string, candidates: readonly string[], cycle: number): Completion {
  const tokens = tokensOf(input);
  if (tokens.length === 0) return { text: input, matches: [] };

  const index = tokenIndex(input, tokens);
  const prefix = (tokens[index] ?? "").toUpperCase();
  const head = tokens.slice(0, index);

  const matches: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.toUpperCase().startsWith(prefix)) continue;
    const line = [...head, candidate].join(" ");
    if (seen.has(line)) continue;
    seen.add(line);
    matches.push(line);
  }
  if (matches.length === 0) return { text: input, matches: [] };

  const completed = matches[((cycle % matches.length) + matches.length) % matches.length];
  // What follows a ticker is always the function code, so a completed symbol brings its own
  // separating space; a code that stands alone is already a whole command. `matches` stay unspaced
  // because they are what the input publishes as data-completions.
  const spaced = index === 0 && normalizeSymbol(completed.toUpperCase()) !== null;
  return { text: spaced ? `${completed} ` : completed, matches };
}
