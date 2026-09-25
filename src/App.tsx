import { useCallback, useState, type FormEvent, type KeyboardEvent } from "react";
import { back, current, EMPTY_HISTORY, forward, push, type HistoryState } from "./commands/history";
import { parseCommand } from "./commands/parse";
import { closePanel, openPanel, toSlots, type OpenPanel } from "./layout/slots";
import { panelTitle, renderPanel } from "./panels/registry";

export function App() {
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [panels, setPanels] = useState<OpenPanel[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const input = current(history);

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

  const close = useCallback((id: number) => {
    setPanels((prev) => closePanel(prev, id));
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
    setHistory((prev) => push(prev, input));
  };

  const onHistoryKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistory(back);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistory(forward);
    }
  };

  return (
    <div className="terminal">
      <header className="topbar">
        <span className="brand">QODER TERMINAL</span>
        <span className="muted">Q · GP · N · W · CF · CLEAR · ASK</span>
      </header>
      <form onSubmit={onSubmit} className="command-bar">
        <span className="prompt">&gt;</span>
        <input
          data-testid="command-input"
          value={input}
          onChange={(e) => setHistory((prev) => ({ ...prev, draft: e.target.value, cursor: -1 }))}
          onKeyDown={onHistoryKey}
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
          const title = panelTitle(p.command);
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
              {renderPanel(p.command, { run })}
            </section>
          );
        })}
      </main>
    </div>
  );
}
