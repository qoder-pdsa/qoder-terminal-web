import { defineConfig, devices } from "@playwright/test";

/** 目标环境通过环境变量注入；QA 部署后指向验收环境。 */
export const urls = {
  data: process.env.DATA_URL ?? "http://localhost:8081",
  analyst: process.env.ANALYST_URL ?? "http://localhost:8082",
  web: process.env.WEB_URL ?? "http://localhost:5173",
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
