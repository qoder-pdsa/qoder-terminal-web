import { useEffect, useState } from "react";
import { ask, type AgentEvent } from "../api/analyst";

export function AskPanel({ question, onOpen }: { question: string; onOpen: (command: string) => void }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setFailure(null);
    (async () => {
      for await (const event of ask(question, controller.signal)) {
        setEvents((prev) => [...prev, event]);
        if (event.type === "open_panel") onOpen(event.command);
      }
    })().catch((err: unknown) => {
      if (!controller.signal.aborted) setFailure(err instanceof Error ? err.message : String(err));
    });
    return () => controller.abort();
  }, [question, onOpen]);

  return (
    <div data-testid="ask-panel">
      <div className="muted">&gt; {question}</div>
      {events.map((event, i) => (
        <EventLine key={i} event={event} />
      ))}
      {failure && <p className="down">ERROR: {failure}</p>}
    </div>
  );
}

function EventLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case "thinking":
      return <div className="muted">… {event.text}</div>;
    case "tool_call":
      return <div className="tool">⚙ {event.tool}({JSON.stringify(event.args)})</div>;
    case "tool_result":
      return <div className={event.ok ? "up" : "down"}>  ↳ {event.ok ? "ok" : "failed"} {event.summary ?? ""}</div>;
    case "open_panel":
      return <div className="tool">▣ open {event.command}</div>;
    case "answer":
      return (
        <div data-testid="ask-answer">
          <pre className="answer">{event.markdown}</pre>
          {event.citations.map((c) => (
            <div key={c.url} className="muted">
              ↗ <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
            </div>
          ))}
        </div>
      );
    case "error":
      return <div className="down">ERROR: {event.message}</div>;
  }
}
