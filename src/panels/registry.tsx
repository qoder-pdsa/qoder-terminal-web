import type { ReactNode } from "react";
import type { Command } from "../commands/parse";
import { AskPanel } from "./AskPanel";
import { PlaceholderPanel } from "./PlaceholderPanel";
import { QuotePanel } from "./QuotePanel";

export interface PanelContext {
  run: (input: string) => void;
}

type RunnableCommand = Exclude<Command, { kind: "invalid" }>;

export function panelTitle(cmd: RunnableCommand): string {
  return cmd.kind === "ask" ? "ASK" : [cmd.symbol, cmd.code].filter(Boolean).join(" ");
}

/** 功能码 → 面板。新增面板只需在此处加分支。 */
export function renderPanel(cmd: RunnableCommand, ctx: PanelContext): ReactNode {
  if (cmd.kind === "ask") return <AskPanel question={cmd.question} onOpen={ctx.run} />;
  switch (cmd.code) {
    case "Q":
      return <QuotePanel symbol={cmd.symbol ?? ""} />;
    case "GP":
      return <PlaceholderPanel title="GRAPH PRICE" />;
    case "N":
      return <PlaceholderPanel title="NEWS" />;
    case "W":
      return <PlaceholderPanel title="WATCHLIST" />;
  }
}
