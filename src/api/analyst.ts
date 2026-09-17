import { ANALYST_URL } from "./config";

/** Mirrors qoder-terminal-analyst/api/agent-event.schema.json. */
export type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; ok: boolean; summary?: string | null }
  | { type: "open_panel"; command: string }
  | { type: "answer"; markdown: string; citations: { title: string; url: string }[] }
  | { type: "error"; message: string };

/** Split an SSE text chunk into events; returns the parsed events and the unfinished remainder. */
export function splitSse(buffer: string): { events: AgentEvent[]; rest: string } {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  const events = chunks
    .map((chunk) => chunk.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice("data: ".length)) as AgentEvent);
  return { events, rest };
}

export async function* ask(question: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const resp = await fetch(`${ANALYST_URL}/v1/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`HTTP ${resp.status}`);
  }
  const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    const { events, rest } = splitSse(buffer + value);
    buffer = rest;
    yield* events;
  }
}
