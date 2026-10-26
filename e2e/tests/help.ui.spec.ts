import { expect, test, type Page } from "@playwright/test";
import { urls } from "../playwright.config";

// DEMO-13 quick help. Every assertion uses data-independent signals (headings, section and slot
// counts, the message line); only HELP-12 mocks one contract-shaped quote through page.route.
// A fresh Playwright context is a first visit, so tests that need a returning visit seed the
// marker before load; HELP-01 and HELP-17 deliberately do not.
const HELP_SEEN_KEY = "qoder-terminal:help-seen";

async function run(page: Page, command: string) {
  await page.getByTestId("command-input").fill(command);
  await page.getByTestId("command-input").press("Enter");
}

/** Load as a returning visit: the first-visit auto-open stays out of the test. */
async function seenHelp(page: Page) {
  await page.addInitScript((key) => window.localStorage.setItem(key, "1"), HELP_SEEN_KEY);
}

const helpPanels = (page: Page) => page.getByTestId("help-panel");
const message = (page: Page) => page.getByTestId("command-error");

/** Four business panels that render their heads without any backend (error state is enough). */
async function fillGrid(page: Page) {
  for (const command of ["700 Q", "9988 Q", "700 N", "W"]) await run(page, command);
}

test("HELP-01 first visit auto-opens exactly one help panel and writes the marker", async ({ page }) => {
  await page.goto("./");
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "HELP" })).toBeVisible();
  // React.StrictMode mounts effects twice in dev; the marker must keep the second mount quiet.
  const marker = await page.evaluate((key) => window.localStorage.getItem(key), HELP_SEEN_KEY);
  expect(marker).not.toBeNull();
});

test("HELP-02 a marked visit does not auto-open and both manual entries still work", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await expect(helpPanels(page)).toHaveCount(0);

  await run(page, "HELP");
  await expect(helpPanels(page)).toHaveCount(1);
  await run(page, "CLEAR");

  await page.getByTestId("help-button").click();
  await expect(helpPanels(page)).toHaveCount(1);
});

test("HELP-03 the help panel carries all four English sections", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "HELP");

  const panel = helpPanels(page);
  await expect(panel).toBeVisible();
  for (const section of ["FUNCTIONS", "SYMBOLS", "COMMAND BAR", "TRY AN EXAMPLE"]) {
    await expect(panel.getByRole("heading", { name: section })).toBeVisible();
  }
  await expect(panel.getByTestId("help-example")).toHaveCount(6);
});

test("HELP-04 the ? button opens the same help panel", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await page.getByTestId("help-button").click();
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "HELP" })).toBeVisible();
});

test("HELP-05 H plus Tab completes HELP with no trailing space and keeps the focus", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  const input = page.getByTestId("command-input");

  await input.pressSequentially("H");
  await input.press("Tab");
  await expect(input).toHaveValue("HELP");

  await input.press("Shift+Tab");
  await expect(input).toHaveValue("HELP");
  await expect(input).toBeFocused();
});

test("HELP-06 700 HELP is invalid and opens nothing", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "700 HELP");
  await expect(message(page)).toContainText("takes no symbol");
  await expect(helpPanels(page)).toHaveCount(0);
  await expect(page.getByTestId("empty-slot")).toHaveCount(4);
});

test("HELP-07 reopening HELP reuses the panel and removes nothing", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "700 Q");
  await run(page, "HELP");
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByTestId("empty-slot")).toHaveCount(2);

  await run(page, "HELP");
  await page.getByTestId("help-button").click();
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
  await expect(page.getByTestId("empty-slot")).toHaveCount(2);
});

test("HELP-08 a full grid with HELP reuses it without the full-grid prompt", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  for (const command of ["700 Q", "9988 Q", "700 N"]) await run(page, command);
  await run(page, "HELP");
  await expect(page.getByTestId("empty-slot")).toHaveCount(0);

  await run(page, "HELP");
  await page.getByTestId("help-button").click();
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(message(page)).toHaveCount(0);
  await expect(page.getByTestId("empty-slot")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
});

