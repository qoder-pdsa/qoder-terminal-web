import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  CASH_ID,
  DEMO_PORTFOLIOS,
  FOCUS_SYMBOL,
  OTHER_ID,
  analyze,
  formatExposure,
  formatWeight,
  percentOf,
  portfolioById,
  setEtfWeight,
  weightFromInput,
} from "./xrayData";

const ONE = portfolioById("P1");
const TWO = portfolioById("P2");

const rowOf = (id: string) => {
  const row = analyze(ONE, FOCUS_SYMBOL).holdings.find((r) => r.id === id);
  if (!row) throw new Error(`no holding ${id}`);
  return row;
};

const symbolOf = (portfolioId: "P1" | "P2", symbol: string) => {
  const found = analyze(portfolioById(portfolioId), FOCUS_SYMBOL).symbols.find((s) => s.symbol === symbol);
  if (!found) throw new Error(`no symbol ${symbol}`);
  return found;
};

const boards = (portfolioId: "P1" | "P2") => {
  const a = analyze(portfolioById(portfolioId), FOCUS_SYMBOL);
  return { direct: a.directBoard.map((r) => r.symbol), look: a.lookThroughBoard.map((r) => r.symbol), analysis: a };
};

describe("the demo portfolios (requirement v2 §3)", () => {
  it("carries the baseline portfolio and the hidden-heavy portfolio", () => {
    expect(DEMO_PORTFOLIOS.map((p) => p.id)).toEqual(["P1", "P2"]);
    expect(DEMO_PORTFOLIOS.map((p) => p.label)).toEqual(["基准组合", "隐藏重仓组合"]);
  });

  it("keeps the v1 weights of portfolio one: NVDA 5%, ETF-A 40%, ETF-B 30%, cash 25%", () => {
    expect(ONE.direct.map((d) => [d.symbol, d.weight])).toEqual([["NVDA", 50]]);
    expect(ONE.etfs.map((e) => [e.id, e.weight, e.initialWeight])).toEqual([
      ["ETF-A", 400, 400],
      ["ETF-B", 300, 300],
    ]);
    expect(analyze(ONE, FOCUS_SYMBOL).cashWeight).toBe(250);
  });

  it("carries portfolio two: five direct positions, ETF-C 60% and 17.5% cash", () => {
    expect(TWO.direct.map((d) => [d.symbol, d.weight])).toEqual([
      ["AAPL", 60],
      ["MSFT", 50],
      ["GOOGL", 45],
      ["AMZN", 40],
      ["NVDA", 30],
    ]);
    expect(TWO.etfs.map((e) => [e.id, e.weight])).toEqual([["ETF-C", 600]]);
    expect(analyze(TWO, FOCUS_SYMBOL).cashWeight).toBe(175);
  });

  it.each([
    ["P1", "ETF-A", 1000],
    ["P1", "ETF-B", 1000],
    ["P2", "ETF-C", 1000],
  ])("portfolio %s %s lists constituents that add up to 100%", (portfolioId, etfId, total) => {
    const etf = portfolioById(portfolioId).etfs.find((e) => e.id === etfId);
    expect(etf?.constituents.reduce((sum, c) => sum + c.weight, 0)).toBe(total);
  });

  it("keeps every portfolio at 100% including cash", () => {
    for (const p of DEMO_PORTFOLIOS) {
      const a = analyze(p, FOCUS_SYMBOL);
      const invested = p.direct.reduce((s, d) => s + d.weight, 0) + p.etfs.reduce((s, e) => s + e.weight, 0);
      expect(invested + a.cashWeight).toBe(1000);
    }
  });
});

