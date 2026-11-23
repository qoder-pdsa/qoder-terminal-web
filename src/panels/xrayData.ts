export const CASH_ID = "CASH";

export type XrayKind = "direct" | "etf";

/**
 * A holding of the demo portfolio. Weights are whole percents, so every product below stays an
 * integer: exposure is carried in hundredths of a percent and never touches a binary float.
 */
export interface XrayHolding {
  readonly id: string;
  readonly label: string;
  readonly kind: XrayKind;
  /** Whole percent of the portfolio this holding currently takes. */
  readonly weight: number;
  /** The demo position; an ETF may be lowered but never raised above it. */
  readonly initialWeight: number;
  /** Whole percent of this holding that is NVDA (100 for the direct position). */
  readonly nvdaWeight: number;
}

export interface XrayRow {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  /** Whole percent of this row that is NVDA; 0 on the cash row. */
  readonly nvdaWeight: number;
  /** This row's share of the total NVDA exposure, in hundredths of a percent. */
  readonly contribution: number;
  readonly adjustable: boolean;
  /** Upper bound of an adjustable weight; 0 on rows that cannot be moved. */
  readonly maxWeight: number;
}

export interface XrayExposure {
  /** The holdings followed by the cash row, which is derived rather than stored. */
  readonly rows: readonly XrayRow[];
  /** Total NVDA exposure in hundredths of a percent. */
  readonly total: number;
  readonly cashWeight: number;
}

/** The fixed demo portfolio of work item 10081; cash is whatever the three holdings leave over. */
export const DEMO_HOLDINGS: readonly XrayHolding[] = [
  { id: "NVDA", label: "NVDA", kind: "direct", weight: 5, initialWeight: 5, nvdaWeight: 100 },
  { id: "ETF-A", label: "ETF-A", kind: "etf", weight: 40, initialWeight: 40, nvdaWeight: 8 },
  { id: "ETF-B", label: "ETF-B", kind: "etf", weight: 30, initialWeight: 30, nvdaWeight: 6 },
];

/** Total NVDA exposure = the direct position + Σ(ETF weight × that ETF's NVDA weight). */
export function exposure(holdings: readonly XrayHolding[]): XrayExposure {
  const rows: XrayRow[] = holdings.map((h) => ({
    id: h.id,
    label: h.label,
    weight: h.weight,
    nvdaWeight: h.nvdaWeight,
    contribution: h.weight * h.nvdaWeight,
    adjustable: h.kind === "etf",
    maxWeight: h.kind === "etf" ? h.initialWeight : 0,
  }));
  const cashWeight = Math.max(0, 100 - holdings.reduce((sum, h) => sum + h.weight, 0));
  return {
    rows: [
      ...rows,
      { id: CASH_ID, label: "CASH", weight: cashWeight, nvdaWeight: 0, contribution: 0, adjustable: false, maxWeight: 0 },
    ],
    total: rows.reduce((sum, r) => sum + r.contribution, 0),
    cashWeight,
  };
}

/** Moves one ETF position; the difference is not reinvested, so cash absorbs it. */
export function setEtfWeight(
  holdings: readonly XrayHolding[],
  id: string,
  weight: number,
): readonly XrayHolding[] {
  const target = holdings.find((h) => h.id === id && h.kind === "etf");
  if (!target || !Number.isFinite(weight)) return holdings;
  const next = Math.min(target.initialWeight, Math.max(0, Math.floor(weight)));
  if (next === target.weight) return holdings;
  return holdings.map((h) => (h.id === id ? { ...h, weight: next } : h));
}

/** Renders hundredths of a percent with one decimal, rounded half-up on its own digits. */
export function formatExposure(centiPercent: number): string {
  const tenths = Math.floor((centiPercent + 5) / 10);
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
}

/** Reads the weight control's value; the panel never parses a number itself. */
export function weightFromInput(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}
