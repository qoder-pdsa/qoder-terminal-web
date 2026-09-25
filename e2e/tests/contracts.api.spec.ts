import { expect, test } from "@playwright/test";
import { urls } from "../playwright.config";

const DECIMAL = /^-?\d+(\.\d+)?$/;

test("data: HK quote uses HKD and decimal strings", async ({ request }) => {
  const quote = await (await request.get(`${urls.data}/v1/quotes/700.HK`)).json();
  expect(quote.currency).toBe("HKD");
  for (const field of ["price", "change", "changePercent"]) {
    expect(quote[field], field).toMatch(DECIMAL);
  }
});

test("data: SMA series aligns with history", async ({ request }) => {
  const history: unknown[] = await (await request.get(`${urls.data}/v1/history/9988.HK?range=1M`)).json();
  const resp = await request.get(`${urls.data}/v1/indicators/9988.HK?kind=sma&window=5&range=1M`);
  expect(resp.ok()).toBeTruthy();
  const { points } = await resp.json();
  expect(points).toHaveLength(history.length);
  expect(points[3].value).toBeNull();
  expect(points[4].value).toMatch(DECIMAL);
});

test("analyst → data: ASK streams tool calls and a cited answer", async ({ request }) => {
  const resp = await request.post(`${urls.analyst}/v1/ask`, { data: { question: "Analyze Tencent" } });
  expect(resp.ok()).toBeTruthy();
  const events = (await resp.text())
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));
  const types = events.map((e) => e.type);
  expect(types).toContain("tool_call");
  expect(events.filter((e) => e.type === "tool_result" && !e.ok)).toEqual([]);
  const answer = events.at(-1);
  expect(answer.type).toBe("answer");
  expect(answer.markdown).toContain("700.HK");
  expect(answer.citations.length).toBeGreaterThan(0);
});

test("data: batch quotes match single quotes in the requested order", async ({ request }) => {
  const batch = await (await request.get(`${urls.data}/v1/quotes?symbols=9988.HK,700.HK`)).json();
  expect(batch.map((q: { symbol: string }) => q.symbol)).toEqual(["9988.HK", "700.HK"]);
  const single = await (await request.get(`${urls.data}/v1/quotes/700.HK`)).json();
  expect(batch[1].currency).toBe(single.currency);
  expect(batch[1].price).toMatch(DECIMAL);
  expect((await request.get(`${urls.data}/v1/quotes?symbols=tencent`)).status()).toBe(400);
});

test("data: watchlists carry named symbols", async ({ request }) => {
  const lists = await (await request.get(`${urls.data}/v1/watchlists`)).json();
  expect(Array.isArray(lists)).toBeTruthy();
  for (const list of lists) {
    expect(typeof list.id).toBe("string");
    expect(typeof list.name).toBe("string");
    for (const s of list.symbols) expect(s.symbol).toMatch(/^[0-9A-Z]{1,6}\.(HK|US|SH|SZ)$/);
  }
});

test("data: capital flow is decimal strings with a server-side net", async ({ request }) => {
  const cf = await (await request.get(`${urls.data}/v1/capital-flow/700.HK`)).json();
  expect(cf.symbol).toBe("700.HK");
  expect(cf.currency).toBe("HKD");
  expect(cf.flow.length).toBeGreaterThan(0);
  expect(cf.flow[0].inflow).toMatch(DECIMAL);
  for (const side of ["in", "out", "net"]) {
    for (const bucket of ["large", "medium", "small"]) expect(cf.distribution[side][bucket], `${side}.${bucket}`).toMatch(DECIMAL);
  }
  expect((await request.get(`${urls.data}/v1/capital-flow/tencent`)).status()).toBe(400);
});
