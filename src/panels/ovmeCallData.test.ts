import { describe, expect, it } from "vitest";
import {
  applyDaysDraft,
  applyIvDraft,
  applySpotDraft,
  attribution,
  blackScholesCall,
  CALL_NOW_DEFAULTS,
  CALL_PURCHASE,
  CALL_STRIKE,
  callCurve,
  currentPremium,
  DAYS_BOUNDS,
  formatCallAmount,
  formatCallPnl,
  holdToExpiryPnl,
  IV_BOUNDS,
  purchasePremium,
  sellTodayPnl,
  SPOT_BOUNDS,
} from "./ovmeCallData";

// Scenario 2 of workitem 10082 ("财报 IV 塌缩"): an ATM call bought before the earnings announcement is worth
// less after it, even though the stock rose. Every expected value below is the workitem body's acceptance value
// (±0.05) or a limit behaviour of Black-Scholes with r = q = 0 and T = days/365.
describe("the confirmed demo states", () => {
  it("carries the fixed purchase state and the adjustable default state", () => {
    expect(CALL_STRIKE).toBe(350);
    expect(CALL_PURCHASE).toEqual({ spot: 350, days: 30, ivPercent: 50 });
    expect(CALL_NOW_DEFAULTS).toEqual({ spot: 355, days: 29, ivPercent: 25 });
  });

  it("gives the three sliders ranges that cover the acceptance values", () => {
    expect(SPOT_BOUNDS).toEqual({ min: 250, max: 450, step: 5 });
    expect(DAYS_BOUNDS).toEqual({ min: 1, max: 90, step: 1 });
    expect(IV_BOUNDS).toEqual({ min: 5, max: 150, step: 5 });
    for (const [bounds, value] of [
      [SPOT_BOUNDS, CALL_NOW_DEFAULTS.spot],
      [DAYS_BOUNDS, CALL_NOW_DEFAULTS.days],
      [IV_BOUNDS, CALL_NOW_DEFAULTS.ivPercent],
    ] as const) {
      expect(value).toBeGreaterThanOrEqual(bounds.min);
      expect(value).toBeLessThanOrEqual(bounds.max);
    }
  });
});

describe("blackScholesCall", () => {
  it("prices the purchase state at the accepted ≈20.00", () => {
    expect(blackScholesCall(350, 350, 30, 50).price).toBeCloseTo(19.9982, 3);
  });

  it("prices the default current state at the accepted ≈12.61", () => {
    expect(blackScholesCall(355, 350, 29, 25).price).toBeCloseTo(12.6076, 3);
  });

  it("reports the purchase-state Greeks the attribution is built from", () => {
    const { delta, vega, theta } = blackScholesCall(350, 350, 30, 50);
    expect(delta).toBeCloseTo(0.5286, 3);
    expect(vega).toBeCloseTo(39.9279, 3);
    expect(theta).toBeCloseTo(-121.4475, 3);
  });

  it("collapses to the intrinsic value for a deep in-the-money call with no time left", () => {
    expect(blackScholesCall(400, 350, 1, 5).price).toBeCloseTo(50.0, 1);
    expect(blackScholesCall(360, 350, 1, 5).price).toBeCloseTo(10.0, 1);
  });

  it("is worthless for a deep out-of-the-money call", () => {
    expect(blackScholesCall(250, 350, 29, 25).price).toBeLessThan(0.01);
  });

  it("never returns a negative price and never goes below the discounted intrinsic value", () => {
    for (const spot of [250, 300, 350, 355, 400, 450]) {
      for (const days of [1, 29, 90]) {
        for (const ivPercent of [5, 25, 50, 150]) {
          const { price } = blackScholesCall(spot, 350, days, ivPercent);
          expect(price, `${spot}/${days}/${ivPercent}`).toBeGreaterThanOrEqual(0);
          expect(price, `${spot}/${days}/${ivPercent}`).toBeGreaterThanOrEqual(Math.max(spot - 350, 0) - 1e-9);
        }
      }
    }
  });

  it("rises with the underlying and with volatility, and falls as time runs out", () => {
    expect(blackScholesCall(380, 350, 29, 25).price).toBeGreaterThan(blackScholesCall(355, 350, 29, 25).price);
    expect(blackScholesCall(355, 350, 29, 50).price).toBeGreaterThan(blackScholesCall(355, 350, 29, 25).price);
    expect(blackScholesCall(355, 350, 29, 25).price).toBeGreaterThan(blackScholesCall(355, 350, 1, 25).price);
  });
});

