import { describe, expect, it } from "vitest";
import { initialTheme, nextTheme, readStoredTheme, saveTheme, THEME_STORAGE_KEY, type KeyValueStore } from "./theme";

/** An in-memory stand-in for `localStorage`, so the rules are testable without a DOM. */
function store(saved: Record<string, string> = {}): KeyValueStore & { reads: string[] } {
  const values = new Map(Object.entries(saved));
  const reads: string[] = [];
  return {
    reads,
    getItem: (key) => {
      reads.push(key);
      return values.get(key) ?? null;
    },
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("initialTheme", () => {
  it.each([
    ["light", true, "light"],
    ["light", false, "light"],
    ["dark", true, "dark"],
    ["dark", false, "dark"],
  ])("a saved %s wins over a system preference of %s", (savedValue, systemPrefersLight, expected) => {
    expect(initialTheme(store({ [THEME_STORAGE_KEY]: savedValue }), systemPrefersLight)).toBe(expected);
  });

  it.each([
    [null, true, "light"],
    [null, false, "dark"],
    ["", true, "light"],
    ["", false, "dark"],
    ["Light", false, "dark"],
    ["blue", false, "dark"],
    ["blue", true, "light"],
  ])("with no usable saved value (%s) the system preference %s decides", (savedValue, systemPrefersLight, expected) => {
    const saved = savedValue === null ? store() : store({ [THEME_STORAGE_KEY]: savedValue });
    expect(initialTheme(saved, systemPrefersLight)).toBe(expected);
  });

  it("reads the theme key and nothing else", () => {
    const saved = store({ [THEME_STORAGE_KEY]: "dark", other: "light" });
    initialTheme(saved, true);
    expect(saved.reads).toEqual([THEME_STORAGE_KEY]);
  });
});

describe("readStoredTheme", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    [null, null],
    ["DARK", null],
    ["auto", null],
  ])("%s is read as %s", (savedValue, expected) => {
    expect(readStoredTheme(store(savedValue === null ? {} : { [THEME_STORAGE_KEY]: savedValue }))).toBe(expected);
  });
});

describe("saveTheme", () => {
  it("persists the theme under the theme key", () => {
    const saved = store();
    saveTheme(saved, "light");
    expect(readStoredTheme(saved)).toBe("light");
    saveTheme(saved, "dark");
    expect(readStoredTheme(saved)).toBe("dark");
  });

  it("survives a reload: what was saved is what the next start reads", () => {
    const saved = store();
    saveTheme(saved, "dark");
    // A reload re-reads the same storage; the system preference is now irrelevant.
    expect(initialTheme(saved, true)).toBe("dark");
  });
});

describe("nextTheme", () => {
  it.each([
    ["dark", "light"],
    ["light", "dark"],
  ] as const)("switches %s to %s", (from, expected) => {
    expect(nextTheme(from)).toBe(expected);
  });

  it("returns to the theme it started from after two switches", () => {
    expect(nextTheme(nextTheme("light"))).toBe("light");
  });
});
