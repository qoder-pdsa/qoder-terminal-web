import { defineConfig, devices } from "@playwright/test";

/**
 * Target environment is injected via environment variables; QA points it at the acceptance environment after deployment.
 * WEB_URL may be a per-branch preview such as http://host/preview/<slug>/ — UI tests navigate relative to it (`page.goto("./")`),
 * so `web` always ends with a slash. `webOrigin` is the gateway root shared by production and every preview.
 */
const webUrl = process.env.WEB_URL ?? "http://localhost:5173";
export const urls = {
  data: process.env.DATA_URL ?? "http://localhost:8081",
  analyst: process.env.ANALYST_URL ?? "http://localhost:8082",
  web: webUrl.endsWith("/") ? webUrl : `${webUrl}/`,
  webOrigin: new URL(webUrl).origin,
};

export default defineConfig({
  testDir: "tests",
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  projects: [
    { name: "api", testMatch: /.*\.api\.spec\.ts/ },
    {
      name: "ui",
      testMatch: /.*\.ui\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: urls.web, trace: "retain-on-failure" },
    },
  ],
});
