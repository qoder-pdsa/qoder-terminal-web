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
import {
  applyDaysDraft,
  applyIvDraft,
  applySpotDraft,
  attribution,
  CALL_NOW_DEFAULTS,
  CALL_PURCHASE,
  CALL_STRIKE,
  callCurve,
  currentPremium,
  DAYS_BOUNDS,
  formatCallAmount,
  formatCallPnl,
  holdToExpiryPnl,
  IV_BOUNDS,
  purchasePremium,
  sellTodayPnl,
  SPOT_BOUNDS,
  type CallCurvePoint,
  type CallState,
  type SliderBounds,
} from "./ovmeCallData";

/** The four editable numbers of the put scenario; each has its own draft so a half-typed value is never applied. */
type Field = keyof OvmeParams | "expiry";

type Drafts = Record<Field, string>;

function initialDrafts(): Drafts {
  return { ...DEFAULT_OVME_PARAMS, expiry: DEFAULT_EXPIRY };
}

/** The scenario the panel shows; the protective put stays the default so the accepted flows open on it. */
type Scenario = "put" | "call";

/**
 * `700 OVME`: two option scenarios over the same underlying. Scenario 1 compares the expiry P&L of the stock
 * alone with the stock plus a protective put; scenario 2 shows why a call bought before the earnings lost money
 * after them. Every number is user input or derived from it, so the panel fetches nothing.
 */
export function OvmePanel({ symbol }: { symbol: string }) {
  const [scenario, setScenario] = useState<Scenario>("put");
  return (
    <div className="ovme-panel" data-testid="ovme-panel">
      <div className="ovme-tabs" role="tablist" aria-label="OVME scenario">
        <button
          type="button"
          role="tab"
          className="ovme-tab"
          data-testid="ovme-tab-put"
          aria-selected={scenario === "put"}
          onClick={() => setScenario("put")}
        >
          PROTECTIVE PUT
        </button>
        <button
          type="button"
          role="tab"
          className="ovme-tab"
          data-testid="ovme-tab-call"
          aria-selected={scenario === "call"}
          onClick={() => setScenario("call")}
        >
          EARNINGS IV
        </button>
      </div>
      {scenario === "put" ? <PutScenario symbol={symbol} /> : <CallScenario symbol={symbol} />}
    </div>
  );
}

