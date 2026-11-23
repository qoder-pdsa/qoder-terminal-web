import { describe, expect, it } from "vitest";
import {
  applyExpiryDraft,
  applyParamDraft,
  breakEvens,
  DEFAULT_EXPIRY,
  DEFAULT_OVME_PARAMS,
  EXPIRY_BOUNDS,
  expiryCurve,
  formatPnl,
  protectedMaxLoss,
  protectedPnl,
  snapToStep,
  toOvmeChartData,
  unprotectedPnl,
} from "./ovmeData";

// The requirement's demo parameters: Tencent stock at 350 HKD, protective put struck at 330 for a premium of 8.
describe("OVME defaults", () => {
  it("carries the confirmed demo parameters and an expiry range covering 245-350+", () => {
    expect(DEFAULT_OVME_PARAMS).toEqual({ stockCost: "350", strike: "330", premium: "8" });
    expect(EXPIRY_BOUNDS).toEqual({ min: "200", max: "450", step: "5" });
    expect(DEFAULT_EXPIRY).toBe("280");
  });
});

describe("unprotectedPnl", () => {
  it.each([
    ["280", "-70"],
    ["245", "-105"],
    ["330", "-20"],
    ["350", "0"],
    ["360", "10"],
  ])("S=%s with the demo cost 350 is %s", (expiry, expected) => {
    expect(unprotectedPnl(expiry, DEFAULT_OVME_PARAMS)).toBe(expected);
  });

  it("keeps the input scale instead of going through a float", () => {
    expect(unprotectedPnl("280", { stockCost: "350.25", strike: "330", premium: "8" })).toBe("-70.25");
    expect(unprotectedPnl("280.10", { stockCost: "350", strike: "330", premium: "8" })).toBe("-69.9");
  });
});

describe("protectedPnl", () => {
  it.each([
    // Pat's acceptance cases: the put caps the loss at the premium plus the strike distance.
    ["280", "-28"],
    ["245", "-28"],
    ["200", "-28"],
    ["330", "-28"],
    // Above the strike the put expires worthless, so the two lines differ by the premium alone.
    ["340", "-18"],
    ["358", "0"],
    ["360", "2"],
  ])("S=%s is %s per share", (expiry, expected) => {
    expect(protectedPnl(expiry, DEFAULT_OVME_PARAMS)).toBe(expected);
  });

  it("differs from the unprotected line by exactly the premium above the strike", () => {
    for (const expiry of ["331", "340", "350", "400", "450"]) {
      const unprotected = unprotectedPnl(expiry, DEFAULT_OVME_PARAMS);
      const protected_ = protectedPnl(expiry, DEFAULT_OVME_PARAMS);
      expect(Number(unprotected) - Number(protected_)).toBe(8);
    }
  });

  it("follows adjusted parameters", () => {
    expect(protectedPnl("280", { stockCost: "350.25", strike: "330", premium: "8.5" })).toBe("-28.75");
    // Below the strike the protected line is flat at strike - cost - premium, whatever S is.
    expect(protectedPnl("90", { stockCost: "100", strike: "95", premium: "2.5" })).toBe("-7.5");
    expect(protectedPnl("80", { stockCost: "100", strike: "95", premium: "2.5" })).toBe("-7.5");
    // Above it the put is worthless and only the premium separates the two lines.
    expect(protectedPnl("300", { stockCost: "100", strike: "95", premium: "2.5" })).toBe("197.5");
  });
});

describe("protectedMaxLoss", () => {
  it("is the locked value strike - cost - premium", () => {
    expect(protectedMaxLoss(DEFAULT_OVME_PARAMS)).toBe("-28");
    expect(protectedMaxLoss({ stockCost: "350.25", strike: "330", premium: "8.5" })).toBe("-28.75");
  });

  it("equals the protected P&L at every expiry at or below the strike", () => {
    const locked = protectedMaxLoss(DEFAULT_OVME_PARAMS);
    for (const expiry of ["200", "245", "280", "300", "330"]) {
      expect(protectedPnl(expiry, DEFAULT_OVME_PARAMS)).toBe(locked);
    }
  });
});

describe("breakEvens", () => {
  it("is the cost without protection and the cost plus the premium with it", () => {
    expect(breakEvens(DEFAULT_OVME_PARAMS)).toEqual({ unprotected: "350", protected: "358" });
  });

  it("is where each line actually crosses zero", () => {
    const { unprotected, protected: withPut } = breakEvens(DEFAULT_OVME_PARAMS);
    expect(unprotectedPnl(unprotected, DEFAULT_OVME_PARAMS)).toBe("0");
    expect(protectedPnl(withPut!, DEFAULT_OVME_PARAMS)).toBe("0");
  });

  it("reports no protected break-even when the put already locks in a non-negative P&L", () => {
    // strike 360 > cost 350: the protected line is +2 everywhere below the strike and rises above it.
    expect(breakEvens({ stockCost: "350", strike: "360", premium: "8" })).toEqual({
      unprotected: "350",
      protected: null,
    });
  });
});

