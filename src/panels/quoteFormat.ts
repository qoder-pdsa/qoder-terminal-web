export type ChangeDirection = "up" | "down" | "flat";

export interface FormattedChange {
  text: string;
  direction: ChangeDirection;
}

const ARROW: Record<ChangeDirection, string> = { up: "▲", down: "▼", flat: "▬" };
const DIGITS = "0123456789";

const HK_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hong_Kong",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function splitSign(value: string): { negative: boolean; magnitude: string } {
  const negative = value.startsWith("-");
  const magnitude = negative || value.startsWith("+") ? value.slice(1) : value;
  return { negative, magnitude };
}

function isZero(magnitude: string): boolean {
  return magnitude.split("").every((c) => c === "0" || c === ".");
}

function incrementDigits(digits: string): string {
  const out = digits.split("");
  for (let i = out.length - 1; i >= 0; i--) {
    const next = DIGITS.indexOf(out[i]) + 1;
    if (next === 10) {
      out[i] = "0";
      continue;
    }
    out[i] = DIGITS[next];
    return out.join("");
  }
  return `1${out.join("")}`;
}

/**
 * Rounds an unsigned decimal string half-up on its own digits. `toFixed` is unusable here:
 * it rounds the binary float, so 1.005 becomes "1.00".
 */
export function roundDecimalString(value: string, decimals: number): string {
  const [intPart, fracPart = ""] = value.split(".");
  const kept = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const roundUp = fracPart.length > decimals && fracPart[decimals] >= "5";
  const bumped = roundUp ? incrementDigits(intPart + kept) : intPart + kept;

  const split = bumped.length - kept.length;
  const roundedInt = bumped.slice(0, split) || "0";
  const roundedFrac = bumped.slice(split);
  return decimals === 0 ? roundedInt : `${roundedInt}.${roundedFrac}`;
}

/** Formats the contract's decimal strings for display without doing arithmetic on them. */
export function formatChange(change: string, changePercent: string): FormattedChange {
  const { negative, magnitude } = splitSign(change);
  const direction: ChangeDirection = isZero(magnitude) ? "flat" : negative ? "down" : "up";

  const percent = splitSign(changePercent);
  const roundedPercent = roundDecimalString(percent.magnitude, 2);
  const signedPercent = isZero(percent.magnitude)
    ? roundedPercent
    : `${percent.negative ? "-" : "+"}${roundedPercent}`;

  const signedChange = direction === "up" ? `+${magnitude}` : direction === "down" ? `-${magnitude}` : magnitude;
  return { text: `${ARROW[direction]} ${signedChange} (${signedPercent}%)`, direction };
}

/** Renders an ISO-8601 timestamp on the Hong Kong wall clock as `HH:mm HKT`. */
export function formatHkTime(asOf: string): string {
  const parts = HK_TIME.formatToParts(new Date(asOf));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  return `${hour}:${minute} HKT`;
}
