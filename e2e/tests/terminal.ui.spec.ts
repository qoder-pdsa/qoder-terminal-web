import { expect, test } from "@playwright/test";

async function run(page: import("@playwright/test").Page, command: string) {
  await page.getByTestId("command-input").fill(command);
  await page.getByTestId("command-input").press("Enter");
}

test("short HK code opens a live quote", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");
  await expect(page.getByTestId("quote-price")).toContainText(/\d+\.\d{4}\s*HKD/);
});

test("Q draws the intraday line against the previous close", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");
  await expect(page.getByTestId("quote-panel")).toContainText(/PREV \d+\.\d{4}/);
  // Live data has no points before the first trade of the session; mock has them from 09:30 HKT.
  await expect(page.getByTestId("quote-chart").locator("canvas").first().or(page.getByTestId("quote-intraday-empty"))).toBeVisible();
});

test("Q shows a directional change and the Hong Kong time", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");

  const change = page.getByTestId("quote-change");
  await expect(change).toBeVisible();
  await expect(change).toHaveAttribute("data-direction", /^(up|down|flat)$/);
  await expect(change).toContainText(/^[▲▼▬] [+-]?\d+\.\d{4} \([+-]?\d+\.\d{2}%\)$/);
  await expect(page.getByTestId("quote-asof")).toHaveText(/^\d{2}:\d{2} HKT$/);
});

test("ASK streams an answer and opens chart panels", async ({ page }) => {
  await page.goto("./");
  await run(page, "ASK compare Tencent and Alibaba");
  await expect(page.getByTestId("ask-answer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "700.HK GP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "9988.HK GP" })).toBeVisible();
});

test("invalid command shows an error", async ({ page }) => {
  await page.goto("./");
  await run(page, "GP");
  await expect(page.getByTestId("command-error")).toContainText("requires a symbol");
});

test("GP opens a candlestick chart panel with a canvas", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP");
  await expect(page.getByRole("heading", { name: "700.HK GP 3M" })).toBeVisible();
  const panel = page.getByTestId("graph-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator("canvas").first()).toBeVisible();
});

test("GP takes an explicit range and rejects an unknown one", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP 6M");
  await expect(page.getByRole("heading", { name: "700.HK GP 6M" })).toBeVisible();
  await expect(page.getByTestId("graph-panel").locator("canvas").first()).toBeVisible();

  await run(page, "700 GP 2M");
  await expect(page.getByTestId("command-error")).toContainText("GP range must be one of 1M, 3M, 6M, 1Y");
});

test("GP range buttons refetch the range and keep the chart drawn", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP");
  const panel = page.getByTestId("graph-panel");
  await expect(panel.locator("canvas").first()).toBeVisible();
  await expect(panel.getByTestId("range-3M")).toHaveAttribute("aria-pressed", "true");

  await panel.getByTestId("range-1M").click();
  await expect(panel.getByTestId("range-1M")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByTestId("range-3M")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("heading", { name: "700.HK GP 1M" })).toBeVisible();
  await expect(panel.locator("canvas").first()).toBeVisible();
});

test("GP draws a volume pane under the candles and keeps it across ranges", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP");
  const panel = page.getByTestId("graph-panel");
  const chart = panel.getByTestId("graph-chart");
  await expect(chart).toHaveAttribute("data-panes", "2");
  await expect(chart.locator("canvas").first()).toBeVisible();

  await panel.getByTestId("range-1M").click();
  await expect(panel.getByTestId("range-1M")).toHaveAttribute("aria-pressed", "true");
  await expect(chart).toHaveAttribute("data-panes", "2");
  await expect(chart.locator("canvas").first()).toBeVisible();
});

test("GP range state is per panel and starts on the opened range", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP 6M");
  await run(page, "9988 GP");
  const newest = page.getByTestId("graph-panel").nth(0);
  const older = page.getByTestId("graph-panel").nth(1);
  await expect(newest.getByTestId("range-3M")).toHaveAttribute("aria-pressed", "true");
  await expect(older.getByTestId("range-6M")).toHaveAttribute("aria-pressed", "true");

  await older.getByTestId("range-1Y").click();
  await expect(older.getByTestId("range-1Y")).toHaveAttribute("aria-pressed", "true");
  await expect(older.getByTestId("range-6M")).toHaveAttribute("aria-pressed", "false");
  await expect(newest.getByTestId("range-3M")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "700.HK GP 1Y" })).toBeVisible();
  await expect(older.locator("canvas").first()).toBeVisible();
});

test("GP SMA overlay toggles flip aria-pressed one at a time", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP");
  const panel = page.getByTestId("graph-panel");
  await expect(panel.locator("canvas").first()).toBeVisible();

  const sma20 = panel.getByTestId("toggle-sma20");
  const sma50 = panel.getByTestId("toggle-sma50");
  await expect(sma20).toHaveAttribute("aria-pressed", "true");
  await expect(sma50).toHaveAttribute("aria-pressed", "true");

  await sma20.click();
  await expect(sma20).toHaveAttribute("aria-pressed", "false");
  await expect(sma50).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("canvas").first()).toBeVisible();

  await sma20.click();
  await expect(sma20).toHaveAttribute("aria-pressed", "true");
});

