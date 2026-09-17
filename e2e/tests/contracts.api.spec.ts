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
