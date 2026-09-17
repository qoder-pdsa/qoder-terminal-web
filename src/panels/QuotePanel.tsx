import { useEffect, useState } from "react";
import { fetchQuote, type Quote } from "../api/data";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; quote: Quote };

export function QuotePanel({ symbol }: { symbol: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchQuote(symbol, controller.signal)
      .then((quote) => setState({ status: "ok", quote }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => controller.abort();
  }, [symbol]);

  if (state.status === "loading") return <p className="muted">LOADING {symbol}…</p>;
  if (state.status === "error") return <p className="down">ERROR: {state.message}</p>;

  const { quote } = state;
  const direction = quote.change.startsWith("-") ? "down" : "up";
  return (
    <div data-testid="quote-panel">
      <div className="big">{quote.symbol}</div>
      <div className="big" data-testid="quote-price">
        {quote.price} <span className="muted">{quote.currency}</span>
      </div>
      <div className={direction}>
        {quote.change} ({quote.changePercent}%)
      </div>
      <div className="muted">AS OF {quote.asOf}</div>
    </div>
  );
}
