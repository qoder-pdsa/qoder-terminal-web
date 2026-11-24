import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewBackendDisabled, previewFetch } from "./config";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("previewFetch in an isolated preview build", () => {
  it("refuses to reach a business service", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(previewFetch("http://127.0.0.1:8081/v1/quotes/700.HK", undefined, true)).rejects.toBeInstanceOf(
      PreviewBackendDisabled,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps the refusal onto the error shape the panels already render", async () => {
    const error = (await previewFetch("/api/data/v1/news", undefined, true).catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("isolated");
    expect((error as PreviewBackendDisabled).code).toBe("PREVIEW_NO_BACKEND");
    expect((error as PreviewBackendDisabled).status).toBe(404);
  });

  it("never opens a WebSocket or an event stream either, because it never resolves a response", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(
      previewFetch("/api/analyst/v1/ask", { method: "POST", body: '{"question":"x"}' }, true),
    ).rejects.toBeInstanceOf(PreviewBackendDisabled);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("previewFetch outside an isolated preview build", () => {
  it("delegates to fetch with the same arguments", async () => {
    const response = new Response("ok");
    const spy = vi.fn().mockResolvedValue(response);
    globalThis.fetch = spy as unknown as typeof fetch;
    await expect(previewFetch("/api/data/v1/watchlists", { signal: undefined }, false)).resolves.toBe(response);
    expect(spy).toHaveBeenCalledWith("/api/data/v1/watchlists", { signal: undefined });
  });

  it("passes a rejection through unchanged", async () => {
    const failure = new Error("fetch failed");
    globalThis.fetch = vi.fn().mockRejectedValue(failure) as unknown as typeof fetch;
    await expect(previewFetch("/api/data/v1/news", undefined, false)).rejects.toBe(failure);
  });
});
