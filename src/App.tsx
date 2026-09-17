import { useCallback, useState, type FormEvent } from "react";
import { parseCommand } from "./commands/parse";
import { openPanel, toSlots, type OpenPanel } from "./layout/slots";
import { panelTitle, renderPanel } from "./panels/registry";

export function App() {
  const [input, setInput] = useState("");
  const [panels, setPanels] = useState<OpenPanel[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback((raw: string) => {
    const command = parseCommand(raw);
    if (command.kind === "invalid") {
      setMessage(`${command.reason}: ${command.input}`);
      return;
    }
    setMessage(null);
    setPanels((prev) => openPanel(prev, { id: Date.now() + Math.random(), command }));
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(input);
    setInput("");
  };

  return (
    <div className="terminal">
      <header className="topbar">
        <span className="brand">QODER TERMINAL</span>
        <span className="muted">Q · GP · N · W · ASK</span>
      </header>
      <form onSubmit={onSubmit} className="command-bar">
        <span className="prompt">&gt;</span>
        <input
          data-testid="command-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="700 Q   |   9988.HK GP   |   ASK compare Tencent and Alibaba recently"
          autoFocus
        />
      </form>
      {message && <div className="down message" data-testid="command-error">{message}</div>}
      <main className="grid">
        {toSlots(panels).map((p, i) =>
          p ? (
            <section key={p.id} className="panel">
              <h2>{panelTitle(p.command)}</h2>
              {renderPanel(p.command, { run })}
            </section>
          ) : (
            <section key={`empty-${i}`} className="panel empty" data-testid="empty-slot">
              <h2>PANEL {i + 1}</h2>
              <p className="muted">EMPTY — type a command above to open a panel, e.g. 700 Q</p>
            </section>
          ),
        )}
      </main>
    </div>
  );
}
