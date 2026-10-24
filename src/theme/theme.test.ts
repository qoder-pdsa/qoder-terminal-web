import { describe, expect, it } from "vitest";
import {
  followSystemPreference,
  nextTheme,
  readStoredPreference,
  readStoredTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
  type KeyValueStore,
  type SystemPreference,
  type SystemPreferenceListener,
} from "./theme";

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

/**
 * A store that refuses one side of the contract, the way a real browser does when storage is
 * blocked by a privacy setting (reads fail) or the quota is gone (writes fail).
 */
function blockedStore(side: "read" | "write"): KeyValueStore & { writes: string[] } {
  const writes: string[] = [];
  const blocked = new Error(`SecurityError: storage is not available (${side})`);
  return {
    writes,
    getItem: () => {
      if (side === "read") throw blocked;
      return null;
    },
    setItem: (_key, value) => {
      if (side === "write") throw blocked;
      writes.push(value);
    },
  };
}

/** A stand-in for `matchMedia(...)`, so following the system live is testable without a DOM. */
function systemPreference(
  initially: boolean,
): SystemPreference & { readonly subscriberCount: number; flip(next: boolean): void } {
  const subscribers = new Set<SystemPreferenceListener>();
  let matches = initially;
  return {
    get matches() {
      return matches;
    },
    get subscriberCount() {
      return subscribers.size;
    },
    addEventListener(_type: "change", listener: SystemPreferenceListener) {
      subscribers.add(listener);
    },
    removeEventListener(_type: "change", listener: SystemPreferenceListener) {
      subscribers.delete(listener);
    },
    /** Flip the preference and notify, the way a real `change` event does. */
    flip(next: boolean) {
      matches = next;
      for (const listener of subscribers) listener({ matches: next });
    },
  };
}

/** What a start-up resolves to: read the store, then let the system decide whatever was not chosen. */
const themeAtStart = (saved: KeyValueStore, systemPrefersLight: boolean) =>
  resolveTheme(readStoredTheme(saved), systemPrefersLight);

describe("the theme a start-up resolves to", () => {
  it.each([
    ["light", true, "light"],
    ["light", false, "light"],
    ["dark", true, "dark"],
    ["dark", false, "dark"],
  ])("a saved %s wins over a system preference of %s", (savedValue, systemPrefersLight, expected) => {
    expect(themeAtStart(store({ [THEME_STORAGE_KEY]: savedValue }), systemPrefersLight)).toBe(expected);
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
    expect(themeAtStart(saved, systemPrefersLight)).toBe(expected);
  });

  it("reads the theme key and nothing else", () => {
    const saved = store({ [THEME_STORAGE_KEY]: "dark", other: "light" });
    themeAtStart(saved, true);
    expect(saved.reads).toEqual([THEME_STORAGE_KEY]);
  });
});

/**
 * AC-03 / AC-10 — precedence, which is the whole decision. A choice a human made wins over the
 * system, whether it was saved before this load or made during it; with no choice at all the system
 * decides, and keeps deciding.
 */
describe("resolveTheme", () => {
  it("follows the system while nobody has chosen", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe("dark");
  });

  it.each([
    ["light", false, "light"],
    ["dark", true, "dark"],
  ] as const)("keeps a choice made in this session (%s) when the system later says %s", (choice, systemPrefersLight, expected) => {
    // Nothing was persisted — this is the memory-only case a blocked store forces (TC13b).
    expect(resolveTheme(choice, systemPrefersLight)).toBe(expected);
  });
});

/** AC-01b — the system preference is followed while the page stays open, not only at start-up. */
describe("followSystemPreference", () => {
  it("reports every change while it is subscribed", () => {
    const query = systemPreference(true);
    const seen: boolean[] = [];
    followSystemPreference(query, (prefersLight) => seen.push(prefersLight));

    query.flip(false);
    query.flip(true);
    expect(seen).toEqual([false, true]);
  });

  it("does not report on subscribing: only a real change is a change", () => {
    const query = systemPreference(true);
    const seen: boolean[] = [];
    followSystemPreference(query, (prefersLight) => seen.push(prefersLight));
    expect(seen).toEqual([]);
  });

  it("stops reporting once the returned function is called, and leaves nothing subscribed", () => {
    const query = systemPreference(true);
    const seen: boolean[] = [];
    const stop = followSystemPreference(query, (prefersLight) => seen.push(prefersLight));

    stop();
    query.flip(false);
    expect(seen).toEqual([]);
    expect(query.subscriberCount).toBe(0);
  });
});

describe("readStoredTheme", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("reads back the value it wrote itself: %s", (savedValue, expected) => {
    expect(readStoredTheme(store({ [THEME_STORAGE_KEY]: savedValue }))).toBe(expected);
  });

  // Anything this app did not write is not a preference. Case, padding and JSON are all rejected:
  // only the exact two literals count, so a foreign or corrupt value falls back to the system.
  it.each(["", "DARK", "Dark", "Light", "auto", "blue", "dark ", " dark", "null", "undefined", "{}", "0", "1"])(
    "ignores a value it never wrote: %j",
    (savedValue) => {
      expect(readStoredTheme(store({ [THEME_STORAGE_KEY]: savedValue }))).toBeNull();
    },
  );

  it("reads an absent key as no saved choice", () => {
    expect(readStoredTheme(store())).toBeNull();
  });
});

/**
 * Storage is all-or-nothing for a session: if it cannot be read, what is written now could not be
 * read back later, so it is not worth writing. A foreign value is a different case — storage works,
 * so a later real choice is still persisted.
 */
describe("readStoredPreference", () => {
  it("reports a working store as usable, carrying whatever choice it holds", () => {
    expect(readStoredPreference(store({ [THEME_STORAGE_KEY]: "dark" }))).toEqual({ choice: "dark", usable: true });
    expect(readStoredPreference(store({ [THEME_STORAGE_KEY]: "light" }))).toEqual({ choice: "light", usable: true });
    expect(readStoredPreference(store())).toEqual({ choice: null, usable: true });
  });

  it("reports a value it never wrote as usable storage holding no choice", () => {
    expect(readStoredPreference(store({ [THEME_STORAGE_KEY]: "blue" }))).toEqual({ choice: null, usable: true });
    expect(readStoredPreference(store({ [THEME_STORAGE_KEY]: "DARK" }))).toEqual({ choice: null, usable: true });
  });

  it("reports a store that refuses to answer as unusable", () => {
    expect(readStoredPreference(blockedStore("read"))).toEqual({ choice: null, usable: false });
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
    expect(themeAtStart(saved, true)).toBe("dark");
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

/**
 * AC-09 — storage that is unavailable degrades silently. The visitor gets no error to dismiss and
 * the app keeps working; the choice simply lives in memory for this session only.
 */
describe("storage that refuses to work (AC-09)", () => {
  it("reads a blocked store as no saved choice instead of throwing", () => {
    expect(readStoredTheme(blockedStore("read"))).toBeNull();
  });

  it("swallows a blocked write instead of throwing", () => {
    expect(() => saveTheme(blockedStore("write"), "dark")).not.toThrow();
  });

  it("persists nothing when the write is blocked", () => {
    const blocked = blockedStore("write");
    saveTheme(blocked, "dark");
    expect(blocked.writes).toEqual([]);
  });

  it("still resolves a theme when the read is blocked, falling back to the system preference", () => {
    expect(themeAtStart(blockedStore("read"), true)).toBe("light");
    expect(themeAtStart(blockedStore("read"), false)).toBe("dark");
  });
});