describe("the two P&L lines the acceptance reads", () => {
  it("prices the position at ≈20.00 today and ≈12.61 now", () => {
    // A premium is an amount, not a P&L, so it carries no plus sign.
    expect(formatCallAmount(purchasePremium())).toBe("20.00 HKD");
    expect(formatCallAmount(currentPremium(CALL_NOW_DEFAULTS))).toBe("12.61 HKD");
  });

  it("sells today at −7.39 and holds to expiry at −15.00 with the default parameters", () => {
    expect(formatCallPnl(sellTodayPnl(CALL_NOW_DEFAULTS)).text).toBe("-7.39 HKD");
    expect(formatCallPnl(holdToExpiryPnl(CALL_NOW_DEFAULTS.spot)).text).toBe("-15.00 HKD");
  });

  it.each([
    [250, "-20.00 HKD"],
    [340, "-20.00 HKD"],
    [350, "-20.00 HKD"],
    [355, "-15.00 HKD"],
    [380, "+10.00 HKD"],
    [450, "+80.00 HKD"],
  ])("holds to expiry at S=%s for %s", (spot, expected) => {
    expect(formatCallPnl(holdToExpiryPnl(spot)).text).toBe(expected);
  });

  it.each([
    [{ spot: 380, days: 29, ivPercent: 25 }, "+11.54 HKD"],
    [{ spot: 355, days: 29, ivPercent: 50 }, "+2.40 HKD"],
    [{ spot: 350, days: 29, ivPercent: 25 }, "-10.16 HKD"],
    [{ spot: 355, days: 60, ivPercent: 25 }, "-3.11 HKD"],
    [{ spot: 300, days: 29, ivPercent: 25 }, "-19.88 HKD"],
  ])("sells today for %s at %j", (state, expected) => {
    expect(formatCallPnl(sellTodayPnl(state)).text).toBe(expected);
  });

  it("answers the demo question: the stock rose and the call still lost, because the vol drop dominates", () => {
    const { stock, vol } = attribution(CALL_NOW_DEFAULTS);
    expect(CALL_NOW_DEFAULTS.spot - CALL_PURCHASE.spot).toBe(5);
    expect(sellTodayPnl(CALL_NOW_DEFAULTS)).toBeLessThan(0);
    expect(stock).toBeGreaterThan(0);
    expect(Math.abs(vol)).toBeGreaterThan(Math.abs(stock));
  });

  it("leaves the hold-to-expiry line untouched by IV and by the remaining days", () => {
    const hold = holdToExpiryPnl(355);
    expect(holdToExpiryPnl(355)).toBe(hold);
    expect(formatCallPnl(sellTodayPnl({ spot: 355, days: 29, ivPercent: 50 })).text).not.toBe(
      formatCallPnl(sellTodayPnl({ spot: 355, days: 29, ivPercent: 25 })).text,
    );
  });
});

