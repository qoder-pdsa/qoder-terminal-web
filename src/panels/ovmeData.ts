import { roundDecimalString } from "./quoteFormat";
import { compareDecimal } from "./watchlistState";

/** The demo parameters confirmed with Pat: Tencent at 350 HKD, a protective put struck at 330 for 8. */
export interface OvmeParams {
  stockCost: string;
  strike: string;
  premium: string;
}

export interface ExpiryBounds {
  min: string;
  max: string;
  step: string;
}

/** One sampled expiry price and the two lines' P&L per share at it, all as decimal strings. */
export interface CurvePoint {
  expiry: string;
  unprotected: string;
  protected: string;
}

export interface OvmeChartPoint {
  time: number;
  value: number;
}

export interface OvmeChartData {
  unprotected: OvmeChartPoint[];
  protected: OvmeChartPoint[];
}

export type PnlDirection = "up" | "down" | "flat";

export interface FormattedPnl {
  text: string;
  direction: PnlDirection;
}

export const DEFAULT_OVME_PARAMS: OvmeParams = { stockCost: "350", strike: "330", premium: "8" };
/** Covers the acceptance range 245-350+ with room on both sides; the step keeps the slider on round prices. */
export const EXPIRY_BOUNDS: ExpiryBounds = { min: "200", max: "450", step: "5" };
export const DEFAULT_EXPIRY = "280";

// Everything the user types is a plain non-negative decimal; a sign, exponent or separator is not a price.
const DECIMAL = /^\d+(\.\d+)?$/;

interface Decimal {
  units: bigint;
  scale: number;
}

function parseDecimal(value: string): Decimal {
  const negative = value.startsWith("-");
  const magnitude = negative ? value.slice(1) : value;
  const [intPart, fracPart = ""] = magnitude.split(".");
  return { units: (negative ? -1n : 1n) * BigInt(intPart + fracPart), scale: fracPart.length };
}

/** Fixed-point render: trailing zeros are dropped, so `350.00 - 280` reads `-70` and never `-70.00`. */
function renderDecimal({ units, scale }: Decimal): string {
  const negative = units < 0n;
  let digits = (negative ? -units : units).toString().padStart(scale + 1, "0");
  let kept = scale;
  while (kept > 0 && digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    kept--;
  }
  const split = digits.length - kept;
  const text = kept === 0 ? digits : `${digits.slice(0, split)}.${digits.slice(split)}`;
  return negative && text !== "0" ? `-${text}` : text;
}

function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.units * 10n ** BigInt(scale - a.scale), b.units * 10n ** BigInt(scale - b.scale), scale];
}

function addDecimal(a: string, b: string): string {
  const [ua, ub, scale] = align(parseDecimal(a), parseDecimal(b));
  return renderDecimal({ units: ua + ub, scale });
}

function subDecimal(a: string, b: string): string {
  const [ua, ub, scale] = align(parseDecimal(a), parseDecimal(b));
  return renderDecimal({ units: ua - ub, scale });
}

/** Drops a redundant scale, so a parameter typed as `350.00` is stored and shown as `350`. */
function normalizeDecimal(value: string): string {
  return addDecimal(value, "0");
}

/** P&L per share of the bare stock position: `S - cost`. */
export function unprotectedPnl(expiry: string, params: OvmeParams): string {
  return subDecimal(expiry, params.stockCost);
}

/** The put's payoff at expiry, `max(strike - S, 0)`; it is worthless at or above the strike. */
function putPayoff(expiry: string, strike: string): string {
  const intrinsic = subDecimal(strike, expiry);
  return compareDecimal(intrinsic, "0") > 0 ? intrinsic : "0";
}

/** P&L per share of stock plus protective put: `(S - cost) + (max(strike - S, 0) - premium)`. */
export function protectedPnl(expiry: string, params: OvmeParams): string {
  return subDecimal(addDecimal(unprotectedPnl(expiry, params), putPayoff(expiry, params.strike)), params.premium);
}

/** The loss the put locks in at every expiry at or below the strike: `strike - cost - premium`. */
export function protectedMaxLoss(params: OvmeParams): string {
  return subDecimal(subDecimal(params.strike, params.stockCost), params.premium);
}

/**
 * Where each line crosses zero. Without protection that is the cost; with it the cost plus the
 * premium — which only exists as a crossing while the put actually locks in a loss.
 */
export function breakEvens(params: OvmeParams): { unprotected: string; protected: string | null } {
  return {
    unprotected: normalizeDecimal(params.stockCost),
    protected: compareDecimal(protectedMaxLoss(params), "0") < 0 ? addDecimal(params.stockCost, params.premium) : null,
  };
}

/** Both lines sampled over the slider range, inclusive of both bounds. */
export function expiryCurve(params: OvmeParams, bounds: ExpiryBounds): CurvePoint[] {
  const points: CurvePoint[] = [];
  for (let expiry = bounds.min; compareDecimal(expiry, bounds.max) <= 0; expiry = addDecimal(expiry, bounds.step)) {
    points.push({
      expiry: normalizeDecimal(expiry),
      unprotected: unprotectedPnl(expiry, params),
      protected: protectedPnl(expiry, params),
    });
  }
  return points;
}

/** The one place an OVME decimal string becomes a number: the chart library only takes those. */
export function toOvmeChartData(curve: readonly CurvePoint[]): OvmeChartData {
  return {
    unprotected: curve.map((point) => ({ time: Number(point.expiry), value: Number(point.unprotected) })),
    protected: curve.map((point) => ({ time: Number(point.expiry), value: Number(point.protected) })),
  };
}

/**
 * What the expiry field typed: a non-negative decimal clamped into the slider range, or `null`
 * while the draft is not a price yet, so a half-typed value never reaches the calculation.
 */
export function applyExpiryDraft(draft: string, bounds: ExpiryBounds = EXPIRY_BOUNDS): string | null {
  const value = applyParamDraft(draft);
  if (value === null) return null;
  if (compareDecimal(value, bounds.min) < 0) return normalizeDecimal(bounds.min);
  if (compareDecimal(value, bounds.max) > 0) return normalizeDecimal(bounds.max);
  return value;
}

/** What a parameter field typed: a non-negative decimal, or `null` for a draft that is not one. */
export function applyParamDraft(draft: string): string | null {
  const value = draft.trim();
  return DECIMAL.test(value) ? normalizeDecimal(value) : null;
}

/** The nearest slider grid point to an exact expiry, so the thumb matches the number beside it. */
export function snapToStep(value: string, bounds: ExpiryBounds): string {
  const offset = parseDecimal(subDecimal(value, bounds.min));
  const step = parseDecimal(bounds.step);
  const [o, s, scale] = align(offset, step);
  // Half-up rounding on integers only: (2*offset + step) / (2*step).
  const steps = (2n * o + s) / (2n * s);
  return addDecimal(bounds.min, renderDecimal({ units: steps * s, scale }));
}

/** A P&L per share for the panel: two decimals, signed, and colored by HKEX convention upstream. */
export function formatPnl(value: string): FormattedPnl {
  const magnitude = roundDecimalString(value.startsWith("-") ? value.slice(1) : value, 2);
  const zero = magnitude.split("").every((c) => c === "0" || c === ".");
  const direction: PnlDirection = zero ? "flat" : value.startsWith("-") ? "down" : "up";
  const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";
  return { text: `${sign}${magnitude} HKD`, direction };
}
