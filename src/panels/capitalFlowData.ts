import type { CapitalFlowPoint } from "../api/data";

export interface FlowBar {
  time: number;
  value: number;
  color: string;
}

export interface FlowColors {
  positive: string;
  negative: string;
}

/** The one place a capital-flow decimal string becomes a number, for the chart only. */
function decimal(value: string): number {
  return Number(value);
}

/** Per-minute bars for a histogram series: unix seconds, signed value, colored by sign. */
export function toFlowBars(flow: readonly CapitalFlowPoint[], colors: FlowColors): FlowBar[] {
  return flow.map((point) => {
    const value = decimal(point.inflow);
    return { time: Math.floor(Date.parse(point.time) / 1000), value, color: value < 0 ? colors.negative : colors.positive };
  });
}

const UNITS = [
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
  { threshold: 1e3, suffix: "K" },
] as const;

/** Trailing zeros may only leave the fraction: "1.50" → "1.5", "2.00" → "2", but "100" stays "100". */
function stripFractionZeros(digits: string): string {
  return digits.includes(".") ? digits.replace(/0+$/, "").replace(/\.$/, "") : digits;
}

/** Compact display of an amount ("12.3M"); display only, never fed back into arithmetic. */
export function formatAmount(value: string): string {
  const n = decimal(value);
  const abs = Math.abs(n);
  for (const { threshold, suffix } of UNITS) {
    if (abs >= threshold) return `${stripFractionZeros((n / threshold).toPrecision(3))}${suffix}`;
  }
  return String(Math.round(n));
}

/** Sign of a decimal string for coloring: "-0" and "0.0000" are flat. */
export function netSign(value: string): "up" | "down" | "flat" {
  if (/^-?0+(\.0+)?$/.test(value)) return "flat";
  return value.startsWith("-") ? "down" : "up";
}

/** The chart's clock follows the exchange, matching the `AS OF … HKT` header. */
export function exchangeTimeZone(symbol: string): string {
  if (symbol.endsWith(".US")) return "America/New_York";
  if (symbol.endsWith(".SH") || symbol.endsWith(".SZ")) return "Asia/Shanghai";
  return "Asia/Hong_Kong";
}

/** `HH:mm` of a unix timestamp in the given IANA zone, for axis ticks and the crosshair label. */
export function formatClock(unixSeconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(
    new Date(unixSeconds * 1000),
  );
}