describe("attribution", () => {
  it("splits the default move into stock, time and vol with the accepted values", () => {
    const { stock, time, vol, firstOrder, residual } = attribution(CALL_NOW_DEFAULTS);
    expect(formatCallPnl(stock).text).toBe("+2.64 HKD");
    expect(formatCallPnl(time).text).toBe("-0.33 HKD");
    expect(formatCallPnl(vol).text).toBe("-9.98 HKD");
    expect(formatCallPnl(firstOrder).text).toBe("-7.67 HKD");
    expect(formatCallPnl(residual).text).toBe("+0.28 HKD");
  });

  it("uses the purchase-state Greeks over the actual changes", () => {
    const { delta, vega, theta } = blackScholesCall(CALL_PURCHASE.spot, CALL_STRIKE, CALL_PURCHASE.days, CALL_PURCHASE.ivPercent);
    const { stock, time, vol } = attribution(CALL_NOW_DEFAULTS);
    expect(stock).toBeCloseTo(delta * (CALL_NOW_DEFAULTS.spot - CALL_PURCHASE.spot), 9);
    expect(time).toBeCloseTo(theta * ((CALL_PURCHASE.days - CALL_NOW_DEFAULTS.days) / 365), 9);
    expect(vol).toBeCloseTo(vega * ((CALL_NOW_DEFAULTS.ivPercent - CALL_PURCHASE.ivPercent) / 100), 9);
  });

  it.each([
    { spot: 355, days: 29, ivPercent: 25 },
    { spot: 380, days: 29, ivPercent: 25 },
    { spot: 355, days: 29, ivPercent: 50 },
    { spot: 355, days: 1, ivPercent: 25 },
    { spot: 300, days: 60, ivPercent: 150 },
  ])("closes: first order + residual = the actual P&L at %j", (state) => {
    const { firstOrder, residual } = attribution(state);
    expect(firstOrder + residual).toBeCloseTo(sellTodayPnl(state), 9);
  });

  it("is all zero when nothing moved", () => {
    const { stock, time, vol, residual } = attribution(CALL_PURCHASE);
    expect(stock).toBe(0);
    expect(time).toBe(0);
    expect(vol).toBe(0);
    expect(residual).toBeCloseTo(0, 9);
  });
});

describe("callCurve", () => {
  it("samples both lines over the spot range, inclusive of both bounds", () => {
    const curve = callCurve(CALL_NOW_DEFAULTS);
    expect(curve).toHaveLength(41);
    expect(curve[0]).toEqual({ spot: 250, sellToday: expect.any(Number), holdToExpiry: expect.any(Number) });
    expect(curve[40].spot).toBe(450);
    expect(curve.map((p) => p.spot)).toContain(355);
  });

  it("carries the acceptance readings at the default spot", () => {
    const point = callCurve(CALL_NOW_DEFAULTS).find((p) => p.spot === 355);
    expect(point).toBeDefined();
    expect(formatCallPnl(point!.sellToday).text).toBe("-7.39 HKD");
    expect(formatCallPnl(point!.holdToExpiry).text).toBe("-15.00 HKD");
  });

  it("keeps the hold-to-expiry line flat below the strike and one premium apart above it", () => {
    const curve = callCurve(CALL_NOW_DEFAULTS);
    const below = curve.filter((p) => p.spot <= CALL_STRIKE);
    expect(below.every((p) => formatCallPnl(p.holdToExpiry).text === "-20.00 HKD")).toBe(true);
    for (const p of curve.filter((x) => x.spot > CALL_STRIKE)) {
      // Above the strike the two lines differ only by the option's remaining time value.
      expect(p.sellToday - p.holdToExpiry).toBeCloseTo(
        currentPremium({ ...CALL_NOW_DEFAULTS, spot: p.spot }) - Math.max(p.spot - CALL_STRIKE, 0),
        9,
      );
    }
  });

  it("follows the state it is given", () => {
    const calm = callCurve({ spot: 355, days: 29, ivPercent: 50 });
    const collapsed = callCurve(CALL_NOW_DEFAULTS);
    expect(calm.find((p) => p.spot === 355)!.sellToday).toBeGreaterThan(
      collapsed.find((p) => p.spot === 355)!.sellToday,
    );
    expect(calm.find((p) => p.spot === 355)!.holdToExpiry).toBe(collapsed.find((p) => p.spot === 355)!.holdToExpiry);
  });

  it("ignores the state's own spot, which is what lets the panel skip a redraw while the slider moves", () => {
    expect(callCurve({ spot: 400, days: 29, ivPercent: 25 })).toEqual(callCurve(CALL_NOW_DEFAULTS));
  });
});

