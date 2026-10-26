import { describe, expect, it } from "vitest";
import { firstVisitHelp, HELP_SEEN_KEY, type HelpStorage } from "./helpState";

interface FakeStorage extends HelpStorage {
  readonly store: Record<string, string>;
}

function fakeStorage(initial: Record<string, string> = {}, fail: "none" | "read" | "write" = "none"): FakeStorage {
  const store = { ...initial };
  return {
    store,
    getItem: (key) => {
      if (fail === "read") throw new Error("storage disabled");
      return store[key] ?? null;
    },
    setItem: (key, value) => {
      if (fail === "write") throw new Error("storage disabled");
      store[key] = value;
    },
  };
}

// DEMO-13 R3: the help panel opens itself once on a first visit, never again afterwards, and a
// browser that blocks storage degrades to "no auto-open" instead of throwing.
describe("firstVisitHelp", () => {
  it("auto-opens once and writes the marker when unseen", () => {
    const storage = fakeStorage();
    expect(firstVisitHelp(() => storage)).toBe("auto-open");
    expect(storage.store[HELP_SEEN_KEY]).toBeDefined();
  });

  it("does not auto-open when the marker is already present", () => {
    expect(firstVisitHelp(() => fakeStorage({ [HELP_SEEN_KEY]: "1" }))).toBe("already-seen");
  });

  it("answers already-seen on the second call, so a double mount opens one panel", () => {
    const storage = fakeStorage();
    expect(firstVisitHelp(() => storage)).toBe("auto-open");
    expect(firstVisitHelp(() => storage)).toBe("already-seen");
  });

  it("skips silently when reading throws", () => {
    expect(firstVisitHelp(() => fakeStorage({}, "read"))).toBe("skip");
  });

  it("skips silently when writing throws", () => {
    expect(firstVisitHelp(() => fakeStorage({}, "write"))).toBe("skip");
  });

  // B1 (CR 10109): a browser that blocks storage throws on the `localStorage` property getter
  // itself, before any getItem/setItem; the decision must swallow that too, never rethrow.
  it("skips silently when the storage getter itself throws", () => {
    const blocked = (): HelpStorage => {
      throw new Error("SecurityError: storage disabled");
    };
    expect(firstVisitHelp(blocked)).toBe("skip");
  });
});
