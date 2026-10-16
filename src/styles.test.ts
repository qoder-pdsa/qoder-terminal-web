import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Comments carry colons and dashes, so they are stripped before the declarations are split.
const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no rule for "${selector}" in styles.css`);
  const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const part of body.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    out[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
  }
  return out;
}

/** The value a `var(--x)` reference resolves to in the `:root` palette. */
function paletteValue(reference: string): string {
  expect(reference, "colors come from CSS variables, never hard-coded").toMatch(/^var\(--[\w-]+\)$/);
  const name = reference.slice(4, -1);
  const value = declarations(":root")[name];
  expect(value, `${name} is not declared in :root`).toBeDefined();
  return value;
}

function rgb(hex: string): [number, number, number] {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`expected a #rgb or #rrggbb color, got "${hex}"`);
  const digits = match[1].length === 3 ? match[1].replace(/./g, (d) => d + d) : match[1];
  const n = parseInt(digits, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio: 1 for identical colors, 21 for black on white. */
function contrast(foreground: string, backdrop: string): number {
  const [a, b] = [luminance(rgb(foreground)), luminance(rgb(backdrop))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The color a partially transparent foreground actually renders as over its backdrop. */
function blend(foreground: string, backdrop: string, opacity: number): string {
  const [fr, fg, fb] = rgb(foreground);
  const [br, bg, bb] = rgb(backdrop);
  const mix = (f: number, b: number) =>
    Math.round(f * opacity + b * (1 - opacity))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(fr, br)}${mix(fg, bg)}${mix(fb, bb)}`;
}

const topbar = declarations(".topbar");
const background = paletteValue(topbar.background);
// AA for normal text; the menu bar carries small hint text, not only the large brand.
const AA = 4.5;

describe("menu bar color", () => {
  it("paints the menu bar background blue", () => {
    const [r, g, b] = rgb(background);
    expect(b, `${background} is not blue-dominant`).toBeGreaterThan(r);
    expect(b, `${background} is not blue-dominant`).toBeGreaterThan(g);
  });

  it("keeps the brand text legible on the blue", () => {
    expect(contrast(topbar.color, background)).toBeGreaterThanOrEqual(AA);
  });

  it("keeps the faded hint text legible on the blue", () => {
    const muted = declarations(".topbar .muted");
    expect(contrast(blend(muted.color, background, Number(muted.opacity)), background)).toBeGreaterThanOrEqual(AA);
  });
});