describe("v1 non-regression — portfolio one, focus NVDA (round 1, QA accepted)", () => {
  it("totals 10.0% on the unchanged demo portfolio", () => {
    expect(analyze(ONE, FOCUS_SYMBOL).focusExposure).toBe(10000);
    expect(formatExposure(analyze(ONE, FOCUS_SYMBOL).focusExposure)).toBe("10.0%");
  });

  it.each([
    ["NVDA", 5000, "5.0%"],
    ["ETF-A", 3200, "3.2%"],
    ["ETF-B", 1800, "1.8%"],
    ["CASH", 0, "0.0%"],
  ])("shows the %s holding contribution as %s", (id, contribution, text) => {
    expect(rowOf(id).contribution).toBe(contribution);
    expect(formatExposure(rowOf(id).contribution)).toBe(text);
  });

  it("renders the v1 holding rows in the same order with the same weights", () => {
    expect(analyze(ONE, FOCUS_SYMBOL).holdings.map((r) => [r.id, formatWeight(r.weight)])).toEqual([
      ["NVDA", "5%"],
      ["ETF-A", "40%"],
      ["ETF-B", "30%"],
      ["CASH", "25%"],
    ]);
  });

  it("keeps the v1 focus-weight column (NVDA inside each holding)", () => {
    expect(analyze(ONE, FOCUS_SYMBOL).holdings.map((r) => [r.id, formatWeight(r.focusWeight)])).toEqual([
      ["NVDA", "100%"],
      ["ETF-A", "8%"],
      ["ETF-B", "6%"],
      ["CASH", "0%"],
    ]);
  });

  it("marks only the ETF rows adjustable, up to their demo weight", () => {
    expect(analyze(ONE, FOCUS_SYMBOL).holdings.map((r) => [r.id, r.adjustable, percentOf(r.maxWeight)])).toEqual([
      ["NVDA", false, 0],
      ["ETF-A", true, 40],
      ["ETF-B", true, 30],
      ["CASH", false, 0],
    ]);
  });

  it("adds up the holding contributions to the focus exposure", () => {
    const a = analyze(ONE, FOCUS_SYMBOL);
    expect(a.holdings.reduce((sum, r) => sum + r.contribution, 0)).toBe(a.focusExposure);
  });

  it("moves a lowered ETF weight into cash and recalculates", () => {
    const next = setEtfWeight(ONE, "ETF-A", 0);
    const a = analyze(next, FOCUS_SYMBOL);
    expect(percentOf(a.cashWeight)).toBe(65);
    expect(formatExposure(a.focusExposure)).toBe("6.8%");
    expect(formatWeight(a.holdings.find((r) => r.id === "ETF-A")!.weight)).toBe("0%");
  });

  it.each([
    ["ETF-A", 20, "45%", "8.4%"],
    ["ETF-A", 39, "26%", "9.92%"],
    ["ETF-B", 15, "40%", "9.1%"],
    ["ETF-B", 20, "35%", "9.4%"],
  ])("lowers %s to %i%%, leaving %s cash and %s exposure", (etfId, percent, cash, total) => {
    const a = analyze(setEtfWeight(ONE, etfId, percent), FOCUS_SYMBOL);
    expect(formatWeight(a.cashWeight)).toBe(cash);
    expect(formatExposure(a.focusExposure)).toBe(total);
  });

  it("never raises an ETF above its demo position and never below zero", () => {
    expect(percentOf(analyze(setEtfWeight(ONE, "ETF-A", 55), FOCUS_SYMBOL).holdings.find((r) => r.id === "ETF-A")!.weight)).toBe(40);
    expect(percentOf(analyze(setEtfWeight(ONE, "ETF-B", 31), FOCUS_SYMBOL).holdings.find((r) => r.id === "ETF-B")!.weight)).toBe(30);
    expect(percentOf(analyze(setEtfWeight(ONE, "ETF-A", -10), FOCUS_SYMBOL).holdings.find((r) => r.id === "ETF-A")!.weight)).toBe(0);
    expect(formatExposure(analyze(setEtfWeight(ONE, "ETF-A", 55), FOCUS_SYMBOL).focusExposure)).toBe("10.0%");
  });

  it("rounds a fractional request down to whole percent positions", () => {
    const a = analyze(setEtfWeight(ONE, "ETF-A", 12.7), FOCUS_SYMBOL);
    expect(percentOf(a.holdings.find((r) => r.id === "ETF-A")!.weight)).toBe(12);
  });

  it("ignores a direct position, cash, an unknown id and a non-finite weight", () => {
    expect(setEtfWeight(ONE, "NVDA", 1)).toEqual(ONE);
    expect(setEtfWeight(ONE, CASH_ID, 10)).toEqual(ONE);
    expect(setEtfWeight(ONE, "NOPE", 10)).toEqual(ONE);
    expect(setEtfWeight(ONE, "ETF-A", Number.NaN)).toEqual(ONE);
    expect(setEtfWeight(ONE, "ETF-A", Number.POSITIVE_INFINITY)).toEqual(ONE);
  });

  it("keeps the portfolio at 100% after any adjustment and never mutates the input", () => {
    const before = JSON.stringify(ONE);
    for (const percent of [0, 7, 20, 40, 99]) {
      const a = analyze(setEtfWeight(ONE, "ETF-A", percent), FOCUS_SYMBOL);
      expect(a.holdings.reduce((sum, r) => sum + r.weight, 0)).toBe(1000);
    }
    expect(JSON.stringify(ONE)).toBe(before);
    expect(setEtfWeight(ONE, "ETF-A", 0)).not.toBe(ONE);
  });

  it("restores the demo exposure when an ETF is moved back up to its demo weight", () => {
    expect(formatExposure(analyze(setEtfWeight(setEtfWeight(ONE, "ETF-A", 0), "ETF-A", 40), FOCUS_SYMBOL).focusExposure)).toBe("10.0%");
  });
});