/** Scenario 1 — protective put: expiry P&L per share of the stock alone against the stock plus the put. */
function PutScenario({ symbol }: { symbol: string }) {
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
    <div className="ovme-scenario" data-testid="ovme-put-scenario">
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

type CallField = "spot" | "days" | "iv";

type CallDrafts = Record<CallField, string>;

function initialCallDrafts(): CallDrafts {
  return {
    spot: String(CALL_NOW_DEFAULTS.spot),
    days: String(CALL_NOW_DEFAULTS.days),
    iv: String(CALL_NOW_DEFAULTS.ivPercent),
  };
}

/** Scenario 2 — earnings IV collapse: selling the call today against holding it to expiry. */
function CallScenario({ symbol }: { symbol: string }) {
  const [state, setState] = useState<CallState>(CALL_NOW_DEFAULTS);
  const [drafts, setDrafts] = useState<CallDrafts>(initialCallDrafts);
  const containerRef = useRef<HTMLDivElement>(null);
  const { days, ivPercent } = state;

  // The sampled lines depend on the days left and the IV alone (`callCurve` ignores the spot it is given), so
  // dragging the stock-price slider moves the readouts without redrawing the chart.
  const curve = useMemo(() => callCurve(state), [days, ivPercent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = mountCallChart(container, curve);
    return () => chart.remove();
  }, [curve]);

  const onDraft = (field: CallField, raw: string) => {
    setDrafts((prev) => ({ ...prev, [field]: raw }));
    if (field === "spot") {
      const value = applySpotDraft(raw);
      if (value !== null) setState((prev) => ({ ...prev, spot: value }));
      return;
    }
    if (field === "days") {
      const value = applyDaysDraft(raw);
      if (value !== null) setState((prev) => ({ ...prev, days: value }));
      return;
    }
    const value = applyIvDraft(raw);
    if (value !== null) setState((prev) => ({ ...prev, ivPercent: value }));
  };

  // Leaving a field shows the value actually in force again, so the field and the valuation never disagree.
  const onCommit = (field: CallField) =>
    setDrafts((prev) => ({
      ...prev,
      spot: field === "spot" ? String(state.spot) : prev.spot,
      days: field === "days" ? String(state.days) : prev.days,
      iv: field === "iv" ? String(state.ivPercent) : prev.iv,
    }));

  const bought = formatCallAmount(purchasePremium());
  const now = formatCallAmount(currentPremium(state));
  const sell = formatCallPnl(sellTodayPnl(state));
  const hold = formatCallPnl(holdToExpiryPnl(state.spot));
  const why = attribution(state);

  const term = (label: string, testId: string, value: number) => {
    const shown = formatCallPnl(value);
    return (
      <>
        {label === "" ? "" : `${label} `}
        <span className="ovme-pnl" data-testid={testId} data-direction={shown.direction}>
          {shown.text}
        </span>
      </>
    );
  };

  const renderField = (field: CallField, label: string, testId: string) => (
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

  const slider = (field: CallField, testId: string, label: string, bounds: SliderBounds, value: number) => (
    <input
      className="ovme-slider"
      type="range"
      data-testid={testId}
      min={bounds.min}
      max={bounds.max}
      step={bounds.step}
      value={value}
      aria-label={label}
      onChange={(e) => onDraft(field, e.target.value)}
    />
  );

  return (
    <div className="ovme-scenario" data-testid="ovme-call-scenario">
      <p className="ovme-heading muted">
        EARNINGS IV COLLAPSE · {symbol} · CALL K {CALL_STRIKE} · HKD PER SHARE
      </p>
      <div className="ovme-states">
        <div className="ovme-state">
          <span className="muted">BOUGHT (PRE-EARNINGS, FIXED)</span>
          <span data-testid="ovme-call-purchase-state">
            S {CALL_PURCHASE.spot} · K {CALL_STRIKE} · {CALL_PURCHASE.days}D · IV {CALL_PURCHASE.ivPercent}%
          </span>
          <span className="ovme-premium" data-testid="ovme-call-premium-buy">
            PREMIUM {bought}
          </span>
        </div>
        <div className="ovme-state">
          <span className="muted">NOW (POST-EARNINGS, ADJUSTABLE)</span>
          <div className="panel-toolbar ovme-toolbar">
            {renderField("spot", "SPOT", "ovme-call-spot-input")}
            {renderField("days", "DAYS", "ovme-call-days-input")}
            {renderField("iv", "IV %", "ovme-call-iv-input")}
          </div>
          <span className="ovme-premium" data-testid="ovme-call-premium-now">
            PREMIUM {now}
          </span>
        </div>
      </div>
      {slider("spot", "ovme-call-spot-slider", "Stock price", SPOT_BOUNDS, state.spot)}
      {slider("days", "ovme-call-days-slider", "Days to expiry", DAYS_BOUNDS, state.days)}
      {slider("iv", "ovme-call-iv-slider", "Implied volatility percent", IV_BOUNDS, state.ivPercent)}
      <div className="ovme-readout">
        <span className="ovme-pnl" data-testid="ovme-call-sell-today" data-direction={sell.direction}>
          SELL TODAY {sell.text}
        </span>
        <span className="ovme-pnl" data-testid="ovme-call-hold-expiry" data-direction={hold.direction}>
          HOLD TO EXPIRY {hold.text}
        </span>
      </div>
      <p className="ovme-facts muted" data-testid="ovme-call-attribution">
        {"WHY "}
        {term("STOCK", "ovme-call-attr-stock", why.stock)}
        {" · "}
        {term("TIME", "ovme-call-attr-time", why.time)}
        {" · "}
        {term("VOL", "ovme-call-attr-vol", why.vol)}
        {" = "}
        {term("FIRST ORDER", "ovme-call-attr-first-order", why.firstOrder)}
        {", SECOND-ORDER RESIDUAL "}
        {term("", "ovme-call-attr-residual", why.residual)}
      </p>
      <div className="chart chart-ovme" ref={containerRef} data-testid="ovme-call-chart" />
    </div>
  );
}

/** One chart, two lines: closing the call now against holding it to expiry, over the stock-price range. */
function mountCallChart(container: HTMLElement, curve: readonly CallCurvePoint[]): IChartApi {
  const theme = readChartTheme();
  const { color } = theme;
  const axis = (time: unknown) => String(Number(time));
  const chart = createTerminalChart(container, theme, {
    localization: { timeFormatter: axis },
    timeScale: { timeVisible: false, tickMarkFormatter: axis },
  });
  const money = { type: "price" as const, precision: 2, minMove: 0.01 };

  const sell = chart.addSeries(LineSeries, {
    title: "SELL TODAY",
    color: color("--amber"),
    lineWidth: 2,
    priceFormat: money,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  sell.setData(curve.map((p) => ({ time: p.spot as UTCTimestamp, value: p.sellToday })));
  sell.createPriceLine({ price: 0, color: color("--muted"), lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

  const hold = chart.addSeries(LineSeries, {
    title: "HOLD TO EXPIRY",
    color: color("--tool"),
    lineWidth: 2,
    priceFormat: money,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  hold.setData(curve.map((p) => ({ time: p.spot as UTCTimestamp, value: p.holdToExpiry })));

  chart.timeScale().fitContent();
  return chart;
}
