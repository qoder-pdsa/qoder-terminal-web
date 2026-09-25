import { describe, expect, it } from "vitest";
import { VOLUME_HEIGHT_SHARE, VOLUME_PANE_INDEX, paneStretchFactors } from "./chartPanes";

describe("chartPanes", () => {
  it("gives the volume histogram a pane of its own, never the candle pane", () => {
    expect(VOLUME_PANE_INDEX).toBeGreaterThan(0);
  });

  it("sizes the volume pane to a quarter of the chart", () => {
    expect(VOLUME_HEIGHT_SHARE).toBe(0.25);
    expect(paneStretchFactors(VOLUME_HEIGHT_SHARE)).toEqual({ candles: 0.75, volume: 0.25 });
  });

  it.each([0.2, 0.25, 0.3, 0.33, 0.5])(
    "keeps the stretch factors summing to the whole chart for a %s share",
    (share) => {
      const stretch = paneStretchFactors(share);
      expect(stretch.volume).toBeCloseTo(share, 10);
      expect(stretch.candles).toBeCloseTo(1 - share, 10);
      expect(stretch.candles + stretch.volume).toBeCloseTo(1, 10);
    },
  );
});
