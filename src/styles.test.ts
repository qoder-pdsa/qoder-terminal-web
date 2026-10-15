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
  expect(reference).toMatch(/^var\(--[\w-]+\)$/);
  const name = reference.slice(4, -1);
  const value = declarations(":root")[name];
  expect(value, `${name} is not declared in :root`).toBeDefined();
  return value.toLowerCase();
}

const WHITE = ["#fff", "#ffffff", "white"];
const DARK = ["#000", "#000000", "black"];

describe("menu bar color", () => {
  it("paints the menu bar background white", () => {
    expect(WHITE).toContain(paletteValue(declarations(".topbar").background));
  });

  it("keeps the menu bar text dark so it stays legible on white", () => {
    expect(DARK).toContain(declarations(".topbar").color.toLowerCase());
  });
});
