import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { HistoryRange } from "./api/data";
import { complete, completionCandidates } from "./commands/complete";
import { back, current, EMPTY_HISTORY, forward, push, type HistoryState } from "./commands/history";
import { parseCommand } from "./commands/parse";
import { closePanel, openPanel, toSlots, type OpenPanel } from "./layout/slots";
import { panelTitle, renderPanel } from "./panels/registry";
import { panelRange, selectPanelRange } from "./panels/rangeState";

/** A running Tab session: repeated presses cycle the candidates of the line the user typed. */
interface CompletionSession {
  readonly stem: string;
  readonly result: string;
  readonly cycle: number;
}

export function App() {
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [panels, setPanels] = useState<OpenPanel[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const input = current(history);
  const completions = complete(input, completionCandidates(input, history.entries), 0).matches;
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<CompletionSession | null>(null);
  const caretToEnd = useRef(false);

  const run = useCallback((raw: string) => {
    const command = parseCommand(raw);
    if (command.kind === "invalid") {
      setMessage(`${command.reason}: ${command.input}`);
      return;
    }
    setMessage(null);
    if (command.kind === "function" && command.code === "CLEAR") {
      setPanels([]);
      return;
    }
    setPanels((prev) => openPanel(prev, { id: Date.now() + Math.random(), command }));
  }, []);

  const onSelectRange = useCallback((id: number, range: HistoryRange) => {
    setPanels((prev) => prev.map((panel) => (panel.id === id ? selectPanelRange(panel, range) : panel)));
  }, []);

  const close = useCallback((id: number) => {
    setPanels((prev) => closePanel(prev, id));
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
    setHistory((prev) => push(prev, input));
  };

  /** Tab completes the token under the cursor; pressing it again cycles the same candidates. */
  const completeToken = (e: KeyboardEvent<HTMLInputElement>) => {
    // Tab must never move the focus out of the command bar, not even when nothing matches.
    e.preventDefault();
    const step = e.shiftKey ? -1 : 1;
    const session = sessionRef.current;
    // Re-completing what the last press produced continues that cycle; anything else starts one.
    const continuing = session !== null && session.result === input ? session : null;
    const stem = continuing ? continuing.stem : input;
    const cycle = continuing ? continuing.cycle + step : e.shiftKey ? -1 : 0;
    const next = complete(stem, completionCandidates(stem, history.entries), cycle);
    if (next.matches.length === 0) return;
    sessionRef.current = { stem, result: next.text, cycle };
    caretToEnd.current = true;
    setHistory((prev) => ({ ...prev, draft: next.text, cursor: -1 }));
  };

  const onCommandKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistory(back);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistory(forward);
    } else if (e.key === "Tab") {
      completeToken(e);
    }
  };

  // Runs on every render because a completion can produce the text the input already had; the flag
  // keeps it a no-op otherwise.
  useEffect(() => {
    if (!caretToEnd.current) return;
    caretToEnd.current = false;
    const field = inputRef.current;
    field?.setSelectionRange(field.value.length, field.value.length);
  });

  return (
    <div className="terminal">
      <header className="topbar">
        <span className="brand">QODER TERMINAL</span>
        <span className="muted">Q · GP · N · W · CF · CLEAR · ASK</span>
      </header>
      <form onSubmit={onSubmit} className="command-bar">
        <span className="prompt">&gt;</span>
        <input
          ref={inputRef}
          data-testid="command-input"
          data-completions={completions.join(",")}
          value={input}
          onChange={(e) => setHistory((prev) => ({ ...prev, draft: e.target.value, cursor: -1 }))}
          onKeyDown={onCommandKey}
          placeholder="700 Q   |   9988.HK GP   |   700 CF   |   W   |   ASK compare Tencent and Alibaba recently"
          autoFocus
        />
      </form>
      {message && <div className="down message" data-testid="command-error">{message}</div>}
      <main className="grid">
        {toSlots(panels).map((p, i) => {
          if (!p) {
            return (
              <section key={`empty-${i}`} className="panel empty" data-testid="empty-slot">
                <h2>PANEL {i + 1}</h2>
                <p className="muted">EMPTY — type a command above to open a panel, e.g. 700 Q</p>
              </section>
            );
          }
          const title = panelTitle(p.command, panelRange(p));
          return (
            <section key={p.id} className="panel">
              <div className="panel-head">
                <h2>{title}</h2>
                <button
                  type="button"
                  className="close-panel"
                  data-testid="close-panel"
                  aria-label={`Close ${title}`}
                  onClick={() => close(p.id)}
                >
                  ×
                </button>
              </div>
              {renderPanel(p.command, { run, panel: p, selectRange: (range) => onSelectRange(p.id, range) })}
            </section>
          );
        })}
      </main>
    </div>
  );
}
