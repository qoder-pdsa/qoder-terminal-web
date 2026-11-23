import { describe, expect, it } from "vitest";
import {
  CASH_ID,
  DEMO_HOLDINGS,
  exposure,
  formatExposure,
  setEtfWeight,
  weightFromInput,
  type XrayHolding,
} from "./xrayData";

const DEMO = DEMO_HOLDINGS;

function rowOf(holdings: readonly XrayHolding[], id: string) {
  const row = exposure(holdings).rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
}

function weightOf(holdings: readonly XrayHolding[], id: string): number {
  if (id === CASH_ID) return exposure(holdings).cashWeight;
  const holding = holdings.find((h) => h.id === id);
  if (!holding) throw new Error(`no holding ${id}`);
  return holding.weight;
}

function totalOf(holdings: readonly XrayHolding[]): number {
  return exposure(holdings).total;
}

describe("the demo portfolio (requirement §3)", () => {
  it("holds NVDA 5%, ETF-A 40% with 8% NVDA and ETF-B 30% with 6% NVDA", () => {
    expect(DEMO.map((h) => [h.id, h.weight, h.nvdaWeight])).toEqual([
      ["NVDA", 5, 100],
      ["ETF-A", 40, 8],
      ["ETF-B", 30, 6],
    ]);
  });

  it("leaves the remaining 25% in cash", () => {
    expect(exposure(DEMO).cashWeight).toBe(25);
    expect(rowOf(DEMO, CASH_ID).weight).toBe(25);
  });

  it("marks only the ETF rows as adjustable, up to their demo weight", () => {
    expect(DEMO.map((h) => h.id)).toEqual(["NVDA", "ETF-A", "ETF-B"]);
    expect(exposure(DEMO).rows.map((r) => [r.id, r.adjustable, r.maxWeight])).toEqual([
      ["NVDA", false, 0],
      ["ETF-A", true, 40],
      ["ETF-B", true, 30],
      ["CASH", false, 0],
    ]);
  });
});

describe("exposure (requirement §4: direct + Σ ETF weight × ETF NVDA weight)", () => {
  it("totals 10.0% on the unchanged demo portfolio", () => {
    expect(totalOf(DEMO)).toBe(1000);
    expect(formatExposure(totalOf(DEMO))).toBe("10.0%");
  });

  it.each([
    ["NVDA", 500, "5.0%"],
    ["ETF-A", 320, "3.2%"],
    ["ETF-B", 180, "1.8%"],
    ["CASH", 0, "0.0%"],
  ])("shows the %s contribution as %s", (id, contribution, text) => {
    expect(rowOf(DEMO, id).contribution).toBe(contribution);
    expect(formatExposure(rowOf(DEMO, id).contribution)).toBe(text);
  });

  it("adds up the contributions of every row", () => {
    const rows = exposure(DEMO).rows;
    expect(rows.reduce((sum, r) => sum + r.contribution, 0)).toBe(totalOf(DEMO));
  });

  it("applies the look-through formula to any weights, not just the demo ones", () => {
    const holdings: readonly XrayHolding[] = [
      { id: "NVDA", label: "NVDA", kind: "direct", weight: 10, initialWeight: 10, nvdaWeight: 100 },
      { id: "ETF-X", label: "ETF-X", kind: "etf", weight: 50, initialWeight: 50, nvdaWeight: 7 },
    ];
    // 10% direct + 50% × 7% = 13.5%
    expect(totalOf(holdings)).toBe(1350);
    expect(rowOf(holdings, "ETF-X").contribution).toBe(350);
    expect(exposure(holdings).cashWeight).toBe(40);
  });

  it("counts cash as no exposure however large it is", () => {
    expect(rowOf(setEtfWeight(DEMO, "ETF-A", 0), CASH_ID).contribution).toBe(0);
    expect(rowOf(setEtfWeight(DEMO, "ETF-B", 0), CASH_ID).contribution).toBe(0);
  });

  it("does not mutate the holdings it reads", () => {
    const before = JSON.stringify(DEMO);
    exposure(DEMO);
    expect(JSON.stringify(DEMO)).toBe(before);
  });
});

