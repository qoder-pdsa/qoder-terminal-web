import { useEffect, useMemo, useRef, useState } from "react";
import { LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { createTerminalChart, readChartTheme } from "./chartTheme";
import {
  applyExpiryDraft,
  applyParamDraft,
  breakEvens,
  DEFAULT_EXPIRY,
  DEFAULT_OVME_PARAMS,
  EXPIRY_BOUNDS,
  expiryCurve,
  formatPnl,
  protectedMaxLoss,
  protectedPnl,
  snapToStep,
  toOvmeChartData,
  unprotectedPnl,
  type OvmeParams,
} from "./ovmeData";

/** The four editable numbers of the panel; each has its own draft so a half-typed value is never applied. */
type Field = keyof OvmeParams | "expiry";

type Drafts = Record<Field, string>;

function initialDrafts(): Drafts {
  return { ...DEFAULT_OVME_PARAMS, expiry: DEFAULT_EXPIRY };
}

/**
 * `700 OVME`: expiry P&L per share of the stock alone against the stock plus a protective put.
 * Every number is user input, so the panel fetches nothing and only ever renders decimal strings.
 */
export function OvmePanel({ symbol }: { symbol: string }) {
  const [params, setParams] = useState<OvmeParams>(DEFAULT_OVME_PARAMS);
  const [expiry, setExpiry] = useState<string>(DEFAULT_EXPIRY);
  const [drafts, setDrafts] = useState<Drafts>(initialDrafts);
  const containerRef = useRef<HTMLDivElement>(null);

  // The curves depend on the parameters alone, so moving the expiry slider never redraws the chart.
  const curve = useMemo(() => expiryCurve(params, EXPIRY_BOUNDS), [params]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = mountOvmeChart(container, toOvmeChartData(curve));
    return () => chart.remove();
  }, [curve]);

  const applied: Drafts = { ...params, expiry };

  const onDraft = (field: Field, raw: string) => {
    setDrafts((prev) => ({ ...prev, [field]: raw }));
    if (field === "expiry") {
      const value = applyExpiryDraft(raw);
      if (value !== null) setExpiry(value);
      return;
    }
    const value = applyParamDraft(raw);
    if (value !== null) setParams((prev) => ({ ...prev, [field]: value }));
  };

  // Leaving a field shows the value actually in force again, so the field and the math never disagree.
  const onCommit = (field: Field) => setDrafts((prev) => ({ ...prev, [field]: applied[field] }));

  const noPut = formatPnl(unprotectedPnl(expiry, params));
  const withPut = formatPnl(protectedPnl(expiry, params));
  const locked = formatPnl(protectedMaxLoss(params));
  const even = breakEvens(params);

  const renderField = (field: Field, label: string, testId: string) => (
    <label className="ovme-field">
      <span className="muted">{label}</span>
      <input
        data-testid={testId}
        value={drafts[field]}
        inputMode="decimal"
        onChange={(e) => onDraft(field, e.target.value)}
        onBlur={() => onCommit(field)}
      />
    </label>
  );

  return (
    <div className="ovme-panel" data-testid="ovme-panel">
      <p className="ovme-heading muted">
        PROTECTIVE PUT · {symbol} · HKD PER SHARE AT EXPIRY
      </p>
      <div className="panel-toolbar ovme-toolbar">
        {renderField("stockCost", "COST", "ovme-cost-input")}
        {renderField("strike", "STRIKE", "ovme-strike-input")}
        {renderField("premium", "PREMIUM", "ovme-premium-input")}
        {renderField("expiry", "EXPIRY", "ovme-expiry-input")}
      </div>
      <input
        className="ovme-slider"
        type="range"
        data-testid="ovme-slider"
        min={EXPIRY_BOUNDS.min}
        max={EXPIRY_BOUNDS.max}
        step={EXPIRY_BOUNDS.step}
        value={snapToStep(expiry, EXPIRY_BOUNDS)}
        aria-label="Expiry price"
        onChange={(e) => onDraft("expiry", e.target.value)}
      />
      <div className="ovme-readout">
        <span className="ovme-pnl" data-testid="ovme-unprotected" data-direction={noPut.direction}>
          NO PUT {noPut.text}
        </span>
        <span className="ovme-pnl" data-testid="ovme-protected" data-direction={withPut.direction}>
          WITH PUT {withPut.text}
        </span>
      </div>
      <p className="ovme-facts muted">
        {"BREAK-EVEN "}
        <span data-testid="ovme-breakeven-unprotected">{`${even.unprotected} HKD`}</span>
        {" / "}
        <span data-testid="ovme-breakeven-protected">{even.protected === null ? "—" : `${even.protected} HKD`}</span>
        {"  MAX LOSS LOCKED "}
        <span className="ovme-pnl" data-testid="ovme-max-loss" data-direction={locked.direction}>
          {locked.text}
        </span>
      </p>
      <div className="chart chart-ovme" ref={containerRef} data-testid="ovme-chart" />
    </div>
  );
}

/** The two expiry P&L lines; the x axis is the expiry price, so it formats itself rather than as a date. */
function mountOvmeChart(container: HTMLElement, data: ReturnType<typeof toOvmeChartData>): IChartApi {
  const theme = readChartTheme();
  const { color } = theme;
  const axis = (time: unknown) => String(Number(time));
  const chart = createTerminalChart(container, theme, {
    localization: { timeFormatter: axis },
    timeScale: { timeVisible: false, tickMarkFormatter: axis },
  });
  const stamp = <T extends { time: number }>(p: T) => ({ ...p, time: p.time as UTCTimestamp });
  const money = { type: "price" as const, precision: 2, minMove: 0.01 };

  const noPut = chart.addSeries(LineSeries, {
    title: "NO PUT",
    color: color("--amber"),
    lineWidth: 2,
    priceFormat: money,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  noPut.setData(data.unprotected.map(stamp));
  // Zero P&L is the line both curves are read against, so it stays visible on a one-sided chart.
  noPut.createPriceLine({ price: 0, color: color("--muted"), lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

  const withPut = chart.addSeries(LineSeries, {
    title: "WITH PUT",
    color: color("--tool"),
    lineWidth: 2,
    priceFormat: money,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  withPut.setData(data.protected.map(stamp));

  chart.timeScale().fitContent();
  return chart;
}
