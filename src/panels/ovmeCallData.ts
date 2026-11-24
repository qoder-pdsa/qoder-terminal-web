import { roundDecimalString } from "./quoteFormat";

/**
 * Scenario 2 of workitem 10082 — "财报 IV 塌缩": an at-the-money call bought before Tencent's earnings is worth
 * less after them even though the stock rose, because the implied volatility collapsed.
 *
 * Unlike scenario 1 (`ovmeData.ts`, exact BigInt fixed-point arithmetic on contract decimal strings) this module
 * prices an option, which needs `exp`, `sqrt` and the normal CDF — no fixed-point decimal can express them. So
 * the valuation is computed in floating point from user-typed numbers and every displayed value goes through
 * `formatCallAmount` / `formatCallPnl`, which expand to six digits and then round on the digits with the
 * terminal's existing `roundDecimalString`. No contract price is ever parsed here: this panel makes no request.
 */

/** The adjustable "now" state: the stock price, the days left to expiry and the implied volatility in percent. */
export interface CallState {
  spot: number;
  days: number;
  ivPercent: number;
}

export interface CallGreeks {
  /** Theoretical premium per share, HKD. */
  price: number;
  delta: number;
  /** Per year, HKD per share. */
  theta: number;
  /** Per 1.00 of volatility (i.e. per 100 IV points), HKD per share. */
  vega: number;
}

/** First-order answer to "why did it lose": each term, their sum, and the second-order remainder. */
export interface CallAttribution {
  stock: number;
  time: number;
  vol: number;
  firstOrder: number;
  residual: number;
}

/** One sampled stock price and the two lines the chart draws at it. */
export interface CallCurvePoint {
  spot: number;
  /** Closing the position now at the current IV and time left. */
  sellToday: number;
  /** Holding the option to expiry. */
  holdToExpiry: number;
}

export type CallDirection = "up" | "down" | "flat";

export interface CallMoney {
  text: string;
  direction: CallDirection;
}

export interface SliderBounds {
  min: number;
  max: number;
  step: number;
}

export const CALL_STRIKE = 350;
/** Fixed: the call was bought at-the-money, 30 days out, with IV at 50% before the announcement. */
export const CALL_PURCHASE: CallState = { spot: 350, days: 30, ivPercent: 50 };
/** The confirmed "after the announcement" state: the stock rose 5, one day passed, IV halved. */
export const CALL_NOW_DEFAULTS: CallState = { spot: 355, days: 29, ivPercent: 25 };

export const SPOT_BOUNDS: SliderBounds = { min: 250, max: 450, step: 5 };
/** A day is the smallest unit shown, and one day must remain for the valuation to be defined. */
export const DAYS_BOUNDS: SliderBounds = { min: 1, max: 90, step: 1 };
export const IV_BOUNDS: SliderBounds = { min: 5, max: 150, step: 5 };

const DAYS_PER_YEAR = 365;

/** Standard normal CDF from the Abramowitz & Stegun 7.1.26 erf; |error| ≤ 1.5e-7, i.e. ~5e-5 HKD on a price. */
function normalCdf(x: number): number {
  const half = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * half);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-half * half));
  return x < 0 ? 0.5 * (1 - erf) : 0.5 * (1 + erf);
}

function normalPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Black-Scholes European call with r = 0 and q = 0, as the requirement fixes them, and T = days/365 — the
 * day-count convention the acceptance values are stated in (T = 1/12 would price the default state at 12.84).
 */
export function blackScholesCall(spot: number, strike: number, days: number, ivPercent: number): CallGreeks {
  const years = days / DAYS_PER_YEAR;
  const sigma = ivPercent / 100;
  const width = sigma * Math.sqrt(years);
  // The limit of the formula as time or volatility goes to zero: the option is worth its intrinsic value.
  if (width === 0) {
    return { price: Math.max(spot - strike, 0), delta: spot > strike ? 1 : 0, theta: 0, vega: 0 };
  }
  const d1 = (Math.log(spot / strike) + ((sigma * sigma) / 2) * years) / width;
  const d2 = d1 - width;
  return {
    price: spot * normalCdf(d1) - strike * normalCdf(d2),
    delta: normalCdf(d1),
    vega: spot * normalPdf(d1) * Math.sqrt(years),
    theta: -(spot * normalPdf(d1) * sigma) / (2 * Math.sqrt(years)),
  };
}

function price(state: CallState): number {
  return blackScholesCall(state.spot, CALL_STRIKE, state.days, state.ivPercent).price;
}

