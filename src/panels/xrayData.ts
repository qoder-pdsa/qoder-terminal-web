export const CASH_ID = "CASH";
/** The aggregated remainder of an ETF; it never ranks (§4). */
export const OTHER_ID = "OTHER";
/** The symbol the headline exposure follows, as in round one. */
export const FOCUS_SYMBOL = "NVDA";
export const BOARD_SIZE = 5;

/**
 * Units: every weight is an integer in deci-percent (0.1% = 1) and every exposure an integer in
 * milli-percent (0.001% = 1). A whole-percent ETF position times a 0.1%-resolution constituent is
 * then exact — `etfWeight * constituentWeight / 10` — so the demo never touches a binary float.
 */
export interface Constituent {
  readonly symbol: string;
  readonly weight: number;
}

export interface Etf {
  readonly id: string;
  readonly label: string;
  /** Current position in deci-percent; only ever a whole percent, so always a multiple of 10. */
  readonly weight: number;
  /** The demo position, which is the ceiling: an ETF can be lowered but never raised above it. */
  readonly initialWeight: number;
  readonly constituents: readonly Constituent[];
}

export interface Portfolio {
  readonly id: string;
  readonly label: string;
  readonly direct: readonly Constituent[];
  readonly etfs: readonly Etf[];
}

/** One ETF's share of a symbol's exposure: position × constituent weight. */
export interface XrayChannel {
  readonly via: string;
  readonly label: string;
  readonly etfWeight: number;
  readonly constituentWeight: number;
  readonly contribution: number;
}

export interface XraySymbol {
  readonly symbol: string;
  readonly direct: number;
  readonly channels: readonly XrayChannel[];
  readonly effective: number;
}

export interface XrayBoardRow {
  readonly rank: number;
  readonly symbol: string;
  readonly value: number;
}

/** A row of the position table: a direct position, an ETF, or the derived cash row. */
export interface XrayHoldingRow {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  /** How much of this holding is the focus symbol (100% for a direct position in it). */
  readonly focusWeight: number;
  /** This holding's share of the focus symbol's exposure. */
  readonly contribution: number;
  readonly adjustable: boolean;
  readonly maxWeight: number;
}

export interface XrayAnalysis {
  /** Every ranked symbol, look-through order; cash and `OTHER_ID` are absent. */
  readonly symbols: readonly XraySymbol[];
  readonly directBoard: readonly XrayBoardRow[];
  readonly lookThroughBoard: readonly XrayBoardRow[];
  /** The headline number: the focus symbol's effective exposure. */
  readonly focusExposure: number;
  readonly cashWeight: number;
  readonly holdings: readonly XrayHoldingRow[];
}

const BASELINE: Portfolio = {
  id: "P1",
  label: "基准组合",
  direct: [{ symbol: "NVDA", weight: 50 }],
  etfs: [
    {
      id: "ETF-A",
      label: "ETF-A",
      weight: 400,
      initialWeight: 400,
      constituents: [
        { symbol: "AAPL", weight: 90 },
        { symbol: "NVDA", weight: 80 },
        { symbol: "MSFT", weight: 80 },
        { symbol: "GOOGL", weight: 70 },
        { symbol: "AMZN", weight: 70 },
        { symbol: "META", weight: 50 },
        { symbol: "AVGO", weight: 40 },
        { symbol: "TSLA", weight: 30 },
        { symbol: OTHER_ID, weight: 490 },
      ],
    },
    {
      id: "ETF-B",
      label: "ETF-B",
      weight: 300,
      initialWeight: 300,
      constituents: [
        { symbol: "AAPL", weight: 70 },
        { symbol: "NVDA", weight: 60 },
        { symbol: "MSFT", weight: 60 },
        { symbol: "GOOGL", weight: 40 },
        { symbol: "AMZN", weight: 35 },
        { symbol: "META", weight: 25 },
        { symbol: "BRK.B", weight: 20 },
        { symbol: "JPM", weight: 15 },
        { symbol: OTHER_ID, weight: 675 },
      ],
    },
  ],
};

const HIDDEN_HEAVY: Portfolio = {
  id: "P2",
  label: "隐藏重仓组合",
  direct: [
    { symbol: "AAPL", weight: 60 },
    { symbol: "MSFT", weight: 50 },
    { symbol: "GOOGL", weight: 45 },
    { symbol: "AMZN", weight: 40 },
    { symbol: "NVDA", weight: 30 },
  ],
  etfs: [
    {
      id: "ETF-C",
      label: "ETF-C",
      weight: 600,
      initialWeight: 600,
      constituents: [
        { symbol: "NVDA", weight: 300 },
        { symbol: "AAPL", weight: 100 },
        { symbol: "MSFT", weight: 100 },
        { symbol: "GOOGL", weight: 80 },
        { symbol: "AMZN", weight: 60 },
        { symbol: "META", weight: 50 },
        { symbol: "AVGO", weight: 50 },
        { symbol: OTHER_ID, weight: 260 },
      ],
    },
  ],
};

export const DEMO_PORTFOLIOS: readonly Portfolio[] = [BASELINE, HIDDEN_HEAVY];

export function portfolioById(id: string): Portfolio {
  const portfolio = DEMO_PORTFOLIOS.find((p) => p.id === id);
  if (!portfolio) throw new Error(`unknown demo portfolio: ${id}`);
  return portfolio;
}