test("HELP-09 a full grid without HELP prompts instead of opening or evicting", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await fillGrid(page);
  await run(page, "HELP");

  await expect(helpPanels(page)).toHaveCount(0);
  await expect(message(page)).toContainText("close a panel");
  await expect(page.getByTestId("empty-slot")).toHaveCount(0);
  for (const title of ["700.HK Q", "9988.HK Q", "700.HK N", "W"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("HELP-10 clicking an example on a full grid prompts and keeps every panel", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  for (const command of ["700 Q", "9988 Q", "700 N"]) await run(page, command);
  await run(page, "HELP");

  await helpPanels(page).getByTestId("help-example").first().click();
  await expect(message(page)).toContainText("close a panel");
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByTestId("empty-slot")).toHaveCount(0);
  for (const title of ["HELP", "700.HK Q", "9988.HK Q", "700.HK N"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("HELP-11 an example click with a free slot opens the business panel and keeps HELP", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "HELP");
  await run(page, "9988 Q");

  await helpPanels(page).getByTestId("help-example").first().click();
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
  await expect(helpPanels(page)).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "9988.HK Q" })).toBeVisible();
  await expect(page.getByTestId("empty-slot")).toHaveCount(1);
});

test("HELP-12 an example click really runs the command through a mocked quote", async ({ page }) => {
  await seenHelp(page);
  // Contract-shaped Quote and Intraday (decimal strings); QuotePanel loads both in one
  // Promise.all, so both endpoints need a mock. CORS header because the app origin differs;
  // urls.webOrigin is navigation-order independent (page.url() is about:blank until goto).
  const cors = { "access-control-allow-origin": urls.webOrigin };
  await page.route("**/v1/quotes/700.HK", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cors,
      body: JSON.stringify({
        symbol: "700.HK",
        price: "438.4000",
        change: "12.6000",
        changePercent: "2.96",
        open: "431.6000",
        high: "436.2000",
        low: "430.8000",
        volume: 12300000,
        turnover: "5361200000.0000",
        currency: "HKD",
        asOf: "2026-10-26T02:00:00Z",
      }),
    }),
  );
  await page.route("**/v1/intraday/700.HK", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cors,
      body: JSON.stringify({ symbol: "700.HK", currency: "HKD", prevClose: "425.8000", points: [] }),
    }),
  );
  await page.goto("./");
  await run(page, "HELP");

  await helpPanels(page).getByTestId("help-example").first().click();
  await expect(page.getByTestId("quote-panel")).toBeVisible();
  await expect(page.getByTestId("quote-price")).toContainText(/\d+\.\d{4}\s*HKD/);
  await expect(helpPanels(page)).toHaveCount(1);
});

test("HELP-13 closing HELP leaves the business panels untouched and it reopens", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "700 Q");
  await run(page, "9988 Q");
  await run(page, "HELP");

  const helpSection = page.locator("main.grid > section", { has: helpPanels(page) });
  await helpSection.getByTestId("close-panel").click();
  await expect(helpPanels(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "9988.HK Q" })).toBeVisible();
  // Closing HELP leaves the two business panels, so two of the four grid slots stay empty.
  await expect(page.getByTestId("empty-slot")).toHaveCount(2);

  await run(page, "HELP");
  await expect(helpPanels(page)).toHaveCount(1);
});

test("HELP-14 CLEAR closes every panel including HELP", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "700 Q");
  await run(page, "HELP");
  await run(page, "CLEAR");
  await expect(page.getByTestId("empty-slot")).toHaveCount(4);
  await expect(helpPanels(page)).toHaveCount(0);
});

test("HELP-15 direct execution on a full grid still evicts the oldest panel", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await fillGrid(page);
  await run(page, "700 CF");

  await expect(page.getByTestId("empty-slot")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "700.HK CF" })).toBeVisible();
  for (const title of ["9988.HK Q", "700.HK N", "W"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
});

test("HELP-16 the top bar lists HELP from the same source as the parser", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await expect(page.locator(".topbar .muted")).toHaveText("Q · GP · N · W · CF · HELP · CLEAR · ASK");
});

test("HELP-17 blocked storage skips the auto-open silently and keeps both entries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });
  });
  await page.goto("./");
  await expect(helpPanels(page)).toHaveCount(0);

  await run(page, "HELP");
  await expect(helpPanels(page)).toHaveCount(1);
  await run(page, "CLEAR");
  await page.getByTestId("help-button").click();
  await expect(helpPanels(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("HELP-18 the help content lists only implemented commands and runnable examples", async ({ page }) => {
  await seenHelp(page);
  await page.goto("./");
  await run(page, "HELP");
  const panel = helpPanels(page);

  const codes = await panel.locator(".help-functions .help-code").allTextContents();
  expect(codes).toEqual(["Q SYM", "GP SYM RANGE", "N [SYM]", "W", "CF SYM", "HELP", "CLEAR", "ASK TEXT"]);

  const examples = await panel.getByTestId("help-example").allTextContents();
  expect(examples).toEqual(["700 Q", "700 GP", "N", "W", "700 CF", "ASK Compare Tencent and Alibaba"]);
});
