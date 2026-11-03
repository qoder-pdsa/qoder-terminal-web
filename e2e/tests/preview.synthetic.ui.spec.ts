import { expect, test, type Page } from "@playwright/test";
import { urls } from "../playwright.config";

// DEMO-13 demo link (workitem 10077, human comment 10208): the published branch preview must be an
// interactive demo on synthetic data only — no real business REST or WebSocket, no credentials.
// These cases only mean something when QA points WEB_URL at a /preview/<slug>/ URL; on any other
// target the build is not synthetic, so they skip instead of asserting the wrong mode.
const isPreviewTarget = new URL(urls.web).pathname.startsWith("/preview/");

async function run(page: Page, command: string) {
  await page.getByTestId("command-input").fill(command);
  await page.getByTestId("command-input").press("Enter");
}

test.describe("synthetic branch preview", () => {
  test.skip(!isPreviewTarget, "WEB_URL is not a /preview/<slug>/ target");

  test("PV-01 the preview serves the app under its own base and opens the help on first visit", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("help-panel")).toHaveCount(1);
    for (const section of ["FUNCTIONS", "SYMBOLS", "COMMAND BAR", "TRY AN EXAMPLE"]) {
      await expect(page.getByTestId("help-panel").getByText(section, { exact: true })).toBeVisible();
    }
  });

  test("PV-02 the ? entry and an example click render synthetic contract data", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("qoder-terminal:help-seen", "1"));
    await page.goto("./");
    await page.getByTestId("help-button").click();
    await expect(page.getByTestId("help-panel")).toHaveCount(1);
    await page.getByTestId("help-panel").getByText("700 Q", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "700.HK Q" })).toBeVisible();
    await expect(page.getByTestId("quote-price")).toHaveText(/\d+\.\d{4}\s*HKD/);
  });

  test("PV-03 the preview makes no business REST or WebSocket request", async ({ page }) => {
    const origin = new URL(urls.web).origin;
    const offOrigin: string[] = [];
    const apiPaths: string[] = [];
    const sockets: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== origin) offOrigin.push(request.url());
      else if (url.pathname.startsWith("/api/")) apiPaths.push(request.url());
    });
    page.on("websocket", (socket) => sockets.push(socket.url()));
    await page.goto("./");
    await run(page, "700 Q");
    await expect(page.getByTestId("quote-price")).toBeVisible();
    expect(offOrigin).toEqual([]);
    expect(apiPaths).toEqual([]);
    expect(sockets).toEqual([]);
  });
});
