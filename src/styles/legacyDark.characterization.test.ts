import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Characterization of the dark terminal as `main` (f5170f1) renders it, captured before the light
 * theme lands. A second palette may be added and the dark one may move into its own stylesheet,
 * but nothing asserted here may change: dark has to keep looking exactly as it does today.
 *
 * The sheets are read from disk because a `?raw` import of a `.css` file is empty under vitest.
 */

function sheet(relative: string): string {
  const url = new URL(relative, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const sheets = ["../styles.css", "./theme.css"];

/** The declarations of one selector, gathered across every stylesheet; an absent rule adds none. */
function declarations(selector: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const relative of sheets) {
    const css = sheet(relative).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(",").some((part) => part.replace(/\s+/g, " ").trim() === selector)) continue;
      for (const declaration of body.split(";")) {
        const colon = declaration.indexOf(":");
        if (colon < 0) continue;
        found[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
      }
    }
  }
  return found;
}

type Rgb = readonly [number, number, number];

/** The dark palette: whatever `:root` and the explicit dark theme declare between them. */
function darkTokens(): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  for (const selector of [":root", '[data-theme="dark"]']) {
    for (const [name, value] of Object.entries(declarations(selector))) {
      if (name.startsWith("--")) tokens.set(name, value);
    }
  }
  return tokens;
}

function rgbOf(value: string, tokens: ReadonlyMap<string, string>): Rgb {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  const hex = (variable ? tokens.get(variable[1]) : value)?.replace(/^#/, "");
  const full = hex?.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  if (!full || !/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex color: "${value}"`);
  const channel = (at: number) => Number.parseInt(full.slice(at, at + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

const hexOf = ([red, green, blue]: Rgb) =>
  `#${[red, green, blue].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/** What a rule really paints over `background`, compositing its own `opacity` if it has one. */
function paintsOver(rule: Record<string, string>, background: Rgb): Rgb {
  const color = rgbOf(rule.color, darkTokens());
  const opacity = rule.opacity === undefined ? 1 : Number.parseFloat(rule.opacity);
  const mix = (at: number) => Math.round(color[at] * opacity + background[at] * (1 - opacity));
  return [mix(0), mix(1), mix(2)];
}

/** The eleven color tokens `main` declares, verbatim. */
const LEGACY_DARK_PALETTE = [
  ["--bg", "#000"],
  ["--panel", "#0b0b0b"],
  ["--border", "#333"],
  ["--amber", "#ffa028"],
  ["--text", "#e6e6e6"],
  ["--muted", "#8a8a8a"],
  ["--up", "#3ad17a"],
  ["--down", "#ff4d4d"],
  ["--tool", "#5fb3ff"],
  // Mainland convention for the GP candles: red up, green down — the opposite of --up/--down.
  ["--candle-up", "#ff4d4d"],
  ["--candle-down", "#3ad17a"],
] as const;

describe("the dark palette as main declares it", () => {
  const tokens = darkTokens();

  it.each(LEGACY_DARK_PALETTE)("keeps %s at %s", (name, value) => {
    expect(tokens.get(name)).toBe(value);
  });

  it("paints the document black with light grey text", () => {
    const body = declarations("body");
    expect(hexOf(rgbOf(body.background, tokens))).toBe("#000000");
    expect(hexOf(rgbOf(body.color, tokens))).toBe("#e6e6e6");
  });
});

describe("the dark top bar as main renders it", () => {
  const tokens = darkTokens();
  const topbar = declarations(".topbar");
  const amber = rgbOf(topbar.background, tokens);

  it("is the amber accent bar", () => {
    expect(hexOf(amber)).toBe("#ffa028");
  });

  it("draws the brand in black on that amber", () => {
    expect(hexOf(paintsOver(topbar, amber))).toBe("#000000");
  });

  /**
   * The shortcut cheat-sheet is 70%-opacity black, which composites to #4d300c over the amber.
   * Pinned as the composited value, so replacing the blend with a full-opacity token of the same
   * color is provably not a visual change.
   */
  it("draws the shortcut cheat-sheet at #4d300c", () => {
    expect(hexOf(paintsOver(declarations(".topbar .muted"), amber))).toBe("#4d300c");
  });
});

describe("the dark watchlist as main renders it", () => {
  it("highlights a hovered row at #161616", () => {
    const rule = declarations(".watchlist tbody tr:hover td");
    expect(hexOf(rgbOf(rule.background, darkTokens()))).toBe("#161616");
  });
});
