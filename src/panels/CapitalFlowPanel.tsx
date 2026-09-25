import { useEffect, useRef, useState } from "react";
import { ColorType, HistogramSeries, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { fetchCapitalFlow, type CapitalBuckets, type CapitalFlow } from "../api/data";
import { exchangeTimeZone, formatAmount, formatClock, netSign, toFlowBars } from "./capitalFlowData";
import { formatHkTime } from "./quoteFormat";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: CapitalFlow };

const BUCKETS: (keyof CapitalBuckets)[] = ["large", "medium", "small"];

/** `700 CF`: per-minute net inflow bars and the large / medium / small order distribution. */
export function CapitalFlowPanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchCapitalFlow(symbol, controller.signal)
      .then((data) => setState({ status: "ok", data }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => {
    const container = containerRef.current;
    if (state.status !== "ok" || !container || state.data.flow.length === 0) return;
    const chart = mountFlowChart(container, state.data);
    return () => chart.remove();
  }, [state]);

  if (state.status === "loading") return <p className="muted">LOADING {symbol} CAPITAL FLOW…</p>;
  if (state.status === "error") return <p className="down" data-testid="cf-error">ERROR: {state.message}</p>;

  const { data } = state;
  return (
    <div data-testid="cf-panel">
      <div className="muted">
        NET INFLOW PER MINUTE · {data.currency} · AS OF {formatHkTime(data.asOf)}
      </div>
      {data.flow.length === 0 ? (
        <p className="muted" data-testid="cf-empty">NO INTRADAY FLOW YET — the first bar appears after the first trade of the session</p>
      ) : (
        <div className="chart chart-flow" ref={containerRef} data-testid="cf-chart" />
      )}
      <table className="cf-distribution" data-testid="cf-distribution">
        <thead>
          <tr className="muted">
            <th>ORDERS</th>
            <th className="num">IN</th>
            <th className="num">OUT</th>
            <th className="num">NET</th>
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((bucket) => (
            <tr key={bucket} data-testid={`cf-${bucket}`}>
              <td>{bucket.toUpperCase()}</td>
              <td className="num">{formatAmount(data.distribution.in[bucket])}</td>
              <td className="num">{formatAmount(data.distribution.out[bucket])}</td>
              <td className="num quote-change" data-direction={netSign(data.distribution.net[bucket])}>
                {formatAmount(data.distribution.net[bucket])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function mountFlowChart(container: HTMLElement, data: CapitalFlow): IChartApi {
  const root = getComputedStyle(document.documentElement);
  const color = (name: string) => root.getPropertyValue(name).trim();
  const border = color("--border");
  const timeZone = exchangeTimeZone(data.symbol);
  const clock = (time: unknown) => formatClock(Number(time), timeZone);
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: color("--panel") },
      textColor: color("--muted"),
      fontFamily: root.fontFamily,
      attributionLogo: false,
    },
    grid: { vertLines: { color: border }, horzLines: { color: border } },
    rightPriceScale: { borderColor: border },
    localization: { timeFormatter: clock },
    timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, tickMarkFormatter: clock },
  });
  const bars = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
  const flow = toFlowBars(data.flow, { positive: color("--candle-up"), negative: color("--candle-down") });
  bars.setData(flow.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp })));
  chart.timeScale().fitContent();
  return chart;
}
