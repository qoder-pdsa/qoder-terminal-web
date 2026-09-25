import type { ReactNode } from "react";
import { DEFAULT_HISTORY_RANGE, type HistoryRange } from "../api/data";
import type { Command } from "../commands/parse";
import type { OpenPanel } from "../layout/slots";
import { AskPanel } from "./AskPanel";
import { CapitalFlowPanel } from "./CapitalFlowPanel";
import { GraphPanel } from "./GraphPanel";
import { NewsPanel } from "./NewsPanel";
import { QuotePanel } from "./QuotePanel";
import { panelRange } from "./rangeState";
import { WatchlistPanel } from "./WatchlistPanel";

export interface PanelContext {
  run: (input: string) => void;
  /** The panel being rendered; a panel reads its own per-panel state from it. */
  panel: OpenPanel;
  /** Select another history range for this panel. */
  selectRange: (range: HistoryRange) => void;
}

type RunnableCommand = Exclude<Command, { kind: "invalid" }>;

/** `range` is the panel's own range, which a range button moves past the command's. */
export function panelTitle(cmd: RunnableCommand, range?: HistoryRange): string {
  if (cmd.kind === "ask") return "ASK";
  const parts: (string | undefined)[] = [cmd.symbol, cmd.code];
  if (cmd.code === "GP") parts.push(range ?? cmd.range ?? DEFAULT_HISTORY_RANGE);
  return parts.filter(Boolean).join(" ");
}

/** Function code → panel. Adding a panel only needs a new branch here. */
export function renderPanel(cmd: RunnableCommand, ctx: PanelContext): ReactNode {
  if (cmd.kind === "ask") return <AskPanel question={cmd.question} onOpen={ctx.run} />;
  switch (cmd.code) {
    case "Q":
      return <QuotePanel symbol={cmd.symbol ?? ""} />;
    case "GP":
      return <GraphPanel symbol={cmd.symbol ?? ""} range={panelRange(ctx.panel)} onRangeChange={ctx.selectRange} />;
    case "N":
      return <NewsPanel symbol={cmd.symbol} />;
    case "W":
      return <WatchlistPanel onOpen={ctx.run} />;
    case "CF":
      return <CapitalFlowPanel symbol={cmd.symbol ?? ""} />;
  }
}
