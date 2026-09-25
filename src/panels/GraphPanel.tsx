import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
} from "lightweight-charts";
import { fetchHistory, fetchIndicator, HISTORY_RANGES, type Candle, type HistoryRange } from "../api/data";
import { crosshairDay, formatCandleReadout, toChartData, type ChartData } from "./chartData";
import { paneStretchFactors, VOLUME_HEIGHT_SHARE, VOLUME_PANE_INDEX } from "./chartPanes";
import { createTerminalChart, readChartTheme } from "./chartTheme";
import {
  INITIAL_OVERLAY_STATE,
  OVERLAY_KEYS,
  toggleOverlay,
  visibleOverlays,
  type OverlayKey,
  type OverlayState,
} from "./overlayState";

const SMA_WINDOWS = [20, 50] as const;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ok"; data: ChartData; candles: Candle[] };

export function GraphPanel({
  symbol,
  range,
  onRangeChange,
}: {
  symbol: string;
  range: HistoryRange;
  onRangeChange: (range: HistoryRange) => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [overlayState, setOverlayState] = useState<OverlayState>(INITIAL_OVERLAY_STATE);
  const [hovered, setHovered] = useState<Candle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (key: OverlayKey) => setOverlayState((prev) => toggleOverlay(prev, key));

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    setHovered(null);
    Promise.all([
      fetchHistory(symbol, range, controller.signal),
      Promise.all(SMA_WINDOWS.map((window) => fetchIndicator(symbol, "sma", window, range, controller.signal))),
    ])
      .then(([history, indicators]) => {
        const theme = readChartTheme();
        const data = toChartData(history, indicators, {
          up: theme.color("--candle-up"),
          down: theme.color("--candle-down"),
        });
        setState(data.candles.length === 0 ? { status: "empty" } : { status: "ok", data, candles: history });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    // The cleanup aborts the previous range's in-flight requests, so a slow reply can never overwrite the selected range.
    return () => controller.abort();
  }, [symbol, range]);

  useEffect(() => {
    const container = containerRef.current;
    if (state.status !== "ok" || !container) return;
    // Redrawing from already-fetched data: toggling an overlay never refetches the series.
    const data: ChartData = { ...state.data, overlays: visibleOverlays(state.data.overlays, overlayState) };
    const { chart, candleSeries } = mountChart(container, data);
    // Read back from the live chart, so the UI e2e fails if the volume pane ever goes missing.
    container.dataset.panes = String(chart.panes().length);

    // The readout quotes the contract candle, never the plotted one: setData turned those prices into numbers.
    const byDay = new Map(state.candles.map((candle) => [candle.time.slice(0, 10), candle]));
    const onCrosshair = (param: MouseEventParams) => {
      const day = crosshairDay(param.time);
      // Only a day the candle series actually plotted has a contract candle behind it.
      const candle = day !== undefined && param.seriesData.has(candleSeries) ? byDay.get(day) : undefined;
      setHovered(candle ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshair);
    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
    };
  }, [state, overlayState]);

  // Off the chart the crosshair reports nothing, so the line falls back to the last candle and is never empty.
  const shown = state.status === "ok" ? (hovered ?? state.candles[state.candles.length - 1]) : undefined;
  const readout = shown === undefined ? null : formatCandleReadout(shown);

  return (
    <div className="graph-panel" data-testid="graph-panel">
      <div className="graph-toolbar" data-testid="graph-toolbar">
        {HISTORY_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            className="range-button"
            data-testid={`range-${option}`}
            aria-pressed={option === range}
            onClick={() => onRangeChange(option)}
          >
            {option}
          </button>
        ))}
        {OVERLAY_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`toggle-${key}`}
            aria-pressed={overlayState[key]}
            onClick={() => toggle(key)}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
      {readout !== null && (
        <p className="candle-readout" data-testid="candle-readout" data-direction={readout.direction}>
          {`${readout.date}  O ${readout.open}  H ${readout.high}  L ${readout.low}  `}
          <span className="candle-readout-close">{`C ${readout.close}`}</span>
          {`  V ${readout.volume}`}
        </p>
      )}
      {state.status === "loading" && (
        <p className="muted">
          LOADING {symbol} {range}…
        </p>
      )}
      {state.status === "error" && (
        <p className="down" data-testid="graph-error">
          ERROR: {state.message}
        </p>
      )}
      {state.status === "empty" && (
        <p className="muted" data-testid="graph-empty">
          NO CANDLES FOR {symbol} {range}
        </p>
      )}
      {state.status === "ok" && (
        <div className="chart" ref={containerRef} data-testid="graph-chart" />
      )}
    </div>
  );
}

function mountChart(container: HTMLElement, data: ChartData): {
  chart: IChartApi;
  candleSeries: ISeriesApi<SeriesType>;
} {
  const theme = readChartTheme();
  const { color } = theme;
  const up = color("--candle-up");
  const down = color("--candle-down");
  const chart = createTerminalChart(container, theme);

  const candles: ISeriesApi<SeriesType> = chart.addSeries(CandlestickSeries, {
    upColor: up,
    downColor: down,
    wickUpColor: up,
    wickDownColor: down,
    borderUpColor: up,
    borderDownColor: down,
  });
  candles.setData(data.candles);

  const volume = chart.addSeries(
    HistogramSeries,
    { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "volume" } },
    VOLUME_PANE_INDEX,
  );
  volume.setData(data.volume);

  const overlayColors = [color("--amber"), color("--tool")];
  data.overlays.forEach((overlay, index) => {
    const line = chart.addSeries(LineSeries, {
      title: overlay.label,
      color: overlayColors[index % overlayColors.length],
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    line.setData(overlay.points);
  });

  // Both panes need a factor: the candle pane would otherwise keep the library default of 1 and
  // squeeze the histogram to a fifth of the chart instead of a quarter.
  const stretch = paneStretchFactors(VOLUME_HEIGHT_SHARE);
  chart.panes()[0].setStretchFactor(stretch.candles);
  chart.panes()[VOLUME_PANE_INDEX].setStretchFactor(stretch.volume);

  // No bottom margin, so the bars sit on the floor of their own pane.
  chart.priceScale("right", VOLUME_PANE_INDEX).applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });

  chart.timeScale().fitContent();
  return { chart, candleSeries: candles };
}
