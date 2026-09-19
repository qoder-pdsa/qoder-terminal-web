import type { ChartOverlay } from "./chartData";

/** The overlays a graph panel can switch off; each panel owns its own copy of the state. */
export const OVERLAY_KEYS = ["sma20", "sma50"] as const;

export type OverlayKey = (typeof OVERLAY_KEYS)[number];

export type OverlayState = Record<OverlayKey, boolean>;

export const INITIAL_OVERLAY_STATE: OverlayState = { sma20: true, sma50: true };

export function toggleOverlay(state: OverlayState, key: OverlayKey): OverlayState {
  return { ...state, [key]: !state[key] };
}

/** Chart overlay labels are upper-case (`SMA20`); `null` means this panel has no toggle for it. */
export function overlayKey(label: string): OverlayKey | null {
  const lower = label.toLowerCase();
  return (OVERLAY_KEYS as readonly string[]).includes(lower) ? (lower as OverlayKey) : null;
}

/** Overlays nobody can toggle stay drawn, so a future indicator is never hidden by accident. */
export function visibleOverlays(overlays: readonly ChartOverlay[], state: OverlayState): ChartOverlay[] {
  return overlays.filter((overlay) => {
    const key = overlayKey(overlay.label);
    return key === null || state[key];
  });
}