test("two GP panels keep their own overlay state", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 GP");
  await run(page, "9988 GP");
  const newest = page.getByTestId("graph-panel").nth(0);
  const older = page.getByTestId("graph-panel").nth(1);

  await newest.getByTestId("toggle-sma50").click();
  await expect(newest.getByTestId("toggle-sma50")).toHaveAttribute("aria-pressed", "false");
  await expect(newest.getByTestId("toggle-sma20")).toHaveAttribute("aria-pressed", "true");
  await expect(older.getByTestId("toggle-sma50")).toHaveAttribute("aria-pressed", "true");
});

test("arrow keys recall this session's commands", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");
  await run(page, "9988.HK GP");

  const input = page.getByTestId("command-input");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("9988.HK GP");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("700 Q");
});

test("Tab completes a symbol from the session and then a function code", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");

  const input = page.getByTestId("command-input");
  await input.fill("70");
  await expect(input).toHaveAttribute("data-completions", "700.HK");
  await input.press("Tab");
  // The completed symbol brings its own separating space, so the code is typed straight after it.
  await expect(input).toHaveValue("700.HK ");

  await input.pressSequentially("G");
  await expect(input).toHaveAttribute("data-completions", "700.HK GP");
  await input.press("Tab");
  await expect(input).toHaveValue("700.HK GP");

  // Completion only drafts; the completed line was never submitted, so ↑ still recalls 700 Q.
  await input.press("ArrowUp");
  await expect(input).toHaveValue("700 Q");
});

test("Tab cycles through the candidates and Shift+Tab cycles back", async ({ page }) => {
  await page.goto("./");
  const input = page.getByTestId("command-input");
  await input.fill("700 ");
  await expect(input).toHaveAttribute(
    "data-completions",
    "700 Q,700 GP,700 N,700 W,700 CF",
  );

  await input.press("Tab");
  await expect(input).toHaveValue("700 Q");
  await input.press("Tab");
  await expect(input).toHaveValue("700 GP");
  await input.press("Shift+Tab");
  await expect(input).toHaveValue("700 Q");
  await input.press("Tab");
  await input.press("Tab");
  await expect(input).toHaveValue("700 N");
});

test("Tab with nothing to complete leaves the input and keeps the focus", async ({ page }) => {
  await page.goto("./");
  const input = page.getByTestId("command-input");
  await input.fill("XYZ");
  await expect(input).toHaveAttribute("data-completions", "");
  await input.press("Tab");
  await expect(input).toHaveValue("XYZ");
  await expect(input).toBeFocused();
});

test("layout is a fixed 2x2 grid with empty slots", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("empty-slot")).toHaveCount(4);
  await run(page, "700 Q");
  await expect(page.getByTestId("empty-slot")).toHaveCount(3);

  const boxes = await page.locator("main.grid > section").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    }),
  );
  expect(new Set(boxes.map((b) => b.x)).size).toBe(2);
  expect(new Set(boxes.map((b) => b.y)).size).toBe(2);
});

test("× closes one panel and CLEAR empties the grid", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 Q");
  await run(page, "9988 Q");
  await expect(page.getByTestId("quote-panel")).toHaveCount(2);

  const firstClose = page.getByTestId("close-panel").first();
  await expect(firstClose).toHaveAttribute("aria-label", "Close 9988.HK Q");
  await firstClose.click();
  await expect(page.getByTestId("quote-panel")).toHaveCount(1);
  await expect(page.getByTestId("empty-slot")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "9988.HK Q" })).toHaveCount(0);

  await run(page, "CLEAR");
  await expect(page.getByTestId("empty-slot")).toHaveCount(4);
  await expect(page.getByTestId("quote-panel")).toHaveCount(0);
});

test("N lists a symbol's news with outbound links", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 N");
  const first = page.getByTestId("news-item").first();
  await expect(first).toBeVisible();
  await expect(first.locator("a")).toHaveAttribute("href", /^https?:\/\//);
  await expect(first.locator("a")).toHaveAttribute("target", "_blank");
  await expect(first).toContainText(/ago|just now/);
});

test("bare N merges several symbols' news", async ({ page }) => {
  await page.goto("./");
  await run(page, "N");
  await expect(page.getByTestId("news-item").first()).toBeVisible();
  const symbols = await page.getByTestId("news-item").locator(".news-meta").allTextContents();
  expect(new Set(symbols.flatMap((t) => t.match(/[0-9A-Z]+\.(HK|US|SH|SZ)/g) ?? [])).size).toBeGreaterThan(1);
});