describe("look-through ranking (requirement v2 §3.1, §4)", () => {
  it("ranks the portfolio-one look-through board as NVDA, AAPL, MSFT, GOOGL, AMZN", () => {
    const { look, analysis } = boards("P1");
    expect(look).toEqual(["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN"]);
    expect(analysis.lookThroughBoard.map((r) => formatExposure(r.value))).toEqual([
      "10.0%",
      "5.7%",
      "5.0%",
      "4.0%",
      "3.85%",
    ]);
  });

  it("ranks the portfolio-one direct board by direct weight only", () => {
    const { direct, analysis } = boards("P1");
    expect(direct).toEqual(["NVDA"]);
    expect(formatExposure(analysis.directBoard[0].value)).toBe("5.0%");
  });

  it("shows the hidden-heavy reversal: NVDA is fifth direct and first look-through", () => {
    const { direct, look, analysis } = boards("P2");
    expect(direct).toEqual(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]);
    expect(look).toEqual(["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN"]);
    expect(analysis.directBoard.map((r) => formatExposure(r.value))).toEqual(["6.0%", "5.0%", "4.5%", "4.0%", "3.0%"]);
    expect(analysis.lookThroughBoard.map((r) => formatExposure(r.value))).toEqual([
      "21.0%",
      "12.0%",
      "11.0%",
      "9.3%",
      "7.6%",
    ]);
    expect(analysis.directBoard[4].rank).toBe(5);
    expect(analysis.lookThroughBoard[0].rank).toBe(1);
  });

  it("never ranks cash or the aggregated other bucket", () => {
    for (const portfolioId of ["P1", "P2"] as const) {
      const { direct, look, analysis } = boards(portfolioId);
      expect(direct).not.toContain(CASH_ID);
      expect(look).not.toContain(CASH_ID);
      expect(direct).not.toContain(OTHER_ID);
      expect(look).not.toContain(OTHER_ID);
      expect(analysis.symbols.map((s) => s.symbol)).not.toContain(OTHER_ID);
    }
  });

  it("caps both boards at five rows and ranks them from 1", () => {
    const { analysis } = boards("P2");
    expect(BOARD_SIZE).toBe(5);
    expect(analysis.lookThroughBoard).toHaveLength(BOARD_SIZE);
    expect(analysis.lookThroughBoard.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(analysis.symbols.filter((s) => s.effective === 3000).map((s) => s.symbol)).toEqual(["AVGO", "META"]);
  });

  it("counts a symbol that only exists inside an ETF, with no direct channel", () => {
    const avgo = symbolOf("P1", "AVGO");
    expect(avgo.direct).toBe(0);
    // AVGO is an ETF-A constituent only; ETF-B carries BRK.B and JPM instead (spec §3.1).
    expect(avgo.channels.map((c) => c.via)).toEqual(["ETF-A"]);
    expect(formatExposure(avgo.effective)).toBe("1.6%");
    expect(formatExposure(symbolOf("P1", "META").effective)).toBe("2.75%");
    expect(formatExposure(symbolOf("P1", "JPM").effective)).toBe("0.45%");
  });
});

