import { useState } from "react";
import { CASH_ID, DEMO_HOLDINGS, exposure, formatExposure, setEtfWeight, weightFromInput, type XrayHolding } from "./xrayData";

/**
 * XRAY: how much NVDA the portfolio really holds once the ETFs are looked through.
 * Demo only — the portfolio is the fixed one in `xrayData.ts`; nothing here calls a service.
 */
export function XrayPanel() {
  const [holdings, setHoldings] = useState<readonly XrayHolding[]>(DEMO_HOLDINGS);
  const { rows, total } = exposure(holdings);

  const onWeight = (id: string, raw: string) => {
    const weight = weightFromInput(raw);
    if (weight === null) return;
    setHoldings((prev) => setEtfWeight(prev, id, weight));
  };

  return (
    <div data-testid="xray-panel">
      <p className="muted">DEMO PORTFOLIO · NVDA LOOK-THROUGH</p>
      <p className="big" data-testid="xray-total">
        {formatExposure(total)}
      </p>
      <p className="muted">Lower an ETF position; the difference returns to cash and the exposure is recalculated.</p>
      <table className="watchlist xray">
        <thead>
          <tr className="muted">
            <th>HOLDING</th>
            <th className="num">WEIGHT</th>
            <th className="num">NVDA INSIDE</th>
            <th className="num">EXPOSURE</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="xray-row" data-holding={row.id}>
              <td className="symbol">{row.label}</td>
              <td className="num">
                {row.adjustable && (
                  <input
                    type="range"
                    className="xray-weight"
                    data-testid={`xray-weight-${row.id}`}
                    min={0}
                    max={row.maxWeight}
                    step={1}
                    value={row.weight}
                    aria-label={`${row.label} weight in percent`}
                    onChange={(event) => onWeight(row.id, event.target.value)}
                  />
                )}
                <span data-testid={`xray-weight-value-${row.id}`}>{row.weight}%</span>
              </td>
              <td className="num muted">{row.id === CASH_ID ? "—" : `${row.nvdaWeight}%`}</td>
              <td className="num" data-testid={`xray-contribution-${row.id}`}>
                {formatExposure(row.contribution)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