describe("decimal exactness", () => {
  it("never shows the binary-float residue a Number() path would produce", () => {
    const params = { stockCost: "0.1", strike: "0", premium: "0.2" };
    expect(breakEvens(params).protected).toBe("0.3");
    expect(protectedMaxLoss(params)).toBe("-0.3");
    expect(unprotectedPnl("0.3", { stockCost: "0.1", strike: "0", premium: "0.2" })).toBe("0.2");
  });

  it("trims trailing zeros without dropping the integer part", () => {
    expect(unprotectedPnl("280", { stockCost: "350.00", strike: "330", premium: "8" })).toBe("-70");
    expect(protectedPnl("340.0000", { stockCost: "350", strike: "330", premium: "8.0000" })).toBe("-18");
  });
});

describe("expiryCurve", () => {
  it("samples the bounds inclusively on the step grid", () => {
    const curve = expiryCurve(DEFAULT_OVME_PARAMS, EXPIRY_BOUNDS);
    expect(curve).toHaveLength(51);
    expect(curve[0]).toEqual({ expiry: "200", unprotected: "-150", protected: "-28" });
    expect(curve[50]).toEqual({ expiry: "450", unprotected: "100", protected: "92" });
  });

  it("contains both acceptance expiries as grid points", () => {
    const expiries = expiryCurve(DEFAULT_OVME_PARAMS, EXPIRY_BOUNDS).map((p) => p.expiry);
    expect(expiries).toContain("245");
    expect(expiries).toContain("280");
  });

  it("follows the bounds it is given", () => {
    const curve = expiryCurve(DEFAULT_OVME_PARAMS, { min: "300", max: "320", step: "10" });
    expect(curve.map((p) => p.expiry)).toEqual(["300", "310", "320"]);
  });
});

describe("toOvmeChartData", () => {
  it("is the one place the decimal strings become chart numbers", () => {
    const data = toOvmeChartData(expiryCurve(DEFAULT_OVME_PARAMS, { min: "245", max: "280", step: "5" }));
    expect(data.unprotected).toEqual([
      { time: 245, value: -105 },
      { time: 250, value: -100 },
      { time: 255, value: -95 },
      { time: 260, value: -90 },
      { time: 265, value: -85 },
      { time: 270, value: -80 },
      { time: 275, value: -75 },
      { time: 280, value: -70 },
    ]);
    expect(data.protected.every((point) => point.value === -28)).toBe(true);
    expect(data.protected.map((point) => point.time)).toEqual(data.unprotected.map((point) => point.time));
  });
});

describe("applyExpiryDraft", () => {
  it.each([
    ["245", "245"],
    ["280", "280"],
    ["282.5", "282.5"],
    ["282.50", "282.5"],
    ["  300  ", "300"],
    ["200", "200"],
    ["450", "450"],
  ])("accepts %j as %s", (draft, expected) => {
    expect(applyExpiryDraft(draft)).toBe(expected);
  });

  it.each([
    ["500", "450"],
    ["1000", "450"],
    ["100", "200"],
    ["0", "200"],
  ])("clamps %j into the slider range as %s", (draft, expected) => {
    expect(applyExpiryDraft(draft)).toBe(expected);
  });

  it.each(["", " ", "abc", "-5", "+5", "1e3", "12.3.4", "1,000", "280港元", "."])("rejects %j", (draft) => {
    expect(applyExpiryDraft(draft)).toBeNull();
  });
});

describe("applyParamDraft", () => {
  it.each([
    ["350", "350"],
    ["330", "330"],
    ["8", "8"],
    ["8.125", "8.125"],
    ["350.00", "350"],
    ["0", "0"],
    [" 330 ", "330"],
  ])("accepts %j as %s", (draft, expected) => {
    expect(applyParamDraft(draft)).toBe(expected);
  });

  it.each(["", "abc", "-1", "1e3", "1,000", "12.3.4"])("rejects %j", (draft) => {
    expect(applyParamDraft(draft)).toBeNull();
  });
});

describe("snapToStep", () => {
  it.each([
    ["245", "245"],
    ["280", "280"],
    ["200", "200"],
    ["450", "450"],
    ["282.5", "285"],
    ["282", "280"],
    ["283", "285"],
  ])("snaps %s to the nearest grid point %s", (expiry, expected) => {
    expect(snapToStep(expiry, EXPIRY_BOUNDS)).toBe(expected);
  });
});

describe("formatPnl", () => {
  it.each([
    ["-70", { text: "-70.00 HKD", direction: "down" }],
    ["-28", { text: "-28.00 HKD", direction: "down" }],
    ["0", { text: "0.00 HKD", direction: "flat" }],
    ["10", { text: "+10.00 HKD", direction: "up" }],
    ["2.5", { text: "+2.50 HKD", direction: "up" }],
    ["-0.005", { text: "-0.01 HKD", direction: "down" }],
  ])("renders %s as %j", (value, expected) => {
    expect(formatPnl(value)).toEqual(expected);
  });
});