describe("click-to-reconcile (requirement v2 §5)", () => {
  it("splits portfolio-two NVDA into 3.0% direct plus 18.0% through ETF-C", () => {
    const nvda = symbolOf("P2", "NVDA");
    expect(formatExposure(nvda.direct)).toBe("3.0%");
    expect(nvda.channels.map((c) => [c.via, formatExposure(c.contribution)])).toEqual([["ETF-C", "18.0%"]]);
    expect(formatExposure(nvda.effective)).toBe("21.0%");
  });

  it("shows the position and constituent weight behind each ETF channel", () => {
    const channel = symbolOf("P2", "NVDA").channels[0];
    expect([formatWeight(channel.etfWeight), formatWeight(channel.constituentWeight)]).toEqual(["60%", "30%"]);
  });

  it("sums direct plus every channel to the effective exposure for every symbol of both portfolios", () => {
    for (const portfolioId of ["P1", "P2"] as const) {
      for (const s of analyze(portfolioById(portfolioId), FOCUS_SYMBOL).symbols) {
        expect(s.direct + s.channels.reduce((sum, c) => sum + c.contribution, 0)).toBe(s.effective);
      }
    }
  });

  it("keeps the reconciliation exact after a rebalance", () => {
    const lowered = setEtfWeight(TWO, "ETF-C", 10);
    const nvda = analyze(lowered, FOCUS_SYMBOL).symbols.find((s) => s.symbol === "NVDA")!;
    expect(nvda.direct + nvda.channels.reduce((sum, c) => sum + c.contribution, 0)).toBe(nvda.effective);
    expect(formatExposure(nvda.effective)).toBe("6.0%");
    expect(formatExposure(nvda.channels[0].contribution)).toBe("3.0%");
  });

  it("does not mutate the analysis inputs", () => {
    const before = JSON.stringify(TWO);
    analyze(TWO, FOCUS_SYMBOL);
    expect(JSON.stringify(TWO)).toBe(before);
  });
});