describe("setEtfWeight (requirement §5: only lower, the difference returns to cash)", () => {
  it("moves the whole reduced difference into cash", () => {
    const next = setEtfWeight(DEMO, "ETF-A", 0);
    expect(weightOf(next, "ETF-A")).toBe(0);
    expect(weightOf(next, CASH_ID)).toBe(65);
    expect(weightOf(next, "NVDA")).toBe(5);
    expect(weightOf(next, "ETF-B")).toBe(30);
  });

  it("recalculates the total exposure immediately", () => {
    expect(formatExposure(totalOf(setEtfWeight(DEMO, "ETF-A", 0)))).toBe("6.8%");
    expect(formatExposure(totalOf(setEtfWeight(DEMO, "ETF-B", 0)))).toBe("8.2%");
  });

  it.each([
    ["ETF-A", 20, 45, 840],
    ["ETF-A", 39, 26, 992],
    ["ETF-B", 15, 40, 910],
    ["ETF-B", 30, 25, 1000],
  ])("lowers %s to %i%%, leaving %i%% cash and %i hundredths of a percent exposure", (id, weight, cash, total) => {
    const next = setEtfWeight(DEMO, id, weight);
    expect(weightOf(next, id)).toBe(weight);
    expect(weightOf(next, CASH_ID)).toBe(cash);
    expect(totalOf(next)).toBe(total);
  });

  it("never raises an ETF above its demo position", () => {
    expect(weightOf(setEtfWeight(DEMO, "ETF-A", 55), "ETF-A")).toBe(40);
    expect(weightOf(setEtfWeight(DEMO, "ETF-B", 31), "ETF-B")).toBe(30);
    expect(totalOf(setEtfWeight(DEMO, "ETF-A", 55))).toBe(1000);
  });

  it("never lowers an ETF below zero", () => {
    expect(weightOf(setEtfWeight(DEMO, "ETF-A", -10), "ETF-A")).toBe(0);
    expect(weightOf(setEtfWeight(DEMO, "ETF-A", -10), CASH_ID)).toBe(65);
  });

  it("rounds a fractional request down to whole percent positions", () => {
    expect(weightOf(setEtfWeight(DEMO, "ETF-A", 12.7), "ETF-A")).toBe(12);
  });

  it("leaves the direct holding and cash alone", () => {
    expect(setEtfWeight(DEMO, "NVDA", 1)).toEqual(DEMO);
    expect(setEtfWeight(DEMO, CASH_ID, 10)).toEqual(DEMO);
    expect(setEtfWeight(DEMO, "NOPE", 10)).toEqual(DEMO);
  });

  it("ignores a weight that is not a finite number", () => {
    expect(setEtfWeight(DEMO, "ETF-A", Number.NaN)).toEqual(DEMO);
    expect(setEtfWeight(DEMO, "ETF-A", Number.POSITIVE_INFINITY)).toEqual(DEMO);
  });

  it("keeps the portfolio at 100% after any adjustment", () => {
    for (const weight of [0, 7, 20, 40, 99]) {
      const next = setEtfWeight(DEMO, "ETF-A", weight);
      const rows = exposure(next).rows;
      expect(rows.reduce((sum, r) => sum + r.weight, 0)).toBe(100);
    }
  });

  it("restores the demo exposure when an ETF is moved back up to its demo weight", () => {
    expect(totalOf(setEtfWeight(setEtfWeight(DEMO, "ETF-A", 0), "ETF-A", 40))).toBe(1000);
  });

  it("does not mutate the input array or its holdings", () => {
    const before = JSON.stringify(DEMO);
    const next = setEtfWeight(DEMO, "ETF-A", 0);
    expect(JSON.stringify(DEMO)).toBe(before);
    expect(next).not.toBe(DEMO);
    expect(next[1]).not.toBe(DEMO[1]);
  });
});

describe("formatExposure", () => {
  it.each([
    [0, "0.0%"],
    [4, "0.0%"],
    [5, "0.1%"],
    [180, "1.8%"],
    [320, "3.2%"],
    [500, "5.0%"],
    [680, "6.8%"],
    [1000, "10.0%"],
    [10000, "100.0%"],
  ])("renders %i hundredths of a percent as %s", (centiPercent, text) => {
    expect(formatExposure(centiPercent)).toBe(text);
  });

  it("rounds half-up on its own digits, never on a binary float", () => {
    expect(formatExposure(314)).toBe("3.1%");
    expect(formatExposure(315)).toBe("3.2%");
    expect(formatExposure(316)).toBe("3.2%");
    // 8.15% is 0.15 away from a float tie; toFixed would render the binary neighbour.
    expect(formatExposure(815)).toBe("8.2%");
  });
});

describe("weightFromInput (the weight control is the only numeric boundary)", () => {
  it.each([
    ["0", 0],
    ["7", 7],
    ["40", 40],
  ])("reads the control value %j as %i", (raw, weight) => {
    expect(weightFromInput(raw)).toBe(weight);
  });

  it.each(["", " ", "1.5", "12%", "abc", "-3", "1e2"])("rejects %j", (raw) => {
    expect(weightFromInput(raw)).toBeNull();
  });
});
