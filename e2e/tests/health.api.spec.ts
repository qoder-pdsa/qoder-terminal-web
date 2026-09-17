import { expect, test } from "@playwright/test";
import { urls } from "../playwright.config";

for (const [name, base] of Object.entries({ data: urls.data, analyst: urls.analyst })) {
  test(`${name} /health is ok`, async ({ request }) => {
    const resp = await request.get(`${base}/health`);
    expect(resp.ok()).toBeTruthy();
    expect(await resp.json()).toEqual({ status: "ok" });
  });
}
