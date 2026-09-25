import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, HistogramSeries, LineSeries, type IChartApi } from "lightweight-charts";
import { fetchHistory, fetchIndicator, HISTORY_RANGES, type HistoryRange } from "../api/data";
import { toChartData, type ChartData } from "./chartData";
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

/** Candle area plus the volume area below it; the UI e2e reads this back as `data-panes`. */
const CHART_PANES = 2;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ok"; data: ChartData };

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
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (key: OverlayKey) => setOverlayState((prev) => toggleOverlay(prev, key));

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
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
        setState(data.candles.length === 0 ? { status: "empty" } : { status: "ok", data });
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
    const chart = mountChart(container, data);
    return () => chart.remove();
  }, [state, overlayState]);

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
        <div className="chart" ref={containerRef} data-testid="graph-chart" data-panes={CHART_PANES} />
      )}
    </div>
  );
}

function mountChart(container: HTMLElement, data: ChartData): IChartApi {
  const theme = readChartTheme();
  const { color } = theme;
  const up = color("--candle-up");
  const down = color("--candle-down");
  const chart = createTerminalChart(container, theme);

  const candles = chart.addSeries(CandlestickSeries, {
    upColor: up,
    downColor: down,
    wickUpColor: up,
    wickDownColor: down,
    borderUpColor: up,
    borderDownColor: down,
  });
  candles.setData(data.candles);

  const volume = chart.addSeries(HistogramSeries, {
    priceScaleId: "volume",
    priceLineVisible: false,
    lastValueVisible: false,
    priceFormat: { type: "volume" },
  });
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

  // The volume histogram keeps the bottom quarter; candles and overlays are squeezed above it.
  chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
  chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.3 } });

  chart.timeScale().fitContent();
  return chart;
}
