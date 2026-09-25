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
