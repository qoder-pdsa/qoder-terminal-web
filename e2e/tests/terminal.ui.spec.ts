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
