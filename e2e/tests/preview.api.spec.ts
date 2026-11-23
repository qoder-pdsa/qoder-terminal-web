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

  test("serves its own synthetic API instead of the shared backend", async ({ request }) => {
    // A preview must be readable in a normal browser without reaching the real services, so it answers the
    // business API paths from the fixtures emitted into its own bundle (preview/synthetic.ts).
    const resp = await request.get(`${previewUrl}synthetic/data/v1/quotes/700.HK`);
    expect(resp.status()).toBe(200);
    const quote = await resp.json();
    expect(quote.symbol).toBe("700.HK");
    expect(quote.currency).toBe("HKD");
    // Contract prices stay decimal strings end to end.
    expect(typeof quote.price).toBe("string");
    expect(quote.price).toMatch(/^\d+\.\d{4}$/);
  });

  test("the published bundle resolves its API base inside the preview", async ({ request }) => {
    const html = await (await request.get(previewUrl)).text();
    const asset = html.match(new RegExp(`/preview/${slug}/assets/[^"]+\\.js`))?.[0];
    expect(asset, "the preview index references its own bundle").toBeTruthy();
    const js = await (await request.get(`${urls.webOrigin}${asset}`)).text();
    expect(js).toContain("synthetic");
  });

  test("the synthetic API covers the watchlist it offers", async ({ request }) => {
    const lists = await (await request.get(`${previewUrl}synthetic/data/v1/watchlists`)).json();
    expect(Array.isArray(lists)).toBeTruthy();
    const symbols = lists.flatMap((l: { symbols: { symbol: string }[] }) => l.symbols.map((s) => s.symbol));
    expect(symbols.length).toBeGreaterThan(0);
    for (const symbol of symbols) {
      for (const endpoint of ["quotes", "intraday", "history", "indicators", "capital-flow"]) {
        const resp = await request.get(`${previewUrl}synthetic/data/v1/${endpoint}/${symbol}`);
        expect(resp.status(), `${endpoint}/${symbol}`).toBe(200);
      }
    }
  });

  test("the gateway's real API still serves production", async ({ request }) => {
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
