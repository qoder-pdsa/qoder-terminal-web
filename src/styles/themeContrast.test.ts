import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read the stylesheets from disk: a `?raw` import of a `.css` file is empty under vitest.
const stylesCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const themeCss = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

type Rgb = readonly [number, number, number];

/** Declarations of one rule, keyed by property. The selector has to match exactly. */
function rule(css: string, selector: string): Record<string, string> {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selectors, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(",").map((part) => part.trim()).includes(selector)) {
      return Object.fromEntries(
        body
          .split(";")
          .map((declaration) => declaration.trim())
          .filter(Boolean)
          .map((declaration) => {
            const colon = declaration.indexOf(":");
            return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
          }),
      );
    }
  }
  throw new Error(`no rule for "${selector}"`);
}

function palette(selector: string): Map<string, string> {
  const tokens = Object.entries(rule(themeCss, selector)).filter(([name]) => name.startsWith("--"));
  return new Map(tokens);
}

function colorOf(tokens: Map<string, string>, value: string): Rgb {
  const variable = /^var\((--[\w-]+)\)$/.exec(value);
  const hex = (variable ? tokens.get(variable[1]) : value)?.replace(/^#/, "");
  const full = hex?.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
  if (!full || !/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex color: "${value}"`);
  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return [red, green, blue];
}

function luminance([red, green, blue]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG 2.1 contrast ratio. */
function contrastOf(one: Rgb, other: Rgb): number {
  const [higher, lower] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (higher + 0.05) / (lower + 0.05);
}

/**
 * What the top-bar hint line actually paints: its own color over the bar's background at its own
 * opacity. Comparing tokens alone misses this whenever a rule blends with `opacity` — which is how
 * the light theme shipped a 3.3:1 hint line while the token pair measured 5.0:1.
 */
function accentBarHint(tokens: Map<string, string>): { effective: Rgb; contrast: number } {
  const hint = rule(stylesCss, ".topbar .muted");
  const bar = rule(stylesCss, ".topbar");
  const foreground = colorOf(tokens, hint.color);
  const background = colorOf(tokens, bar.background);
  // A CSS alpha, not a contract decimal: `opacity` is absent once the color is a token of its own.
  const opacity = hint.opacity === undefined ? 1 : Number(hint.opacity);
  const blend = (index: number) => foreground[index] * opacity + background[index] * (1 - opacity);
  const effective: Rgb = [blend(0), blend(1), blend(2)];
  return { effective, contrast: contrastOf(effective, background) };
}

const DARK = palette('[data-theme="dark"]');
const LIGHT = palette('[data-theme="light"]');

describe("theme palettes", () => {
  it("define the same tokens for dark and light", () => {
    expect([...LIGHT.keys()].sort()).toEqual([...DARK.keys()].sort());
  });
});

describe("the top-bar hint line (the command cheat-sheet)", () => {
  it("dark still paints rgb(77, 48, 12) on the amber bar", () => {
    const { effective, contrast } = accentBarHint(DARK);
    expect(effective.map(Math.round)).toEqual([77, 48, 12]);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  it("light reaches the 4.5:1 WCAG AA floor for 16px normal text", () => {
    const { contrast } = accentBarHint(LIGHT);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