describe("rebalance re-ranks (requirement v2 §5)", () => {
  it("puts AAPL back on top of portfolio two when ETF-C is lowered to 10%", () => {
    const a = analyze(setEtfWeight(TWO, "ETF-C", 10), FOCUS_SYMBOL);
    expect(a.lookThroughBoard.map((r) => r.symbol)).toEqual(["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN"]);
    expect(a.lookThroughBoard.map((r) => formatExposure(r.value))).toEqual(["7.0%", "6.0%", "6.0%", "5.3%", "4.6%"]);
    expect(formatWeight(a.cashWeight)).toBe("67.5%");
    // The direct board never moves: only ETF positions can be lowered.
    expect(a.directBoard.map((r) => r.symbol)).toEqual(["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"]);
  });

  it("re-ranks portfolio one on the same rules", () => {
    const a = analyze(setEtfWeight(ONE, "ETF-A", 0), FOCUS_SYMBOL);
    expect(a.lookThroughBoard.map((r) => r.symbol)).toEqual(["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN"]);
    expect(a.lookThroughBoard.map((r) => formatExposure(r.value))).toEqual(["6.8%", "2.1%", "1.8%", "1.2%", "1.05%"]);
  });

  it("breaks an exposure tie toward the more hidden position, then alphabetically", () => {
    // Requirement v2 §5: with ETF-C at 10%, NVDA (3.0 direct + 3.0 through ETF-C) and MSFT
    // (5.0 direct + 1.0 through ETF-C) both look through to 6.0%, and NVDA must rank second.
    const lowered = analyze(setEtfWeight(TWO, "ETF-C", 10), FOCUS_SYMBOL);
    expect(lowered.lookThroughBoard.slice(0, 3).map((r) => r.symbol)).toEqual(["AAPL", "NVDA", "MSFT"]);
    // AVGO and META both look through to 3.0% with no direct position, so the symbol decides.
    const tied = analyze(TWO, FOCUS_SYMBOL).symbols.filter((s) => s.effective === 3000);
    expect(tied.map((s) => s.symbol)).toEqual(["AVGO", "META"]);
  });

  it("adjusts the two portfolios independently", () => {
    const loweredTwo = setEtfWeight(TWO, "ETF-C", 10);
    expect(formatExposure(analyze(loweredTwo, FOCUS_SYMBOL).focusExposure)).toBe("6.0%");
    // Portfolio one is a separate immutable value and keeps its demo exposure.
    expect(formatExposure(analyze(ONE, FOCUS_SYMBOL).focusExposure)).toBe("10.0%");
    expect(loweredTwo.etfs.map((e) => e.weight)).toEqual([100]);
    expect(ONE.etfs.map((e) => e.weight)).toEqual([400, 300]);
  });

  it("only ever lowers an ETF position of the portfolio it is given", () => {
    expect(setEtfWeight(TWO, "ETF-A", 0)).toEqual(TWO);
    expect(percentOf(analyze(setEtfWeight(TWO, "ETF-C", 99), FOCUS_SYMBOL).holdings.find((r) => r.id === "ETF-C")!.weight)).toBe(60);
  });
});

describe("formatWeight", () => {
  it.each([
    [0, "0%"],
    [50, "5%"],
    [250, "25%"],
    [400, "40%"],
    [650, "65%"],
    [1000, "100%"],
    [45, "4.5%"],
    [175, "17.5%"],
    [675, "67.5%"],
    [35, "3.5%"],
  ])("renders %i deci-percent as %s", (deciPercent, text) => {
    expect(formatWeight(deciPercent)).toBe(text);
  });

  it("rounds a sub-tenth residue half-up rather than on a binary float", () => {
    expect(formatWeight(5)).toBe("0.5%");
    expect(percentOf(45)).toBe(4.5);
  });
});

describe("formatExposure", () => {
  it.each([
    [0, "0.0%"],
    [40, "0.04%"],
    [50, "0.05%"],
    [1050, "1.05%"],
    [1800, "1.8%"],
    [3200, "3.2%"],
    [3850, "3.85%"],
    [5000, "5.0%"],
    [6800, "6.8%"],
    [10000, "10.0%"],
    [21000, "21.0%"],
    [100000, "100.0%"],
  ])("renders %i milli-percent as %s", (milliPercent, text) => {
    expect(formatExposure(milliPercent)).toBe(text);
  });

  it("keeps every value the requester accepted in round one byte-identical", () => {
    // QA evidence pack 16921: 10.0% initial, 5.0 / 3.2 / 1.8 / 0.0% contributions,
    // 6.8% with ETF-A at 0, 9.4% with ETF-B at 20, 1.2% for ETF-B's own contribution.
    expect([10000, 5000, 3200, 1800, 0, 6800, 9400, 1200].map(formatExposure)).toEqual([
      "10.0%",
      "5.0%",
      "3.2%",
      "1.8%",
      "0.0%",
      "6.8%",
      "9.4%",
      "1.2%",
    ]);
  });

  it("rounds half-up on its own digits at the second decimal, never on a binary float", () => {
    expect(formatExposure(5254)).toBe("5.25%");
    expect(formatExposure(5255)).toBe("5.26%");
    expect(formatExposure(8155)).toBe("8.16%");
    expect(formatExposure(4)).toBe("0.0%");
    expect(formatExposure(5)).toBe("0.01%");
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
