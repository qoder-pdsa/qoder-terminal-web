import { expect, test } from "@playwright/test";
import { urls } from "../playwright.config";

/**
 * Per-branch frontend preview (deploy.sh preview <branch>). QA sets PREVIEW_SLUG to the slug it just published;
 * without it the suite is skipped, because a preview only exists after an explicit publish.
 */
const slug = process.env.PREVIEW_SLUG;
const previewUrl = `${urls.webOrigin}/preview/${slug}/`;

test.describe("frontend preview", () => {
  test.skip(!slug, "PREVIEW_SLUG not set");

  test("serves the app under its own base path", async ({ request }) => {
    const resp = await request.get(previewUrl);
    expect(resp.status()).toBe(200);
    const html = await resp.text();
    expect(html).toContain("Qoder Terminal");
    // Assets resolve under the preview base, not under the production root
    expect(html).toMatch(new RegExp(`/preview/${slug}/assets/`));
    expect(resp.headers()["cache-control"]).toContain("no-cache");
  });

  test("deep links fall back to the preview's own index.html", async ({ request }) => {
    const resp = await request.get(`${previewUrl}some/deep/link`);
    expect(resp.status()).toBe(200);
    expect(await resp.text()).toMatch(new RegExp(`/preview/${slug}/assets/`));
  });

  test("shares the production backend", async ({ request }) => {
    const resp = await request.get(`${urls.data}/v1/quotes/700.HK`);
    expect(resp.ok()).toBeTruthy();
    expect((await resp.json()).currency).toBe("HKD");
  });

  test("an unknown or malformed slug is a 404, not the production app", async ({ request }) => {
    for (const path of ["/preview/no-such-preview/", "/preview/", `/preview/${"a".repeat(41)}/`, "/preview/Bad_Slug/"]) {
      const resp = await request.get(`${urls.webOrigin}${path}`);
      expect(resp.status(), path).toBe(404);
    }
  });

  test("production is unaffected", async ({ request }) => {
    const html = await (await request.get(`${urls.webOrigin}/`)).text();
    expect(html).toContain("Qoder Terminal");
    expect(html).not.toContain("/preview/");
  });
});
