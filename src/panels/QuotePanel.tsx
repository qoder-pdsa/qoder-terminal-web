import { useEffect, useRef, useState } from "react";
import { BaselineSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { fetchIntraday, fetchQuote, type Intraday, type Quote } from "../api/data";
import { exchangeTimeZone, formatClock } from "./capitalFlowData";
import { createTerminalChart, readChartTheme } from "./chartTheme";
import { toIntradayData } from "./intradayData";
import { formatChange, formatHkTime } from "./quoteFormat";

/** The quote and its intraday line are re-fetched this often while the panel is open. */
export const QUOTE_POLL_MS = 10_000;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; quote: Quote; intraday: Intraday };

export function QuotePanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    const poll = () =>
      Promise.all([fetchQuote(symbol, controller.signal), fetchIntraday(symbol, controller.signal)])
        .then(([quote, intraday]) => setState({ status: "ok", quote, intraday }))
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          // A failed refresh keeps the last good quote on screen; only the first load shows the error.
          setState((prev) =>
            prev.status === "ok" ? prev : { status: "error", message: err instanceof Error ? err.message : String(err) },
          );
        });
    void poll();
    const timer = setInterval(() => void poll(), QUOTE_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (state.status !== "ok" || !container || state.intraday.points.length === 0) return;
    const chart = mountIntradayChart(container, state.intraday);
    return () => chart.remove();
  }, [state]);

  if (state.status === "loading") return <p className="muted">LOADING {symbol}…</p>;
  if (state.status === "error") return <p className="down">ERROR: {state.message}</p>;

  const { quote, intraday } = state;
  const change = formatChange(quote.change, quote.changePercent);
  return (
    <div data-testid="quote-panel">
      <div className="quote-head">
        <div className="big">{quote.symbol}</div>
        <div className="big" data-testid="quote-price">
          {quote.price} <span className="muted">{quote.currency}</span>
        </div>
        <div className="quote-change" data-testid="quote-change" data-direction={change.direction}>
          {change.text}
        </div>
        <div className="muted">
          AS OF <span data-testid="quote-asof">{formatHkTime(quote.asOf)}</span> · PREV {intraday.prevClose}
        </div>
      </div>
      {intraday.points.length === 0 ? (
        <p className="muted" data-testid="quote-intraday-empty">NO TRADES YET — the intraday line starts with the first trade of the session</p>
      ) : (
        <div className="chart chart-intraday" ref={containerRef} data-testid="quote-chart" />
      )}
    </div>
  );
}

/** Price as a baseline area against the previous close (red above, green below), plus the average price. */
function mountIntradayChart(container: HTMLElement, intraday: Intraday): IChartApi {
  const theme = readChartTheme();
  const { color } = theme;
  const up = color("--candle-up");
  const down = color("--candle-down");
  const timeZone = exchangeTimeZone(intraday.symbol);
  const clock = (time: unknown) => formatClock(Number(time), timeZone);
  const data = toIntradayData(intraday);
  const stamp = <T extends { time: number }>(p: T) => ({ ...p, time: p.time as UTCTimestamp });

  const chart = createTerminalChart(container, theme, {
    localization: { timeFormatter: clock },
    timeScale: { timeVisible: true, secondsVisible: false, tickMarkFormatter: clock },
  });
  const price = chart.addSeries(BaselineSeries, {
    baseValue: { type: "price", price: data.baseline },
    topLineColor: up,
    topFillColor1: `${up}66`,
    topFillColor2: `${up}00`,
    bottomLineColor: down,
    bottomFillColor1: `${down}00`,
    bottomFillColor2: `${down}66`,
    lineWidth: 1,
    priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    // Keep the previous close inside the visible range even on a day spent entirely on one side of it.
    autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
      const info = original();
      if (!info) return info;
      return {
        ...info,
        priceRange: {
          minValue: Math.min(info.priceRange.minValue, data.baseline),
          maxValue: Math.max(info.priceRange.maxValue, data.baseline),
        },
      };
    },
  });
  price.setData(data.prices.map(stamp));
  price.createPriceLine({ price: data.baseline, color: color("--muted"), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "PREV" });

  const average = chart.addSeries(LineSeries, {
    color: color("--amber"),
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  average.setData(data.average.map(stamp));

  chart.timeScale().fitContent();
  return chart;
}
