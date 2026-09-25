/** The volume histogram lives in its own pane so the candle price axis stops at the candles. */
export const VOLUME_PANE_INDEX = 1;

/** Share of the chart height the volume pane takes; the candles keep the rest. */
export const VOLUME_HEIGHT_SHARE = 0.25;

/**
 * Pane stretch factors for the candle and volume panes.
 *
 * lightweight-charts sizes panes by relative stretch factor, and a factor only equals its share of
 * the height when the factors sum to 1 — setting just the volume pane would leave the candle pane at
 * the library default of 1 and squeeze the histogram to a fifth instead of a quarter.
 */
export function paneStretchFactors(volumeShare: number): { candles: number; volume: number } {
  return { candles: 1 - volumeShare, volume: volumeShare };
}