/** What the call was bought for; it is a constant of the scenario, not of the adjustable state. */
export function purchasePremium(): number {
  return price(CALL_PURCHASE);
}

/** What the call is worth now, i.e. what selling it today would realize. */
export function currentPremium(state: CallState): number {
  return price(state);
}

/** "今天卖": sell now and the loss against what was paid. */
export function sellTodayPnl(state: CallState): number {
  return currentPremium(state) - purchasePremium();
}

/** "持有到期": hold to expiry, where the option is only worth its intrinsic value. */
export function holdToExpiryPnl(spot: number): number {
  return Math.max(spot - CALL_STRIKE, 0) - purchasePremium();
}

/** An unchanged input multiplies a negative Greek into IEEE `-0`; every reported term reads as plain zero. */
function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Why the position moved, to first order: the purchase-state Greeks times the actual changes. The sum does not
 * equal the real P&L — the difference is second-order (gamma, cross terms) and is reported as `residual`.
 */
export function attribution(state: CallState): CallAttribution {
  const bought = blackScholesCall(CALL_PURCHASE.spot, CALL_STRIKE, CALL_PURCHASE.days, CALL_PURCHASE.ivPercent);
  const stock = bought.delta * (state.spot - CALL_PURCHASE.spot);
  const time = bought.theta * ((CALL_PURCHASE.days - state.days) / DAYS_PER_YEAR);
  const vol = bought.vega * ((state.ivPercent - CALL_PURCHASE.ivPercent) / 100);
  const firstOrder = stock + time + vol;
  return {
    stock: withoutNegativeZero(stock),
    time: withoutNegativeZero(time),
    vol: withoutNegativeZero(vol),
    firstOrder: withoutNegativeZero(firstOrder),
    residual: withoutNegativeZero(sellTodayPnl(state) - firstOrder),
  };
}

/** Both lines sampled across the stock-price range, at the state's current days and IV. */
export function callCurve(state: CallState, bounds: SliderBounds = SPOT_BOUNDS): CallCurvePoint[] {
  const points: CallCurvePoint[] = [];
  for (let i = 0; bounds.min + i * bounds.step <= bounds.max; i++) {
    const spot = bounds.min + i * bounds.step;
    points.push({
      spot,
      sellToday: sellTodayPnl({ ...state, spot }),
      holdToExpiry: holdToExpiryPnl(spot),
    });
  }
  return points;
}

/** Six digits is far beyond the ±0.05 tolerance; rounding then happens on the digits, never on the float. */
function digits(value: number): { negative: boolean; magnitude: string } {
  const expanded = value.toFixed(6);
  const negative = expanded.startsWith("-");
  return { negative, magnitude: roundDecimalString(negative ? expanded.slice(1) : expanded, 2) };
}

function isZero(magnitude: string): boolean {
  return magnitude.split("").every((c) => c === "0" || c === ".");
}

/** A premium or any other amount: two decimals, a minus sign when negative and no plus sign. */
export function formatCallAmount(value: number): string {
  const { negative, magnitude } = digits(value);
  return `${negative && !isZero(magnitude) ? "-" : ""}${magnitude} HKD`;
}

/** A per-share P&L: signed, two decimals, and colored by the HKEX convention through `direction`. */
export function formatCallPnl(value: number): CallMoney {
  const { negative, magnitude } = digits(value);
  const direction: CallDirection = isZero(magnitude) ? "flat" : negative ? "down" : "up";
  const sign = direction === "up" ? "+" : direction === "down" ? "-" : "";
  return { text: `${sign}${magnitude} HKD`, direction };
}

const NUMBER = /^\d+(\.\d+)?$/;

/**
 * What a field typed: a non-negative number clamped into the slider range, or `null` while the draft is not a
 * number yet, so a half-typed value never reaches the valuation.
 */
function applyDraft(draft: string, bounds: SliderBounds, integer: boolean): number | null {
  const text = draft.trim();
  if (!NUMBER.test(text)) return null;
  const value = integer ? Math.trunc(Number(text)) : Number(text);
  return Math.min(Math.max(value, bounds.min), bounds.max);
}

export function applySpotDraft(draft: string): number | null {
  return applyDraft(draft, SPOT_BOUNDS, false);
}

/** Days are whole days: the field shows an integer and a typed fraction is truncated, not rejected. */
export function applyDaysDraft(draft: string): number | null {
  return applyDraft(draft, DAYS_BOUNDS, true);
}

export function applyIvDraft(draft: string): number | null {
  return applyDraft(draft, IV_BOUNDS, false);
}