/**
 * Ranks and cuts a board. Ties break toward the more hidden position — the larger look-through
 * share — and then alphabetically, which is what makes requirement v2 §5 put NVDA second when it
 * and MSFT both reach 6.0% after ETF-C is lowered to 10%.
 */
function board(candidates: readonly XraySymbol[], value: (s: XraySymbol) => number): readonly XrayBoardRow[] {
  return candidates
    .filter((s) => value(s) > 0)
    .sort((a, b) => {
      const byValue = value(b) - value(a);
      if (byValue !== 0) return byValue;
      const hidden = (s: XraySymbol) => s.channels.reduce((sum, c) => sum + c.contribution, 0);
      const byHidden = hidden(b) - hidden(a);
      return byHidden !== 0 ? byHidden : a.symbol.localeCompare(b.symbol);
    })
    .slice(0, BOARD_SIZE)
    .map((s, i) => ({ rank: i + 1, symbol: s.symbol, value: value(s) }));
}

/** Effective exposure of every ranked symbol, both boards, the position rows and the headline. */
export function analyze(portfolio: Portfolio, focus: string): XrayAnalysis {
  const direct = new Map<string, number>();
  for (const position of portfolio.direct) {
    if (position.symbol === OTHER_ID) continue;
    direct.set(position.symbol, position.weight * 100);
  }

  const channels = new Map<string, XrayChannel[]>();
  for (const etf of portfolio.etfs) {
    for (const constituent of etf.constituents) {
      if (constituent.symbol === OTHER_ID) continue;
      const list = channels.get(constituent.symbol) ?? [];
      list.push({
        via: etf.id,
        label: etf.label,
        etfWeight: etf.weight,
        constituentWeight: constituent.weight,
        // Exact: an ETF position is always a whole percent, so `weight` is a multiple of 10.
        contribution: (etf.weight * constituent.weight) / 10,
      });
      channels.set(constituent.symbol, list);
    }
  }

  const symbols: XraySymbol[] = [...new Set([...direct.keys(), ...channels.keys()])]
    .map((symbol) => {
      const held = direct.get(symbol) ?? 0;
      const through = channels.get(symbol) ?? [];
      return {
        symbol,
        direct: held,
        channels: through,
        effective: held + through.reduce((sum, c) => sum + c.contribution, 0),
      };
    })
    .sort((a, b) => b.effective - a.effective || a.symbol.localeCompare(b.symbol));

  const invested =
    portfolio.direct.reduce((sum, d) => sum + d.weight, 0) + portfolio.etfs.reduce((sum, e) => sum + e.weight, 0);
  const cashWeight = Math.max(0, 1000 - invested);

  const holdings: XrayHoldingRow[] = [
    ...portfolio.direct.map((position) => ({
      id: position.symbol,
      label: position.symbol,
      weight: position.weight,
      focusWeight: position.symbol === focus ? 1000 : 0,
      contribution: position.symbol === focus ? position.weight * 100 : 0,
      adjustable: false,
      maxWeight: 0,
    })),
    ...portfolio.etfs.map((etf) => {
      const focusWeight = etf.constituents.find((c) => c.symbol === focus)?.weight ?? 0;
      return {
        id: etf.id,
        label: etf.label,
        weight: etf.weight,
        focusWeight,
        contribution: (etf.weight * focusWeight) / 10,
        adjustable: true,
        maxWeight: etf.initialWeight,
      };
    }),
    { id: CASH_ID, label: "CASH", weight: cashWeight, focusWeight: 0, contribution: 0, adjustable: false, maxWeight: 0 },
  ];

  return {
    symbols,
    directBoard: board(symbols, (s) => s.direct),
    lookThroughBoard: board(symbols, (s) => s.effective),
    focusExposure: symbols.find((s) => s.symbol === focus)?.effective ?? 0,
    cashWeight,
    holdings,
  };
}

/** Lowers one ETF position of one portfolio; the difference is not reinvested, so cash absorbs it. */
export function setEtfWeight(portfolio: Portfolio, etfId: string, percent: number): Portfolio {
  const target = portfolio.etfs.find((e) => e.id === etfId);
  if (!target || !Number.isFinite(percent)) return portfolio;
  const next = Math.min(percentOf(target.initialWeight), Math.max(0, Math.floor(percent)));
  if (next === percentOf(target.weight)) return portfolio;
  return { ...portfolio, etfs: portfolio.etfs.map((e) => (e.id === etfId ? { ...e, weight: next * 10 } : e)) };
}

/** Deci-percent as the whole-or-one-decimal percent a weight control and a row show. */
export function percentOf(deciPercent: number): number {
  return deciPercent / 10;
}

/** Renders deci-percent with at most one decimal, on its own digits. */
export function formatWeight(deciPercent: number): string {
  const tenth = deciPercent % 10;
  const whole = (deciPercent - tenth) / 10;
  return tenth === 0 ? `${whole}%` : `${whole}.${tenth}%`;
}

/** Renders milli-percent with one or two decimals, rounded half-up on its own digits. */
export function formatExposure(milliPercent: number): string {
  const centi = Math.floor((milliPercent + 5) / 10);
  const frac = centi % 100;
  const whole = (centi - frac) / 100;
  const second = frac % 10;
  const first = (frac - second) / 10;
  return second === 0 ? `${whole}.${first}%` : `${whole}.${first}${second}%`;
}

/** Reads the weight control's value; the panel never parses a number itself. */
export function weightFromInput(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}
