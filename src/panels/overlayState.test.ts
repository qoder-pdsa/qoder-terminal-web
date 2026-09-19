import { describe, expect, it } from "vitest";
import type { ChartOverlay } from "./chartData";
import { INITIAL_OVERLAY_STATE, overlayKey, toggleOverlay, visibleOverlays } from "./overlayState";

const overlay = (label: string): ChartOverlay => ({ label, points: [] });

describe("overlay state", () => {
  it("starts with every overlay drawn", () => {
    expect(INITIAL_OVERLAY_STATE).toEqual({ sma20: true, sma50: true });
  });

  it("flips only the requested overlay", () => {
    expect(toggleOverlay(INITIAL_OVERLAY_STATE, "sma20")).toEqual({ sma20: false, sma50: true });
    expect(toggleOverlay(INITIAL_OVERLAY_STATE, "sma50")).toEqual({ sma20: true, sma50: false });
  });

  it("returns a new object and leaves the input untouched", () => {
    const frozen = Object.freeze({ ...INITIAL_OVERLAY_STATE });
    const next = toggleOverlay(frozen, "sma20");
    expect(next).not.toBe(frozen);
    expect(frozen).toEqual({ sma20: true, sma50: true });
  });

  it("restores the overlay when toggled twice", () => {
    expect(toggleOverlay(toggleOverlay(INITIAL_OVERLAY_STATE, "sma50"), "sma50")).toEqual(INITIAL_OVERLAY_STATE);
  });

  it("maps the chart overlay labels onto the toggle keys", () => {
    expect(overlayKey("SMA20")).toBe("sma20");
    expect(overlayKey("SMA50")).toBe("sma50");
    expect(overlayKey("EMA12")).toBeNull();
  });

  it("keeps hidden series out of the plotted overlays and never touches the rest", () => {
    const overlays = [overlay("SMA20"), overlay("SMA50"), overlay("EMA12")];
    expect(visibleOverlays(overlays, INITIAL_OVERLAY_STATE).map((o) => o.label)).toEqual(["SMA20", "SMA50", "EMA12"]);
    expect(visibleOverlays(overlays, { sma20: false, sma50: true }).map((o) => o.label)).toEqual(["SMA50", "EMA12"]);
    expect(visibleOverlays(overlays, { sma20: false, sma50: false }).map((o) => o.label)).toEqual(["EMA12"]);
  });

  it("does not mutate the overlays it filters", () => {
    const overlays = [overlay("SMA20"), overlay("SMA50")];
    visibleOverlays(overlays, { sma20: false, sma50: true });
    expect(overlays).toEqual([overlay("SMA20"), overlay("SMA50")]);
  });
});