describe("formatCallPnl", () => {
  it.each([
    [-7.390615, { text: "-7.39 HKD", direction: "down" }],
    [-14.998235, { text: "-15.00 HKD", direction: "down" }],
    [19.998235, { text: "+20.00 HKD", direction: "up" }],
    [2.642845, { text: "+2.64 HKD", direction: "up" }],
    [-0.332733, { text: "-0.33 HKD", direction: "down" }],
    [0, { text: "0.00 HKD", direction: "flat" }],
    [-0.0001, { text: "0.00 HKD", direction: "flat" }],
  ])("renders %s as %j", (value, expected) => {
    expect(formatCallPnl(value)).toEqual(expected);
  });

  it("rounds half-up on the digits, not on the binary float", () => {
    // (1.005).toFixed(2) is "1.00" because 1.005 is stored below the halfway point.
    expect(formatCallPnl(1.005).text).toBe("+1.01 HKD");
    expect(formatCallPnl(-1.005).text).toBe("-1.01 HKD");
  });

  it("never leaks float residue into a displayed number", () => {
    for (const value of [0.1 + 0.2, 1 / 3, -2 / 3, 1e-9, 12.6076203]) {
      const { text } = formatCallPnl(value);
      expect(text).toMatch(/^[+-]?\d+\.\d{2} HKD$/);
      expect(text).not.toMatch(/e[+-]?\d/i);
    }
  });
});

describe("formatCallAmount", () => {
  it.each([
    [19.998235, "20.00 HKD"],
    [12.60762, "12.61 HKD"],
    [31.541398, "31.54 HKD"],
    [0.000004, "0.00 HKD"],
    [1.005, "1.01 HKD"],
  ])("renders the premium %s as %s", (value, expected) => {
    expect(formatCallAmount(value)).toBe(expected);
  });

  it("keeps the minus sign but never a plus sign", () => {
    expect(formatCallAmount(-2.5)).toBe("-2.50 HKD");
    expect(formatCallAmount(2.5)).toBe("2.50 HKD");
  });
});

describe("the three input drafts", () => {
  it.each([
    ["355", 355],
    ["355.5", 355.5],
    [" 380 ", 380],
    ["250", 250],
    ["450", 450],
  ])("accepts the spot draft %j as %s", (draft, expected) => {
    expect(applySpotDraft(draft)).toBe(expected);
  });

  it.each([
    ["500", 450],
    ["100", 250],
    ["0", 250],
  ])("clamps the spot draft %j to %s", (draft, expected) => {
    expect(applySpotDraft(draft)).toBe(expected);
  });

  it.each(["", " ", "abc", "-5", "+5", "1e3", "12.3.4", "1,000", "355港元", "."])("rejects the spot draft %j", (draft) => {
    expect(applySpotDraft(draft)).toBeNull();
  });

  it.each([
    ["29", 29],
    ["1", 1],
    ["90", 90],
    ["29.7", 29],
    ["0", 1],
    ["120", 90],
  ])("applies the days draft %j as %s", (draft, expected) => {
    expect(applyDaysDraft(draft)).toBe(expected);
  });

  it.each(["", "abc", "-3", "1e2", "2.5.5"])("rejects the days draft %j", (draft) => {
    expect(applyDaysDraft(draft)).toBeNull();
  });

  it.each([
    ["25", 25],
    ["25.5", 25.5],
    ["50", 50],
    ["0", 5],
    ["400", 150],
  ])("applies the IV draft %j as %s", (draft, expected) => {
    expect(applyIvDraft(draft)).toBe(expected);
  });

  it.each(["", "abc", "-25", "1e2"])("rejects the IV draft %j", (draft) => {
    expect(applyIvDraft(draft)).toBeNull();
  });
});
