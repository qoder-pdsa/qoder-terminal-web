import { describe, expect, it } from "vitest";
import { splitSse } from "./analyst";

describe("splitSse", () => {
  it("parses complete events and keeps the partial remainder", () => {
    const raw = 'data: {"type":"thinking","text":"hi"}\n\ndata: {"type":"open_pa';
    const { events, rest } = splitSse(raw);
    expect(events).toEqual([{ type: "thinking", text: "hi" }]);
    expect(rest).toBe('data: {"type":"open_pa');
  });
});
