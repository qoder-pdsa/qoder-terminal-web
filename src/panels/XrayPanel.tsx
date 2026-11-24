import { useState } from "react";
import {
  CASH_ID,
  DEMO_PORTFOLIOS,
  FOCUS_SYMBOL,
  analyze,
  formatExposure,
  formatWeight,
  percentOf,
  setEtfWeight,
  weightFromInput,
  type Portfolio,
} from "./xrayData";

/**
 * XRAY: what the portfolio really holds once the ETFs are looked through.
 * Demo only — both portfolios are the fixed ones in `xrayData.ts`; nothing here calls a service.
 */
export function XrayPanel() {
  // One entry per demo portfolio, so lowering a position in one never moves the other (§5).
  const [portfolios, setPortfolios] = useState<readonly Portfolio[]>(DEMO_PORTFOLIOS);
  const [selectedId, setSelectedId] = useState<string>(DEMO_PORTFOLIOS[0].id);
  const [expanded, setExpanded] = useState<string | null>(null);

  const portfolio = portfolios.find((p) => p.id === selectedId) ?? DEMO_PORTFOLIOS[0];
  const analysis = analyze(portfolio, FOCUS_SYMBOL);
  const detail = expanded === null ? null : (analysis.symbols.find((s) => s.symbol === expanded) ?? null);

  const onWeight = (etfId: string, raw: string) => {
    const weight = weightFromInput(raw);
    if (weight === null) return;
    setPortfolios((prev) => prev.map((p) => (p.id === portfolio.id ? setEtfWeight(p, etfId, weight) : p)));
  };

  const select = (id: string) => {
    setSelectedId(id);
    setExpanded(null);
  };

  const toggle = (symbol: string) => setExpanded((prev) => (prev === symbol ? null : symbol));

  return (
    <div data-testid="xray-panel">
      <div className="panel-toolbar">
        {portfolios.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`xray-portfolio-${p.id}`}
            aria-pressed={p.id === portfolio.id}
            onClick={() => select(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="muted">{portfolio.label} · {FOCUS_SYMBOL} LOOK-THROUGH</p>
      <p className="big" data-testid="xray-total">
        {formatExposure(analysis.focusExposure)}
      </p>
      <p className="muted">Lower an ETF position; the difference returns to cash and both boards re-rank at once.</p>

      <table className="watchlist xray">
        <thead>
          <tr className="muted">
            <th>HOLDING</th>
            <th className="num">WEIGHT</th>
            <th className="num">{FOCUS_SYMBOL} INSIDE</th>
            <th className="num">EXPOSURE</th>
          </tr>
        </thead>
        <tbody>
          {analysis.holdings.map((row) => (
            <tr key={row.id} data-testid="xray-row" data-holding={row.id}>
              <td className="symbol">{row.label}</td>
              <td className="num">
                {row.adjustable && (
                  <input
                    type="range"
                    className="xray-weight"
                    data-testid={`xray-weight-${row.id}`}
                    min={0}
                    max={percentOf(row.maxWeight)}
                    step={1}
                    value={percentOf(row.weight)}
                    aria-label={`${row.label} weight in percent`}
                    onChange={(event) => onWeight(row.id, event.target.value)}
                  />
                )}
                <span data-testid={`xray-weight-value-${row.id}`}>{formatWeight(row.weight)}</span>
              </td>
              <td className="num muted">{row.id === CASH_ID ? "—" : formatWeight(row.focusWeight)}</td>
              <td className="num" data-testid={`xray-contribution-${row.id}`}>
                {formatExposure(row.contribution)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="xray-boards">
        <section>
          <h3 className="muted">DIRECT BOARD</h3>
          <ol className="xray-board" data-testid="xray-board-direct">
            {analysis.directBoard.map((row) => (
              <li key={row.symbol} data-testid="xray-direct-row" data-symbol={row.symbol} data-rank={row.rank}>
                <button
                  type="button"
                  className="xray-rank"
                  data-testid={`xray-open-direct-${row.symbol}`}
                  aria-expanded={expanded === row.symbol}
                  onClick={() => toggle(row.symbol)}
                >
                  <span className="muted">{row.rank}</span> <span className="symbol">{row.symbol}</span>{" "}
                  <span className="num">{formatExposure(row.value)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="muted">LOOK-THROUGH BOARD</h3>
          <ol className="xray-board" data-testid="xray-board-lookthrough">
            {analysis.lookThroughBoard.map((row) => (
              <li key={row.symbol} data-testid="xray-look-row" data-symbol={row.symbol} data-rank={row.rank}>
                <button
                  type="button"
                  className="xray-rank"
                  data-testid={`xray-open-look-${row.symbol}`}
                  aria-expanded={expanded === row.symbol}
                  onClick={() => toggle(row.symbol)}
                >
                  <span className="muted">{row.rank}</span> <span className="symbol">{row.symbol}</span>{" "}
                  <span className="num">{formatExposure(row.value)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {detail && (
        <div className="xray-detail" data-testid={`xray-detail-${detail.symbol}`}>
          <h3 className="muted">{detail.symbol} · RECONCILIATION</h3>
          <ul>
            {detail.direct > 0 && (
              <li data-testid="xray-channel-direct">
                DIRECT <span className="num">{formatExposure(detail.direct)}</span>
              </li>
            )}
            {detail.channels.map((channel) => (
              <li key={channel.via} data-testid={`xray-channel-${channel.via}`}>
                VIA {channel.label} ({formatWeight(channel.etfWeight)} × {formatWeight(channel.constituentWeight)}){" "}
                <span className="num">{formatExposure(channel.contribution)}</span>
              </li>
            ))}
          </ul>
          <p data-testid="xray-detail-total">
            EFFECTIVE <span className="num">{formatExposure(detail.effective)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