test("W lists the watchlist with live prices and opens a quote on click", async ({ page }) => {
  await page.goto("./");
  await run(page, "W");
  const rows = page.getByTestId("watchlist-row");
  await expect(rows.first()).toBeVisible();
  await expect(page.getByTestId("watchlist-price").first()).toHaveText(/^\d+\.\d{4}$/);
  await expect(page.getByTestId("watchlist-change").first()).toHaveText(/^[▲▼]|^0\.0000/);
  const symbol = (await rows.first().locator(".symbol").textContent()) ?? "";
  await rows.first().click();
  await expect(page.getByTestId("quote-panel")).toBeVisible();
  await expect(page.locator("h2", { hasText: `${symbol} Q` })).toBeVisible();
});

// The e2e program cannot import src/ (it pulls in `import.meta.env`), so the CHANGE column is
// compared here as contract decimal strings — scaled BigInts, never `Number` / `parseFloat`.
const PERCENT = /\(([+-]?[\d.]+)%\)$/;

function decimalOf(percent: string): bigint {
  const [int, frac = ""] = percent.replace(/^[+-]/, "").split(".");
  const scaled = BigInt(int + frac.padEnd(2, "0"));
  return percent.startsWith("-") ? -scaled : scaled;
}

function ordered(values: readonly string[], direction: "descending" | "ascending"): boolean {
  for (let i = 1; i < values.length; i++) {
    const [a, b] = [decimalOf(values[i - 1]), decimalOf(values[i])];
    if (direction === "descending" ? a < b : a > b) return false;
  }
  return true;
}

/** The percentages of the priced rows, plus whether every still-`…` row sits behind them. */
async function changeColumn(page: import("@playwright/test").Page) {
  const texts = await page.getByTestId("watchlist-change").allTextContents();
  const percents = texts.map((t) => PERCENT.exec(t)?.[1] ?? null);
  const firstMissing = percents.indexOf(null);
  return {
    percents: percents.filter((p): p is string => p !== null),
    unpricedLast: firstMissing === -1 || percents.slice(firstMissing).every((p) => p === null),
  };
}

test("W sorts by CHANGE and flips on the second click", async ({ page }) => {
  await page.goto("./");
  await run(page, "W");
  await expect(page.getByTestId("watchlist-change").first()).toHaveText(/^[▲▼]|^0\.0000/);

  const price = page.getByTestId("sort-price");
  const change = page.getByTestId("sort-change");
  await expect(price).toHaveAttribute("aria-sort", "none");
  await expect(change).toHaveAttribute("aria-sort", "none");

  await change.click();
  await expect(change).toHaveAttribute("aria-sort", "descending");
  await expect(price).toHaveAttribute("aria-sort", "none");
  await expect(change).toContainText("▼");
  const descending = await changeColumn(page);
  expect(descending.percents.length).toBeGreaterThan(1);
  expect(descending.unpricedLast).toBe(true);
  expect(ordered(descending.percents, "descending")).toBe(true);
  // The first row carries the largest percentage of the visible rows.
  expect(decimalOf(descending.percents[0])).toBe(
    descending.percents.map(decimalOf).reduce((max, v) => (v > max ? v : max)),
  );

  await change.click();
  await expect(change).toHaveAttribute("aria-sort", "ascending");
  await expect(change).toContainText("▲");
  const ascending = await changeColumn(page);
  expect(ascending.unpricedLast).toBe(true);
  expect(ordered(ascending.percents, "ascending")).toBe(true);
  expect(decimalOf(ascending.percents[0])).toBe(
    ascending.percents.map(decimalOf).reduce((min, v) => (v < min ? v : min)),
  );

  // PRICE is an independent key: clicking it restarts descending and clears the CHANGE marker.
  await price.click();
  await expect(price).toHaveAttribute("aria-sort", "descending");
  await expect(change).toHaveAttribute("aria-sort", "none");
  const prices = await page.getByTestId("watchlist-price").allTextContents();
  const priced = prices.filter((p) => /^\d+\.\d+$/.test(p));
  expect(ordered(priced, "descending")).toBe(true);
});

test("CF draws the capital flow bars and the order-size distribution", async ({ page }) => {
  await page.goto("./");
  await run(page, "700 CF");
  // Live data has no bars before the first trade of the session; mock always has them.
  await expect(page.getByTestId("cf-chart").locator("canvas").first().or(page.getByTestId("cf-empty"))).toBeVisible();
  const table = page.getByTestId("cf-distribution");
  for (const bucket of ["large", "medium", "small"]) {
    await expect(table.getByTestId(`cf-${bucket}`)).toContainText(bucket.toUpperCase());
  }
  await expect(table.getByTestId("cf-large").locator("td").nth(3)).toHaveAttribute("data-direction", /up|down|flat/);
});

test("CF requires a symbol", async ({ page }) => {
  await page.goto("./");
  await run(page, "CF");
  await expect(page.getByTestId("command-error")).toContainText("CF requires a symbol");
});
